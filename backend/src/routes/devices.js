import express from 'express';
import { body, param, query, validationResult } from 'express-validator';

const router = express.Router();

// Middleware to get services from app locals (will be set in server.js)
const getServices = (req) => ({
  dbManager: req.app.locals.dbManager,
  monitoringService: req.app.locals.monitoringService,
  snmpCollector: req.app.locals.snmpCollector,
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
 * GET /api/devices
 * Get all monitored devices
 */
router.get('/', async (req, res) => {
  try {
    const { monitoringService, logger } = getServices(req);
    
    const devices = monitoringService.getDevices();
    
    // Add current metrics for each device
    const devicesWithMetrics = await Promise.all(
      devices.map(async (device) => {
        try {
          const metrics = await req.app.locals.dbManager.getLatestMetrics(device.id, [
            'cpu_usage', 'memory_usage', 'disk_usage'
          ]);
          
          const metricsMap = {};
          metrics.forEach(metric => {
            metricsMap[metric.metric_type] = {
              value: metric.value,
              unit: metric.unit,
              timestamp: metric.timestamp
            };
          });
          
          return {
            ...device,
            metrics: metricsMap
          };
        } catch (error) {
          logger.error(`Failed to get metrics for device ${device.id}:`, error);
          return device;
        }
      })
    );
    
    res.json({
      devices: devicesWithMetrics,
      total: devicesWithMetrics.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    const { logger } = getServices(req);
    logger.error('Failed to get devices:', error);
    res.status(500).json({
      error: 'Failed to retrieve devices',
      message: error.message
    });
  }
});

/**
 * GET /api/devices/:id
 * Get specific device details
 */
router.get('/:id', [
  param('id').notEmpty().withMessage('Device ID is required')
], handleValidationErrors, async (req, res) => {
  try {
    const { dbManager, logger } = getServices(req);
    const deviceId = req.params.id;
    
    // Get device info
    const device = await dbManager.getDevice(deviceId);
    if (!device) {
      return res.status(404).json({
        error: 'Device not found',
        deviceId
      });
    }
    
    // Get latest metrics
    const metrics = await dbManager.getLatestMetrics(deviceId);
    
    // Get system info
    const systemInfo = await dbManager.getLatestSystemInfo(deviceId);
    
    // Get network interfaces
    const networkInterfaces = await dbManager.getNetworkInterfaces(deviceId);
    
    // Get device alerts
    const alerts = await req.app.locals.alertManager.getDeviceAlerts(deviceId);
    
    res.json({
      device: {
        ...device,
        metrics,
        systemInfo,
        networkInterfaces,
        alerts
      }
    });
    
  } catch (error) {
    const { logger } = getServices(req);
    logger.error(`Failed to get device ${req.params.id}:`, error);
    res.status(500).json({
      error: 'Failed to retrieve device',
      message: error.message
    });
  }
});

/**
 * POST /api/devices
 * Add a new device manually
 */
router.post('/', [
  body('ip').isIP().withMessage('Valid IP address is required'),
  body('hostname').optional().isLength({ min: 1, max: 255 }),
  body('community').optional().isLength({ min: 1, max: 50 }),
  body('description').optional().isLength({ max: 500 }),
  body('location').optional().isLength({ max: 255 }),
  body('contact').optional().isLength({ max: 255 })
], handleValidationErrors, async (req, res) => {
  try {
    const { dbManager, snmpCollector, monitoringService, logger } = getServices(req);
    const { ip, hostname, community = 'public', description, location, contact } = req.body;
    
    // Check if device already exists
    const existingDevice = await dbManager.getDeviceByIP(ip);
    if (existingDevice) {
      return res.status(409).json({
        error: 'Device already exists',
        device: existingDevice
      });
    }
    
    // Try to collect system information via SNMP
    let systemInfo = null;
    try {
      systemInfo = await snmpCollector.collectSystemInfo(ip, community);
    } catch (error) {
      logger.warn(`Failed to collect SNMP info for ${ip}:`, error);
    }
    
    // Create device
    const { v4: uuidv4 } = await import('uuid');
    const deviceId = uuidv4();
    const deviceData = {
      id: deviceId,
      ip,
      hostname: hostname || systemInfo?.hostname || ip,
      description: description || systemInfo?.description || 'Manually added device',
      location: location || systemInfo?.location || '',
      contact: contact || systemInfo?.contact || '',
      community,
      status: 'unknown'
    };
    
    await dbManager.saveDevice(deviceData);
    
    // Add to monitoring service
    monitoringService.currentDevices.set(ip, {
      ...deviceData,
      lastSeen: new Date(),
      firstSeen: new Date()
    });
    
    logger.info(`Device added manually: ${ip} (${deviceData.hostname})`);
    
    res.status(201).json({
      message: 'Device added successfully',
      device: deviceData
    });
    
  } catch (error) {
    const { logger } = getServices(req);
    logger.error('Failed to add device:', error);
    res.status(500).json({
      error: 'Failed to add device',
      message: error.message
    });
  }
});

/**
 * PUT /api/devices/:id
 * Update device information
 */
router.put('/:id', [
  param('id').notEmpty().withMessage('Device ID is required'),
  body('hostname').optional().isLength({ min: 1, max: 255 }),
  body('community').optional().isLength({ min: 1, max: 50 }),
  body('description').optional().isLength({ max: 500 }),
  body('location').optional().isLength({ max: 255 }),
  body('contact').optional().isLength({ max: 255 })
], handleValidationErrors, async (req, res) => {
  try {
    const { dbManager, monitoringService, logger } = getServices(req);
    const deviceId = req.params.id;
    
    // Get existing device
    const existingDevice = await dbManager.getDevice(deviceId);
    if (!existingDevice) {
      return res.status(404).json({
        error: 'Device not found',
        deviceId
      });
    }
    
    // Update device data
    const updatedData = {
      ...existingDevice,
      ...req.body,
      updated_at: new Date().toISOString()
    };
    
    await dbManager.saveDevice(updatedData);
    
    // Update in monitoring service
    const monitoredDevice = monitoringService.currentDevices.get(existingDevice.ip);
    if (monitoredDevice) {
      Object.assign(monitoredDevice, updatedData);
    }
    
    logger.info(`Device updated: ${existingDevice.ip} (${updatedData.hostname})`);
    
    res.json({
      message: 'Device updated successfully',
      device: updatedData
    });
    
  } catch (error) {
    const { logger } = getServices(req);
    logger.error(`Failed to update device ${req.params.id}:`, error);
    res.status(500).json({
      error: 'Failed to update device',
      message: error.message
    });
  }
});

/**
 * DELETE /api/devices/:id
 * Remove a device from monitoring
 */
router.delete('/:id', [
  param('id').notEmpty().withMessage('Device ID is required')
], handleValidationErrors, async (req, res) => {
  try {
    const { dbManager, monitoringService, logger } = getServices(req);
    const deviceId = req.params.id;
    
    // Get device info before deletion
    const device = await dbManager.getDevice(deviceId);
    if (!device) {
      return res.status(404).json({
        error: 'Device not found',
        deviceId
      });
    }
    
    // Remove from database (cascade will remove related data)
    await dbManager.deleteDevice(deviceId);
    
    // Remove from monitoring service
    monitoringService.currentDevices.delete(device.ip);
    
    logger.info(`Device removed: ${device.ip} (${device.hostname})`);
    
    res.json({
      message: 'Device removed successfully',
      device
    });
    
  } catch (error) {
    const { logger } = getServices(req);
    logger.error(`Failed to remove device ${req.params.id}:`, error);
    res.status(500).json({
      error: 'Failed to remove device',
      message: error.message
    });
  }
});

/**
 * POST /api/devices/:id/test-snmp
 * Test SNMP connectivity for a device
 */
router.post('/:id/test-snmp', [
  param('id').notEmpty().withMessage('Device ID is required'),
  body('community').optional().isLength({ min: 1, max: 50 })
], handleValidationErrors, async (req, res) => {
  try {
    const { dbManager, snmpCollector, logger } = getServices(req);
    const deviceId = req.params.id;
    const { community } = req.body;
    
    // Get device
    const device = await dbManager.getDevice(deviceId);
    if (!device) {
      return res.status(404).json({
        error: 'Device not found',
        deviceId
      });
    }
    
    const testCommunity = community || device.community || 'public';
    const startTime = Date.now();
    
    try {
      // Test SNMP connectivity
      const systemInfo = await snmpCollector.collectSystemInfo(device.ip, testCommunity);
      const responseTime = Date.now() - startTime;
      
      logger.info(`SNMP test successful for ${device.ip} with community '${testCommunity}'`);
      
      res.json({
        success: true,
        responseTime,
        systemInfo,
        community: testCommunity
      });
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      logger.warn(`SNMP test failed for ${device.ip} with community '${testCommunity}':`, error);
      
      res.json({
        success: false,
        responseTime,
        error: error.message,
        community: testCommunity
      });
    }
    
  } catch (error) {
    const { logger } = getServices(req);
    logger.error(`Failed to test SNMP for device ${req.params.id}:`, error);
    res.status(500).json({
      error: 'Failed to test SNMP connectivity',
      message: error.message
    });
  }
});

/**
 * POST /api/devices/:id/collect-metrics
 * Manually trigger metrics collection for a device
 */
router.post('/:id/collect-metrics', [
  param('id').notEmpty().withMessage('Device ID is required')
], handleValidationErrors, async (req, res) => {
  try {
    const { dbManager, snmpCollector, logger } = getServices(req);
    const deviceId = req.params.id;
    
    // Get device
    const device = await dbManager.getDevice(deviceId);
    if (!device) {
      return res.status(404).json({
        error: 'Device not found',
        deviceId
      });
    }
    
    const startTime = Date.now();
    
    // Collect all metrics
    const metrics = await snmpCollector.collectAllMetrics(device.ip, device.community);
    const collectionTime = Date.now() - startTime;
    
    // Save metrics to database
    const metricsToSave = [];
    
    if (metrics.cpu) {
      metricsToSave.push({
        type: 'cpu_usage',
        value: metrics.cpu.usage,
        unit: 'percent'
      });
    }
    
    if (metrics.memory) {
      metricsToSave.push({
        type: 'memory_usage',
        value: metrics.memory.usage,
        unit: 'percent'
      });
    }
    
    if (metrics.disk) {
      metricsToSave.push({
        type: 'disk_usage',
        value: metrics.disk.usage,
        unit: 'percent'
      });
    }
    
    if (metricsToSave.length > 0) {
      await dbManager.saveMetrics(deviceId, metricsToSave);
    }
    
    logger.info(`Manual metrics collection completed for ${device.ip} in ${collectionTime}ms`);
    
    res.json({
      success: true,
      collectionTime,
      metrics,
      savedMetrics: metricsToSave.length
    });
    
  } catch (error) {
    const { logger } = getServices(req);
    logger.error(`Failed to collect metrics for device ${req.params.id}:`, error);
    res.status(500).json({
      error: 'Failed to collect metrics',
      message: error.message
    });
  }
});

/**
 * GET /api/devices/:id/metrics/history
 * Get historical metrics for a device
 */
router.get('/:id/metrics/history', [
  param('id').notEmpty().withMessage('Device ID is required'),
  query('type').optional().isIn(['cpu_usage', 'memory_usage', 'disk_usage']),
  query('hours').optional().isInt({ min: 1, max: 168 }).toInt() // Max 1 week
], handleValidationErrors, async (req, res) => {
  try {
    const { dbManager, logger } = getServices(req);
    const deviceId = req.params.id;
    const metricType = req.query.type;
    const hours = req.query.hours || 24;
    
    // Verify device exists
    const device = await dbManager.getDevice(deviceId);
    if (!device) {
      return res.status(404).json({
        error: 'Device not found',
        deviceId
      });
    }
    
    let history;
    if (metricType) {
      // Get history for specific metric type
      history = await dbManager.getMetricsHistory(deviceId, metricType, hours);
    } else {
      // Get all metrics history
      const metricTypes = ['cpu_usage', 'memory_usage', 'disk_usage'];
      history = {};
      
      for (const type of metricTypes) {
        history[type] = await dbManager.getMetricsHistory(deviceId, type, hours);
      }
    }
    
    res.json({
      deviceId,
      metricType: metricType || 'all',
      hours,
      history
    });
    
  } catch (error) {
    const { logger } = getServices(req);
    logger.error(`Failed to get metrics history for device ${req.params.id}:`, error);
    res.status(500).json({
      error: 'Failed to retrieve metrics history',
      message: error.message
    });
  }
});

export default router;