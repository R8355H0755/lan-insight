import express from 'express';
import { body, param, query, validationResult } from 'express-validator';

const router = express.Router();

// Middleware to get services from app locals
const getServices = (req) => ({
  alertManager: req.app.locals.alertManager,
  dbManager: req.app.locals.dbManager,
  logger: req.app.locals.logger
});

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

/**
 * GET /api/alerts
 * Get all alerts with optional filtering
 */
router.get('/', [
  query('deviceId').optional().isUUID(),
  query('deviceIp').optional().isIP(),
  query('type').optional().isIn(['cpu', 'memory', 'disk', 'network', 'offline']),
  query('severity').optional().isIn(['warning', 'critical']),
  query('acknowledged').optional().isBoolean(),
  query('limit').optional().isInt({ min: 1, max: 1000 }).toInt(),
  query('offset').optional().isInt({ min: 0 }).toInt()
], handleValidationErrors, async (req, res) => {
  try {
    const { alertManager, dbManager } = getServices(req);
    const {
      deviceId,
      deviceIp,
      type,
      severity,
      acknowledged,
      limit = 100,
      offset = 0
    } = req.query;

    // Get alerts from database for persistence
    const dbAlerts = await dbManager.getAlerts({
      deviceId,
      severity,
      acknowledged: acknowledged !== undefined ? acknowledged === 'true' : null,
      limit,
      offset
    });

    // Get active alerts from alert manager
    const activeAlerts = alertManager.getActiveAlerts({
      deviceId,
      deviceIp,
      type,
      severity,
      acknowledged: acknowledged !== undefined ? acknowledged === 'true' : null
    });

    // Combine and deduplicate
    const alertsMap = new Map();
    
    // Add database alerts
    dbAlerts.forEach(alert => {
      alertsMap.set(alert.id, {
        id: alert.id,
        deviceId: alert.device_id,
        deviceIp: alert.device_ip,
        type: alert.type,
        severity: alert.severity,
        message: alert.message,
        acknowledged: alert.acknowledged,
        acknowledgedBy: alert.acknowledged_by,
        acknowledgedAt: alert.acknowledged_at,
        createdAt: alert.created_at,
        resolvedAt: alert.resolved_at
      });
    });

    // Add/update with active alerts
    activeAlerts.forEach(alert => {
      alertsMap.set(alert.id, alert);
    });

    const alerts = Array.from(alertsMap.values())
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      alerts,
      total: alerts.length,
      filters: {
        deviceId,
        deviceIp,
        type,
        severity,
        acknowledged,
        limit,
        offset
      }
    });

  } catch (error) {
    const { logger } = getServices(req);
    logger.error('Failed to get alerts:', error);
    res.status(500).json({
      error: 'Failed to retrieve alerts',
      message: error.message
    });
  }
});

/**
 * GET /api/alerts/statistics
 * Get alert statistics
 */
router.get('/statistics', async (req, res) => {
  try {
    const { alertManager } = getServices(req);
    
    const statistics = alertManager.getAlertStatistics();
    
    res.json({
      statistics
    });

  } catch (error) {
    const { logger } = getServices(req);
    logger.error('Failed to get alert statistics:', error);
    res.status(500).json({
      error: 'Failed to retrieve alert statistics',
      message: error.message
    });
  }
});

/**
 * GET /api/alerts/:id
 * Get specific alert details
 */
router.get('/:id', [
  param('id').isUUID().withMessage('Valid alert ID is required')
], handleValidationErrors, async (req, res) => {
  try {
    const { alertManager, dbManager } = getServices(req);
    const alertId = req.params.id;

    // Try to get from active alerts first
    let alert = alertManager.getAlert(alertId);
    
    // If not found in active alerts, try database
    if (!alert) {
      const dbAlerts = await dbManager.getAlerts({ limit: 1 });
      const dbAlert = dbAlerts.find(a => a.id === alertId);
      
      if (dbAlert) {
        alert = {
          id: dbAlert.id,
          deviceId: dbAlert.device_id,
          deviceIp: dbAlert.device_ip,
          type: dbAlert.type,
          severity: dbAlert.severity,
          message: dbAlert.message,
          acknowledged: dbAlert.acknowledged,
          acknowledgedBy: dbAlert.acknowledged_by,
          acknowledgedAt: dbAlert.acknowledged_at,
          createdAt: dbAlert.created_at,
          resolvedAt: dbAlert.resolved_at
        };
      }
    }

    if (!alert) {
      return res.status(404).json({
        error: 'Alert not found',
        alertId
      });
    }

    res.json({
      alert
    });

  } catch (error) {
    const { logger } = getServices(req);
    logger.error(`Failed to get alert ${req.params.id}:`, error);
    res.status(500).json({
      error: 'Failed to retrieve alert',
      message: error.message
    });
  }
});

