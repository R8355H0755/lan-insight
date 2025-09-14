import express from 'express';
import { param, query, validationResult } from 'express-validator';

const router = express.Router();

// Middleware to get services from app locals
const getServices = (req) => ({
  dbManager: req.app.locals.dbManager,
  monitoringService: req.app.locals.monitoringService,
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
 * GET /api/metrics/overview
 * Get system-wide metrics overview
 */
router.get('/overview', async (req, res) => {
  try {
    const { monitoringService, dbManager } = getServices(req);
    
    const devices = monitoringService.getDevices();
    const status = monitoringService.getStatus();
    
    // Calculate aggregate metrics
    let totalDevices = devices.length;
    let onlineDevices = devices.filter(d => d.status === 'online').length;
    let warningDevices = devices.filter(d => d.status === 'warning').length;
    let criticalDevices = devices.filter(d => d.status === 'critical').length;
    let offlineDevices = devices.filter(d => d.status === 'offline').length;
    
    // Calculate average resource usage
    const onlineDevicesWithMetrics = devices.filter(d => d.status === 'online' && d.cpu !== undefined);
    const avgCpu = onlineDevicesWithMetrics.length > 0 
      ? onlineDevicesWithMetrics.reduce((sum, d) => sum + (d.cpu || 0), 0) / onlineDevicesWithMetrics.length 
      : 0;
    const avgMemory = onlineDevicesWithMetrics.length > 0 
      ? onlineDevicesWithMetrics.reduce((sum, d) => sum + (d.memory || 0), 0) / onlineDevicesWithMetrics.length 
      : 0;
    const avgDisk = onlineDevicesWithMetrics.length > 0 
      ? onlineDevicesWithMetrics.reduce((sum, d) => sum + (d.disk || 0), 0) / onlineDevicesWithMetrics.length 
      : 0;
    
    // Get database statistics
    const dbStats = await dbManager.getDatabaseStats();
    
    res.json({
      overview: {
        devices: {
          total: totalDevices,
          online: onlineDevices,
          warning: warningDevices,
          critical: criticalDevices,
          offline: offlineDevices
        },
        averageUsage: {
          cpu: Math.round(avgCpu),
          memory: Math.round(avgMemory),
          disk: Math.round(avgDisk)
        },
        monitoring: {
          isRunning: status.isRunning,
          refreshInterval: status.refreshInterval,
          lastScanTime: status.lastScanTime,
          webSocketClients: status.webSocketClients
        },
        database: {
          totalMetrics: dbStats.metrics || 0,
          totalAlerts: dbStats.alerts || 0,
          databaseSize: dbStats.database_size_bytes || 0
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const { logger } = getServices(req);
    logger.error('Failed to get metrics overview:', error);
    res.status(500).json({
      error: 'Failed to retrieve metrics overview',
      message: error.message
    });
  }
});

/**
 * GET /api/metrics/devices
 * Get current metrics for all devices
 */
router.get('/devices', async (req, res) => {
  try {
    const { monitoringService, dbManager } = getServices(req);
    
    const devices = monitoringService.getDevices();
    
    // Get latest metrics for each device
    const devicesWithMetrics = await Promise.all(
      devices.map(async (device) => {
        try {
          const metrics = await dbManager.getLatestMetrics(device.id, [
            'cpu_usage', 'memory_usage', 'disk_usage'
          ]);
          
          const systemInfo = await dbManager.getLatestSystemInfo(device.id);
          
          const metricsMap = {};
          metrics.forEach(metric => {
            metricsMap[metric.metric_type] = {
              value: metric.value,
              unit: metric.unit,
              timestamp: metric.timestamp
            };
          });
          
          return {
            id: device.id,
            ip: device.ip,
            hostname: device.hostname,
            status: device.status,
            lastSeen: device.lastSeen,
            metrics: metricsMap,
            systemInfo: systemInfo ? {
              uptime: systemInfo.uptime,
              processes: systemInfo.processes,
              users: systemInfo.users,
              timestamp: systemInfo.timestamp
            } : null
          };
        } catch (error) {
          return {
            id: device.id,
            ip: device.ip,
            hostname: device.hostname,
            status: device.status,
            lastSeen: device.lastSeen,
            metrics: {},
            systemInfo: null,
            error: error.message
          };
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
    logger.error('Failed to get device metrics:', error);
    res.status(500).json({
      error: 'Failed to retrieve device metrics',
      message: error.message
    });
  }
});

/**
 * GET /api/metrics/device/:deviceId
 * Get detailed metrics for a specific device
 */
router.get('/device/:deviceId', [
  param('deviceId').isUUID().withMessage('Valid device ID is required'),
  query('hours').optional().isInt({ min: 1, max: 168 }).toInt(), // Max 1 week
  query('metricTypes').optional().isString()
], handleValidationErrors, async (req, res) => {
  try {
    const { dbManager } = getServices(req);
    const deviceId = req.params.deviceId;
    const hours = req.query.hours || 24;
    const metricTypes = req.query.metricTypes ? req.query.metricTypes.split(',') : null;
    
    // Verify device exists
    const device = await dbManager.getDevice(deviceId);
    if (!device) {
      return res.status(404).json({
        error: 'Device not found',
        deviceId
      });
    }
    
    // Get latest metrics
    const latestMetrics = await dbManager.getLatestMetrics(deviceId, metricTypes);
    
    // Get metrics history
    const defaultMetricTypes = ['cpu_usage', 'memory_usage', 'disk_usage'];
    const typesToQuery = metricTypes || defaultMetricTypes;
    
    const history = {};
    for (const type of typesToQuery) {
      history[type] = await dbManager.getMetricsHistory(deviceId, type, hours);
    }
    
    // Get metrics summary
    const summary = await dbManager.getDeviceMetricsSummary(deviceId);
    
    // Get system info
    const systemInfo = await dbManager.getLatestSystemInfo(deviceId);
    
    // Get network interfaces
    const networkInterfaces = await dbManager.getNetworkInterfaces(deviceId);
    
    res.json({
      deviceId,
      device: {
        id: device.id,
        ip: device.ip,
        hostname: device.hostname,
        description: device.description,
        status: device.status,
        lastSeen: device.last_seen
      },
      metrics: {
        latest: latestMetrics,
        history,
        summary
      },
      systemInfo,
      networkInterfaces,
      queryParams: {
        hours,
        metricTypes: typesToQuery
      }
    });

  } catch (error) {
    const { logger } = getServices(req);
    logger.error(`Failed to get metrics for device ${req.params.deviceId}:`, error);
    res.status(500).json({
      error: 'Failed to retrieve device metrics',
      message: error.message
    });
  }
});

/**
 * GET /api/metrics/history
 * Get historical metrics across all devices
 */
router.get('/history', [
  query('metricType').optional().isIn(['cpu_usage', 'memory_usage', 'disk_usage']),
  query('hours').optional().isInt({ min: 1, max: 168 }).toInt(),
  query('deviceIds').optional().isString()
], handleValidationErrors, async (req, res) => {
  try {
    const { dbManager, monitoringService } = getServices(req);
    const metricType = req.query.metricType || 'cpu_usage';
    const hours = req.query.hours || 24;
    const deviceIds = req.query.deviceIds ? req.query.deviceIds.split(',') : null;
    
    let devices = monitoringService.getDevices();
    
    // Filter devices if specific IDs requested
    if (deviceIds) {
      devices = devices.filter(d => deviceIds.includes(d.id));
    }
    
    const history = {};
    
    for (const device of devices) {
      try {
        const deviceHistory = await dbManager.getMetricsHistory(device.id, metricType, hours);
        history[device.id] = {
          device: {
            id: device.id,
            ip: device.ip,
            hostname: device.hostname
          },
          data: deviceHistory
        };
      } catch (error) {
        history[device.id] = {
          device: {
            id: device.id,
            ip: device.ip,
            hostname: device.hostname
          },
          data: [],
          error: error.message
        };
      }
    }
    
    res.json({
      metricType,
      hours,
      deviceCount: Object.keys(history).length,
      history,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const { logger } = getServices(req);
    logger.error('Failed to get historical metrics:', error);
    res.status(500).json({
      error: 'Failed to retrieve historical metrics',
      message: error.message
    });
  }
});

/**
 * GET /api/metrics/aggregated
 * Get aggregated metrics across time periods
 */
router.get('/aggregated', [
  query('metricType').optional().isIn(['cpu_usage', 'memory_usage', 'disk_usage']),
  query('period').optional().isIn(['hour', 'day', 'week']),
  query('deviceId').optional().isUUID()
], handleValidationErrors, async (req, res) => {
  try {
    const { dbManager } = getServices(req);
    const metricType = req.query.metricType || 'cpu_usage';
    const period = req.query.period || 'hour';
    const deviceId = req.query.deviceId;
    
    // Calculate time grouping based on period
    let timeFormat, hours;
    switch (period) {
      case 'hour':
        timeFormat = '%Y-%m-%d %H:00:00';
        hours = 24;
        break;
      case 'day':
        timeFormat = '%Y-%m-%d 00:00:00';
        hours = 24 * 7; // 1 week
        break;
      case 'week':
        timeFormat = '%Y-%W';
        hours = 24 * 7 * 12; // 12 weeks
        break;
      default:
        timeFormat = '%Y-%m-%d %H:00:00';
        hours = 24;
    }
    
    let query = `
      SELECT 
        strftime('${timeFormat}', timestamp) as time_period,
        AVG(value) as avg_value,
        MIN(value) as min_value,
        MAX(value) as max_value,
        COUNT(*) as sample_count
      FROM metrics 
      WHERE metric_type = ? 
        AND timestamp >= datetime('now', '-${hours} hours')
    `;
    
    const params = [metricType];
    
    if (deviceId) {
      query += ' AND device_id = ?';
      params.push(deviceId);
    }
    
    query += ' GROUP BY time_period ORDER BY time_period';
    
    const results = await dbManager.all(query, params);
    
    res.json({
      metricType,
      period,
      deviceId: deviceId || 'all',
      hours,
      aggregatedData: results.map(row => ({
        timePeriod: row.time_period,
        average: Math.round(row.avg_value * 100) / 100,
        minimum: Math.round(row.min_value * 100) / 100,
        maximum: Math.round(row.max_value * 100) / 100,
        sampleCount: row.sample_count
      })),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const { logger } = getServices(req);
    logger.error('Failed to get aggregated metrics:', error);
    res.status(500).json({
      error: 'Failed to retrieve aggregated metrics',
      message: error.message
    });
  }
});

/**
 * GET /api/metrics/top-usage
 * Get devices with highest resource usage
 */
router.get('/top-usage', [
  query('metricType').optional().isIn(['cpu_usage', 'memory_usage', 'disk_usage']),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt()
], handleValidationErrors, async (req, res) => {
  try {
    const { dbManager } = getServices(req);
    const metricType = req.query.metricType || 'cpu_usage';
    const limit = req.query.limit || 10;
    
    const query = `
      SELECT 
        d.id,
        d.ip,
        d.hostname,
        d.status,
        m.value,
        m.timestamp
      FROM devices d
      JOIN (
        SELECT 
          device_id,
          value,
          timestamp,
          ROW_NUMBER() OVER (PARTITION BY device_id ORDER BY timestamp DESC) as rn
        FROM metrics 
        WHERE metric_type = ?
          AND timestamp >= datetime('now', '-1 hour')
      ) m ON d.id = m.device_id AND m.rn = 1
      WHERE d.status = 'online'
      ORDER BY m.value DESC
      LIMIT ?
    `;
    
    const results = await dbManager.all(query, [metricType, limit]);
    
    res.json({
      metricType,
      limit,
      topDevices: results.map(row => ({
        device: {
          id: row.id,
          ip: row.ip,
          hostname: row.hostname,
          status: row.status
        },
        value: Math.round(row.value * 100) / 100,
        timestamp: row.timestamp
      })),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const { logger } = getServices(req);
    logger.error('Failed to get top usage metrics:', error);
    res.status(500).json({
      error: 'Failed to retrieve top usage metrics',
      message: error.message
    });
  }
});

/**
 * GET /api/metrics/thresholds
 * Get current monitoring thresholds
 */
router.get('/thresholds', async (req, res) => {
  try {
    const { monitoringService } = getServices(req);
    
    const status = monitoringService.getStatus();
    
    res.json({
      thresholds: status.thresholds,
      refreshInterval: status.refreshInterval
    });

  } catch (error) {
    const { logger } = getServices(req);
    logger.error('Failed to get thresholds:', error);
    res.status(500).json({
      error: 'Failed to retrieve thresholds',
      message: error.message
    });
  }
});

/**
 * GET /api/metrics/realtime
 * Get real-time metrics for dashboard
 */
router.get('/realtime', async (req, res) => {
  try {
    const { monitoringService, dbManager } = getServices(req);
    
    const devices = monitoringService.getDevices();
    const status = monitoringService.getStatus();
    
    // Get latest metrics for all devices
    const realtimeData = await Promise.all(
      devices.map(async (device) => {
        try {
          const metrics = await dbManager.getLatestMetrics(device.id, [
            'cpu_usage', 'memory_usage', 'disk_usage'
          ]);
          
          const metricsMap = {};
          metrics.forEach(metric => {
            metricsMap[metric.metric_type] = {
              value: metric.value,
              timestamp: metric.timestamp
            };
          });
          
          return {
            id: device.id,
            ip: device.ip,
            hostname: device.hostname,
            status: device.status,
            cpu: metricsMap.cpu_usage?.value || 0,
            memory: metricsMap.memory_usage?.value || 0,
            disk: metricsMap.disk_usage?.value || 0,
            lastSeen: device.lastSeen,
            uptime: device.uptime || 0
          };
        } catch (error) {
          return {
            id: device.id,
            ip: device.ip,
            hostname: device.hostname,
            status: 'error',
            cpu: 0,
            memory: 0,
            disk: 0,
            lastSeen: device.lastSeen,
            uptime: 0,
            error: error.message
          };
        }
      })
    );
    
    res.json({
      devices: realtimeData,
      monitoring: {
        isRunning: status.isRunning,
        refreshInterval: status.refreshInterval,
        deviceCount: status.deviceCount,
        lastScanTime: status.lastScanTime
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const { logger } = getServices(req);
    logger.error('Failed to get realtime metrics:', error);
    res.status(500).json({
      error: 'Failed to retrieve realtime metrics',
      message: error.message
    });
  }
});

export default router;