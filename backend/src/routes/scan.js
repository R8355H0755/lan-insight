import express from 'express';
import { body, query, validationResult } from 'express-validator';

const router = express.Router();

// Middleware to get services from app locals
const getServices = (req) => ({
  monitoringService: req.app.locals.monitoringService,
  networkScanner: req.app.locals.networkScanner,
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
 * POST /api/scan/start
 * Start network scan
 */
router.post('/start', [
  body('range').notEmpty().withMessage('IP range is required'),
  body('options.timeout').optional().isInt({ min: 1000, max: 30000 }),
  body('options.concurrent').optional().isInt({ min: 1, max: 100 }),
  body('options.includePorts').optional().isBoolean()
], handleValidationErrors, async (req, res) => {
  try {
    const { monitoringService, networkScanner, logger } = getServices(req);
    const { range, options = {} } = req.body;
    
    // Check if scan is already in progress
    const scanStatus = networkScanner.getScanStatus();
    if (scanStatus.isScanning) {
      return res.status(409).json({
        error: 'Scan already in progress',
        currentScan: scanStatus
      });
    }
    
    logger.info(`Starting network scan for range: ${range}`);
    
    // Start scan asynchronously
    monitoringService.scanNetwork(range, options)
      .then(discoveredHosts => {
        logger.info(`Network scan completed. Found ${discoveredHosts.length} hosts`);
      })
      .catch(error => {
        logger.error('Network scan failed:', error);
      });
    
    res.json({
      message: 'Network scan started',
      range,
      options,
      scanId: Date.now().toString()
    });
    
  } catch (error) {
    const { logger } = getServices(req);
    logger.error('Failed to start network scan:', error);
    res.status(500).json({
      error: 'Failed to start network scan',
      message: error.message
    });
  }
});

/**
 * GET /api/scan/status
 * Get current scan status
 */
router.get('/status', async (req, res) => {
  try {
    const { networkScanner, monitoringService } = getServices(req);
    
    const scanStatus = networkScanner.getScanStatus();
    const monitoringStatus = monitoringService.getStatus();
    
    res.json({
      scan: scanStatus,
      monitoring: {
        isRunning: monitoringStatus.isRunning,
        deviceCount: monitoringStatus.deviceCount,
        lastScanTime: monitoringStatus.lastScanTime,
        refreshInterval: monitoringStatus.refreshInterval
      }
    });
    
  } catch (error) {
    const { logger } = getServices(req);
    logger.error('Failed to get scan status:', error);
    res.status(500).json({
      error: 'Failed to get scan status',
      message: error.message
    });
  }
});

/**
 * POST /api/scan/stop
 * Stop current scan
 */
router.post('/stop', async (req, res) => {
  try {
    const { networkScanner, logger } = getServices(req);
    
    const scanStatus = networkScanner.getScanStatus();
    if (!scanStatus.isScanning) {
      return res.status(400).json({
        error: 'No scan in progress'
      });
    }
    
    networkScanner.stopScan();
    logger.info('Network scan stopped by user request');
    
    res.json({
      message: 'Network scan stopped'
    });
    
  } catch (error) {
    const { logger } = getServices(req);
    logger.error('Failed to stop network scan:', error);
    res.status(500).json({
      error: 'Failed to stop network scan',
      message: error.message
    });
  }
});

/**
 * GET /api/scan/history
 * Get scan history
 */
router.get('/history', [
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
], handleValidationErrors, async (req, res) => {
  try {
    const { dbManager } = getServices(req);
    const limit = req.query.limit || 50;
    
    const history = await dbManager.getScanHistory(limit);
    
    res.json({
      history,
      total: history.length
    });
    
  } catch (error) {
    const { logger } = getServices(req);
    logger.error('Failed to get scan history:', error);
    res.status(500).json({
      error: 'Failed to retrieve scan history',
      message: error.message
    });
  }
});

/**
 * POST /api/scan/ping
 * Ping a specific IP address
 */
router.post('/ping', [
  body('ip').isIP().withMessage('Valid IP address is required'),
  body('timeout').optional().isInt({ min: 1000, max: 10000 })
], handleValidationErrors, async (req, res) => {
  try {
    const { networkScanner, logger } = getServices(req);
    const { ip, timeout = 3000 } = req.body;
    
    const startTime = Date.now();
    
    try {
      const result = await networkScanner.pingHost(ip, timeout);
      const responseTime = Date.now() - startTime;
      
      logger.debug(`Ping test for ${ip}: ${result.alive ? 'success' : 'failed'}`);
      
      res.json({
        ip,
        alive: result.alive,
        responseTime,
        pingTime: result.time
      });
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      res.json({
        ip,
        alive: false,
        responseTime,
        error: error.message
      });
    }
    
  } catch (error) {
    const { logger } = getServices(req);
    logger.error('Failed to ping host:', error);
    res.status(500).json({
      error: 'Failed to ping host',
      message: error.message
    });
  }
});

/**
 * POST /api/scan/port-scan
 * Scan ports on a specific IP address
 */
router.post('/port-scan', [
  body('ip').isIP().withMessage('Valid IP address is required'),
  body('ports').optional().isArray().withMessage('Ports must be an array'),
  body('ports.*').optional().isInt({ min: 1, max: 65535 }),
  body('timeout').optional().isInt({ min: 500, max: 10000 })
], handleValidationErrors, async (req, res) => {
  try {
    const { networkScanner, logger } = getServices(req);
    const { ip, ports, timeout = 2000 } = req.body;
    
    const startTime = Date.now();
    
    let openPorts;
    if (ports && ports.length > 0) {
      // Scan specific ports
      openPorts = [];
      for (const port of ports) {
        try {
          const isOpen = await networkScanner.checkPort(ip, port, timeout);
          if (isOpen) {
            openPorts.push({ port, status: 'open' });
          }
        } catch (error) {
          // Port is closed or filtered
        }
      }
    } else {
      // Scan common ports
      openPorts = await networkScanner.scanCommonPorts(ip);
    }
    
    const scanTime = Date.now() - startTime;
    
    logger.debug(`Port scan for ${ip} completed in ${scanTime}ms. Found ${openPorts.length} open ports`);
    
    res.json({
      ip,
      openPorts,
      scanTime,
      portsScanned: ports ? ports.length : 'common'
    });
    
  } catch (error) {
    const { logger } = getServices(req);
    logger.error('Failed to scan ports:', error);
    res.status(500).json({
      error: 'Failed to scan ports',
      message: error.message
    });
  }
});

/**
 * GET /api/scan/discovered-hosts
 * Get currently discovered hosts
 */
router.get('/discovered-hosts', async (req, res) => {
  try {
    const { networkScanner } = getServices(req);
    
    const scanStatus = networkScanner.getScanStatus();
    
    res.json({
      hosts: scanStatus.activeHosts,
      total: scanStatus.totalActiveHosts,
      scanInProgress: scanStatus.isScanning,
      progress: scanStatus.progress
    });
    
  } catch (error) {
    const { logger } = getServices(req);
    logger.error('Failed to get discovered hosts:', error);
    res.status(500).json({
      error: 'Failed to get discovered hosts',
      message: error.message
    });
  }
});

/**
 * POST /api/scan/clear-cache
 * Clear discovered hosts cache
 */
router.post('/clear-cache', async (req, res) => {
  try {
    const { networkScanner, logger } = getServices(req);
    
    const scanStatus = networkScanner.getScanStatus();
    const clearedCount = scanStatus.totalActiveHosts;
    
    networkScanner.clearCache();
    logger.info(`Cleared ${clearedCount} discovered hosts from cache`);
    
    res.json({
      message: 'Discovered hosts cache cleared',
      clearedCount
    });
    
  } catch (error) {
    const { logger } = getServices(req);
    logger.error('Failed to clear cache:', error);
    res.status(500).json({
      error: 'Failed to clear cache',
      message: error.message
    });
  }
});

/**
 * POST /api/scan/validate-range
 * Validate IP range format
 */
router.post('/validate-range', [
  body('range').notEmpty().withMessage('IP range is required')
], handleValidationErrors, async (req, res) => {
  try {
    const { networkScanner } = getServices(req);
    const { range } = req.body;
    
    try {
      const ips = networkScanner.parseIPRange(range);
      
      res.json({
        valid: true,
        range,
        totalIPs: ips.length,
        firstIP: ips[0],
        lastIP: ips[ips.length - 1],
        sampleIPs: ips.slice(0, 5) // Show first 5 IPs as sample
      });
      
    } catch (error) {
      res.json({
        valid: false,
        range,
        error: error.message
      });
    }
    
  } catch (error) {
    const { logger } = getServices(req);
    logger.error('Failed to validate IP range:', error);
    res.status(500).json({
      error: 'Failed to validate IP range',
      message: error.message
    });
  }
});

/**
 * GET /api/scan/presets
 * Get common IP range presets
 */
router.get('/presets', async (req, res) => {
  try {
    const presets = [
      {
        name: 'Home Network (192.168.1.x)',
        range: '192.168.1.1-254',
        description: 'Common home router network'
      },
      {
        name: 'Home Network (192.168.0.x)',
        range: '192.168.0.1-254',
        description: 'Alternative home router network'
      },
      {
        name: 'Office Network (10.0.0.x)',
        range: '10.0.0.1-254',
        description: 'Small office network'
      },
      {
        name: 'Enterprise (172.16.0.x)',
        range: '172.16.0.1-254',
        description: 'Enterprise private network'
      },
      {
        name: 'Small Range (192.168.1.1-50)',
        range: '192.168.1.1-50',
        description: 'Quick scan of first 50 IPs'
      },
      {
        name: 'Server Range (192.168.1.100-150)',
        range: '192.168.1.100-150',
        description: 'Typical server IP range'
      }
    ];
    
    res.json({
      presets
    });
    
  } catch (error) {
    const { logger } = getServices(req);
    logger.error('Failed to get scan presets:', error);
    res.status(500).json({
      error: 'Failed to get scan presets',
      message: error.message
    });
  }
});

export default router;