/**
 * POST /api/alerts/:id/acknowledge
 * Acknowledge an alert
 */
router.post('/:id/acknowledge', [
  param('id').isUUID().withMessage('Valid alert ID is required'),
  body('acknowledgedBy').optional().isLength({ min: 1, max: 255 })
], handleValidationErrors, async (req, res) => {
  try {
    const { alertManager, logger } = getServices(req);
    const alertId = req.params.id;
    const { acknowledgedBy = 'user' } = req.body;

    const alert = await alertManager.acknowledgeAlert(alertId, acknowledgedBy);
    
    logger.info(`Alert acknowledged: ${alertId} by ${acknowledgedBy}`);

    res.json({
      message: 'Alert acknowledged successfully',
      alert
    });

  } catch (error) {
    const { logger } = getServices(req);
    logger.error(`Failed to acknowledge alert ${req.params.id}:`, error);
    
    if (error.message.includes('not found')) {
      res.status(404).json({
        error: 'Alert not found',
        alertId: req.params.id
      });
    } else if (error.message.includes('already acknowledged')) {
      res.status(409).json({
        error: 'Alert already acknowledged',
        alertId: req.params.id
      });
    } else {
      res.status(500).json({
        error: 'Failed to acknowledge alert',
        message: error.message
      });
    }
  }
});

/**
 * POST /api/alerts/:id/resolve
 * Resolve an alert
 */
router.post('/:id/resolve', [
  param('id').isUUID().withMessage('Valid alert ID is required'),
  body('resolvedBy').optional().isLength({ min: 1, max: 255 })
], handleValidationErrors, async (req, res) => {
  try {
    const { alertManager, logger } = getServices(req);
    const alertId = req.params.id;
    const { resolvedBy = 'user' } = req.body;

    const alert = await alertManager.resolveAlert(alertId, resolvedBy);
    
    logger.info(`Alert resolved: ${alertId} by ${resolvedBy}`);

    res.json({
      message: 'Alert resolved successfully',
      alert
    });

  } catch (error) {
    const { logger } = getServices(req);
    logger.error(`Failed to resolve alert ${req.params.id}:`, error);
    
    if (error.message.includes('not found')) {
      res.status(404).json({
        error: 'Alert not found',
        alertId: req.params.id
      });
    } else if (error.message.includes('already resolved')) {
      res.status(409).json({
        error: 'Alert already resolved',
        alertId: req.params.id
      });
    } else {
      res.status(500).json({
        error: 'Failed to resolve alert',
        message: error.message
      });
    }
  }
});

/**
 * DELETE /api/alerts/:id
 * Delete an alert
 */
router.delete('/:id', [
  param('id').isUUID().withMessage('Valid alert ID is required')
], handleValidationErrors, async (req, res) => {
  try {
    const { alertManager, logger } = getServices(req);
    const alertId = req.params.id;

    const alert = await alertManager.deleteAlert(alertId);
    
    logger.info(`Alert deleted: ${alertId}`);

    res.json({
      message: 'Alert deleted successfully',
      alert
    });

  } catch (error) {
    const { logger } = getServices(req);
    logger.error(`Failed to delete alert ${req.params.id}:`, error);
    
    if (error.message.includes('not found')) {
      res.status(404).json({
        error: 'Alert not found',
        alertId: req.params.id
      });
    } else {
      res.status(500).json({
        error: 'Failed to delete alert',
        message: error.message
      });
    }
  }
});

/**
 * POST /api/alerts/bulk-acknowledge
 * Acknowledge multiple alerts
 */
router.post('/bulk-acknowledge', [
  body('alertIds').isArray({ min: 1 }).withMessage('Alert IDs array is required'),
  body('alertIds.*').isUUID().withMessage('All alert IDs must be valid UUIDs'),
  body('acknowledgedBy').optional().isLength({ min: 1, max: 255 })
], handleValidationErrors, async (req, res) => {
  try {
    const { alertManager, logger } = getServices(req);
    const { alertIds, acknowledgedBy = 'user' } = req.body;

    const results = await alertManager.bulkAcknowledgeAlerts(alertIds, acknowledgedBy);
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    logger.info(`Bulk acknowledge completed: ${successful} successful, ${failed} failed`);

    res.json({
      message: `Bulk acknowledge completed: ${successful} successful, ${failed} failed`,
      results,
      summary: {
        total: alertIds.length,
        successful,
        failed
      }
    });

  } catch (error) {
    const { logger } = getServices(req);
    logger.error('Failed to bulk acknowledge alerts:', error);
    res.status(500).json({
      error: 'Failed to bulk acknowledge alerts',
      message: error.message
    });
  }
});

