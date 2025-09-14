import express from 'express';
import { body, query, validationResult } from 'express-validator';

const router = express.Router();

// Middleware to get services from app locals
const getServices = (req) => ({
  monitoringService: req.app.locals.monitoringService,
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
 * GET /api/system/status
 * Get system status and health
 */
router.get('/status', async (req, res) => {
  try {
    const { monitoringService, dbManager, logger } = getServices(req);
    
    const monitoringStatus = monitoringService.getStatus();
    const dbStats = await dbManager.getDatabaseStats();
    const logStats = await logger.getLogStats();
    
    res.json({
      system: {
        status: 'running',
        uptime: process.uptime(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memory: {
          used: process.memoryUsage().heapUsed,
          total: process.memoryUsage().heapTotal,
          external: process.memoryUsage().external,
          rss: process.memoryUsage().rss
        },
        cpu: process.cpuUsage()
      },
      monitoring: monitoringStatus,
      database: dbStats,
      logging: logStats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const { logger } = getServices(req);
    logger.error('Failed to get system status:', error);
    res.status(500).json({
      error: 'Failed to retrieve system status',
      message: error.message
    });
  }
});

/**
 * GET /api/system/configuration
 * Get system configuration
 */
router.get('/configuration', async (req, res) => {
  try {
    const { dbManager } = getServices(req);
    
    const configuration = await dbManager.getConfiguration();
    
    // Group configuration by category
    const groupedConfig = {
      monitoring: {},
      thresholds: {},
      network: {},
      system: {}
    };
    
    configuration.forEach(config => {
      const { key, value, description } = config;
      
      if (key.includes('threshold')) {
        groupedConfig.thresholds[key] = { value, description };
      } else if (key.includes('scan') || key.includes('snmp') || key.includes('community')) {
        groupedConfig.network[key] = { value, description };
      } else if (key.includes('refresh') || key.includes('history')) {
        groupedConfig.monitoring[key] = { value, description };
      } else {
        groupedConfig.system[key] = { value, description };
      }
    });
    
    res.json({
      configuration: groupedConfig,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const { logger } = getServices(req);
    logger.error('Failed to get configuration:', error);
    res.status(500).json({
      error: 'Failed to retrieve configuration',
      message: error.message
    });
  }
});

/**
 * PUT /api/system/configuration
 * Update system configuration
 */
router.put('/configuration', [
  body('refresh_interval').optional().isInt({ min: 5, max: 300 }),
  body('cpu_warning_threshold').optional().isInt({ min: 1, max: 100 }),
  body('cpu_critical_threshold').optional().isInt({ min: 1, max: 100 }),
  body('memory_warning_threshold').optional().isInt({ min: 1, max: 100 }),
  body('memory_critical_threshold').optional().isInt({ min: 1, max: 100 }),
  body('disk_warning_threshold').optional().isInt({ min: 1, max: 100 }),
  body('disk_critical_threshold').optional().isInt({ min: 1, max: 100 }),
  body('max_history_days').optional().isInt({ min: 1, max: 365 }),
  body('default_community').optional().isLength({ min: 1, max: 50 }),
  body('scan_timeout').optional().isInt({ min: 1000, max: 30000 }),
  body('snmp_timeout').optional().isInt({ min: 1000, max: 30000 })
], handleValidationErrors, async (req, res) => {
  try {
    const { monitoringService, logger } = getServices(req);
    
    // Validate threshold relationships
    const config = req.body;
    if (config.cpu_warning_threshold && config.cpu_critical_threshold) {
      if (config.cpu_warning_threshold >= config.cpu_critical_threshold) {
        return res.status(400).json({
          error: 'CPU warning threshold must be less than critical threshold'
        });
      }
    }
    
    if (config.memory_warning_threshold && config.memory_critical_threshold) {
      if (config.memory_warning_threshold >= config.memory_critical_threshold) {
        return res.status(400).json({
          error: 'Memory warning threshold must be less than critical threshold'
        });
      }
    }
    
    if (config.disk_warning_threshold && config.disk_critical_threshold) {
      if (config.disk_warning_threshold >= config.disk_critical_threshold) {
        return res.status(400).json({
          error: 'Disk warning threshold must be less than critical threshold'
        });
      }
    }
    
    // Update configuration
    await monitoringService.updateConfiguration(config);
    
    logger.info('System configuration updated:', config);
    
    res.json({
      message: 'Configuration updated successfully',
      updatedSettings: Object.keys(config)
    });

  } catch (error) {
    const { logger } = getServices(req);
    logger.error('Failed to update configuration:', error);
    res.status(500).json({
      error: 'Failed to update configuration',
      message: error.message
    });
  }
});

/**
 * POST /api/system/monitoring/start
 * Start monitoring service
 */
router.post('/monitoring/start', async (req, res) => {
  try {
    const { monitoringService, logger } = getServices(req);
    
    const status = monitoringService.getStatus();
    if (status.isRunning) {
      return res.status(409).json({
        error: 'Monitoring service is already running'
      });
    }
    
    await monitoringService.start();
    logger.info('Monitoring service started via API');
    
    res.json({
      message: 'Monitoring service started successfully'
    });

  } catch (error) {
    const { logger } = getServices(req);
    logger.error('Failed to start monitoring service:', error);
    res.status(500).json({
      error: 'Failed to start monitoring service',
      message: error.message
    });
  }
});

/**
 * POST /api/system/monitoring/stop
 * Stop monitoring service
 */
router.post('/monitoring/stop', async (req, res) => {
  try {
    const { monitoringService, logger } = getServices(req);
    
    const status = monitoringService.getStatus();
    if (!status.isRunning) {
      return res.status(409).json({
        error: 'Monitoring service is not running'
      });
    }
    
    await monitoringService.stop();
    logger.info('Monitoring service stopped via API');
    
    res.json({
      message: 'Monitoring service stopped successfully'
    });

  } catch (error) {
    const { logger } = getServices(req);
    logger.error('Failed to stop monitoring service:', error);
    res.status(500).json({
      error: 'Failed to stop monitoring service',
      message: error.message
    });
  }
});

/**
 * POST /api/system/maintenance
 * Perform system maintenance tasks
 */
router.post('/maintenance', async (req, res) => {
  try {
    const { monitoringService, logger } = getServices(req);
    
    logger.info('Starting manual maintenance tasks');
    
    await monitoringService.performMaintenance();
    
    res.json({
      message: 'Maintenance tasks completed successfully'
    });

  } catch (error) {
    const { logger } = getServices(req);
    logger.error('Failed to perform maintenance:', error);
    res.status(500).json({
      error: 'Failed to perform maintenance tasks',
      message: error.message
    });
  }
});

/**
 * GET /api/system/logs
 * Get recent system logs
 */
router.get('/logs', [
  query('lines').optional().isInt({ min: 10, max: 1000 }).toInt(),
  query('level').optional().isIn(['error', 'warn', 'info', 'debug', 'verbose'])
], handleValidationErrors, async (req, res) => {
  try {
    const { logger } = getServices(req);
    const lines = req.query.lines || 100;
    const level = req.query.level;
    
    let logs = await logger.getRecentLogs(lines);
    
    // Filter by level if specified
    if (level) {
      logs = logs.filter(log => log.level === level);
    }
    
    res.json({
      logs,
      total: logs.length,
      filters: {
        lines,
        level
      }
    });

  } catch (error) {
    const { logger } = getServices(req);
    logger.error('Failed to get logs:', error);
    res.status(500).json({
      error: 'Failed to retrieve logs',
      message: error.message
    });
  }
});

/**
 * DELETE /api/system/logs
 * Clear system logs
 */
router.delete('/logs', async (req, res) => {
  try {
    const { logger } = getServices(req);
    
    const success = await logger.clearLogs();
    
    if (success) {
      res.json({
        message: 'System logs cleared successfully'
      });
    } else {
      res.status(500).json({
        error: 'Failed to clear system logs'
      });
    }

  } catch (error) {
    const { logger } = getServices(req);
    logger.error('Failed to clear logs:', error);
    res.status(500).json({
      error: 'Failed to clear logs',
      message: error.message
    });
  }
});

/**
 * GET /api/system/database/stats
 * Get database statistics
 */
router.get('/database/stats', async (req, res) => {
  try {
    const { dbManager } = getServices(req);
    
    const stats = await dbManager.getDatabaseStats();
    
    res.json({
      statistics: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const { logger } = getServices(req);
    logger.error('Failed to get database stats:', error);
    res.status(500).json({
      error: 'Failed to retrieve database statistics',
      message: error.message
    });
  }
});

/**
 * POST /api/system/database/cleanup
 * Clean up old database records
 */
router.post('/database/cleanup', async (req, res) => {
  try {
    const { dbManager, logger } = getServices(req);
    
    await dbManager.cleanupOldData();
    logger.info('Database cleanup completed via API');
    
    res.json({
      message: 'Database cleanup completed successfully'
    });

  } catch (error) {
    const { logger } = getServices(req);
    logger.error('Failed to cleanup database:', error);
    res.status(500).json({
      error: 'Failed to cleanup database',
      message: error.message
    });
  }
});

/**
 * GET /api/system/health
 * Get system health check
 */
router.get('/health', async (req, res) => {
  try {
    const { monitoringService, dbManager } = getServices(req);
    
    const health = {
      status: 'healthy',
      checks: {
        monitoring: {
          status: 'healthy',
          running: monitoringService.getStatus().isRunning
        },
        database: {
          status: 'healthy',
          connected: true
        },
        memory: {
          status: 'healthy',
          usage: process.memoryUsage()
        }
      },
      timestamp: new Date().toISOString()
    };
    
    // Check memory usage
    const memUsage = process.memoryUsage();
    const memUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    if (memUsagePercent > 90) {
      health.checks.memory.status = 'critical';
      health.status = 'degraded';
    } else if (memUsagePercent > 75) {
      health.checks.memory.status = 'warning';
      if (health.status === 'healthy') {
        health.status = 'degraded';
      }
    }
    
    // Test database connection
    try {
      await dbManager.get('SELECT 1');
    } catch (error) {
      health.checks.database.status = 'critical';
      health.checks.database.connected = false;
      health.status = 'unhealthy';
    }
    
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(health);

  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/system/version
 * Get system version information
 */
router.get('/version', async (req, res) => {
  try {
    // Read package.json for version info
    const packageJson = await import('../../package.json', { assert: { type: 'json' } });
    
    res.json({
      name: packageJson.default.name,
      version: packageJson.default.version,
      description: packageJson.default.description,
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      buildDate: new Date().toISOString() // In real app, this would be build time
    });

  } catch (error) {
    const { logger } = getServices(req);
    logger.error('Failed to get version info:', error);
    res.status(500).json({
      error: 'Failed to retrieve version information',
      message: error.message
    });
  }
});

export default router;