/**
 * POST /api/alerts/bulk-resolve
 * Resolve multiple alerts
 */
router.post('/bulk-resolve', [
  body('alertIds').isArray({ min: 1 }).withMessage('Alert IDs array is required'),
  body('alertIds.*').isUUID().withMessage('All alert IDs must be valid UUIDs'),
  body('resolvedBy').optional().isLength({ min: 1, max: 255 })
], handleValidationErrors, async (req, res) => {
  try {
    const { alertManager, logger } = getServices(req);
    const { alertIds, resolvedBy = 'user' } = req.body;

    const results = await alertManager.bulkResolveAlerts(alertIds, resolvedBy);
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    logger.info(`Bulk resolve completed: ${successful} successful, ${failed} failed`);

    res.json({
      message: `Bulk resolve completed: ${successful} successful, ${failed} failed`,
      results,
      summary: {
        total: alertIds.length,
        successful,
        failed
      }
    });

  } catch (error) {
    const { logger } = getServices(req);
    logger.error('Failed to bulk resolve alerts:', error);
    res.status(500).json({
      error: 'Failed to bulk resolve alerts',
      message: error.message
    });
  }
});

/**
 * GET /api/alerts/device/:deviceId
 * Get alerts for a specific device
 */
router.get('/device/:deviceId', [
  param('deviceId').isUUID().withMessage('Valid device ID is required'),
  query('acknowledged').optional().isBoolean(),
  query('severity').optional().isIn(['warning', 'critical'])
], handleValidationErrors, async (req, res) => {
  try {
    const { alertManager } = getServices(req);
    const deviceId = req.params.deviceId;
    const { acknowledged, severity } = req.query;

    const alerts = alertManager.getActiveAlerts({
      deviceId,
      acknowledged: acknowledged !== undefined ? acknowledged === 'true' : undefined,
      severity
    });

    const summary = alertManager.getDeviceAlertSummary(deviceId);

    res.json({
      deviceId,
      alerts,
      summary
    });

  } catch (error) {
    const { logger } = getServices(req);
    logger.error(`Failed to get alerts for device ${req.params.deviceId}:`, error);
    res.status(500).json({
      error: 'Failed to retrieve device alerts',
      message: error.message
    });
  }
});

/**
 * POST /api/alerts/test
 * Create a test alert (for development/testing)
 */
router.post('/test', [
  body('deviceId').isUUID().withMessage('Valid device ID is required'),
  body('deviceIp').isIP().withMessage('Valid device IP is required'),
  body('type').isIn(['cpu', 'memory', 'disk', 'network', 'offline']).withMessage('Valid alert type is required'),
  body('severity').isIn(['warning', 'critical']).withMessage('Valid severity is required'),
  body('message').isLength({ min: 1, max: 500 }).withMessage('Message is required')
], handleValidationErrors, async (req, res) => {
  try {
    // Only allow in development mode
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        error: 'Test alerts not allowed in production'
      });
    }

    const { alertManager, logger } = getServices(req);
    const { deviceId, deviceIp, type, severity, message } = req.body;

    const alert = await alertManager.createAlert({
      deviceId,
      deviceIp,
      type,
      severity,
      message: `[TEST] ${message}`
    });

    logger.info(`Test alert created: ${alert.id}`);

    res.status(201).json({
      message: 'Test alert created successfully',
      alert
    });

  } catch (error) {
    const { logger } = getServices(req);
    logger.error('Failed to create test alert:', error);
    res.status(500).json({
      error: 'Failed to create test alert',
      message: error.message
    });
  }
});

/**
 * POST /api/alerts/clear-history
 * Clear resolved alerts history
 */
router.post('/clear-history', async (req, res) => {
  try {
    const { alertManager, logger } = getServices(req);

    const clearedCount = alertManager.clearHistory();
    
    logger.info(`Cleared ${clearedCount} resolved alerts from history`);

    res.json({
      message: 'Alert history cleared successfully',
      clearedCount
    });

  } catch (error) {
    const { logger } = getServices(req);
    logger.error('Failed to clear alert history:', error);
    res.status(500).json({
      error: 'Failed to clear alert history',
      message: error.message
    });
  }
});

/**
 * GET /api/alerts/export
 * Export all alerts to JSON
 */
router.get('/export', async (req, res) => {
  try {
    const { alertManager } = getServices(req);

    const exportData = alertManager.exportAlerts();

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="alerts-export-${Date.now()}.json"`);
    
    res.json(exportData);

  } catch (error) {
    const { logger } = getServices(req);
    logger.error('Failed to export alerts:', error);
    res.status(500).json({
      error: 'Failed to export alerts',
      message: error.message
    });
  }
});

export default router;