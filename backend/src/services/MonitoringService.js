import { EventEmitter } from 'events';
import cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';
import LocalMetricsCollector from './LocalMetricsCollector.js';

export class MonitoringService extends EventEmitter {
  constructor({ dbManager, networkScanner, snmpCollector, alertManager, logger }) {
    super();
    this.dbManager = dbManager;
    this.networkScanner = networkScanner;
    this.snmpCollector = snmpCollector;
    this.alertManager = alertManager;
    this.logger = logger;
    this.localMetricsCollector = new LocalMetricsCollector(logger);
    
    this.isRunning = false;
    this.refreshInterval = 10; // seconds
    this.monitoringTimer = null;
    this.cleanupTask = null;
    this.webSocketClients = new Set();
    
    this.currentDevices = new Map();
    this.lastScanTime = null;
    this.scanInProgress = false;
    this.hasLocalDevice = false;
    
    // Thresholds (will be loaded from database)
    this.thresholds = {
      cpu: { warning: 75, critical: 90 },
      memory: { warning: 80, critical: 95 },
      disk: { warning: 85, critical: 95 }
    };
  }

  /**
   * Initialize the monitoring service
   */
  async initialize() {
    try {
      // Load configuration from database
      await this.loadConfiguration();
      
      // Load existing devices
      await this.loadDevices();
      
      // Initialize local device if no devices exist
      await this.initializeLocalDevice();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Start monitoring
      await this.start();
      
      // Schedule cleanup task (daily at 2 AM)
      this.cleanupTask = cron.schedule('0 2 * * *', async () => {
        await this.performMaintenance();
      });
      
      this.logger.info('Monitoring service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize monitoring service:', error);
      throw error;
    }
  }

  /**
   * Load configuration from database
   */
  async loadConfiguration() {
    try {
      const configs = await this.dbManager.getConfiguration();
      
      for (const config of configs) {
        switch (config.key) {
          case 'refresh_interval':
            this.refreshInterval = parseInt(config.value);
            break;
          case 'cpu_warning_threshold':
            this.thresholds.cpu.warning = parseInt(config.value);
            break;
          case 'cpu_critical_threshold':
            this.thresholds.cpu.critical = parseInt(config.value);
            break;
          case 'memory_warning_threshold':
            this.thresholds.memory.warning = parseInt(config.value);
            break;
          case 'memory_critical_threshold':
            this.thresholds.memory.critical = parseInt(config.value);
            break;
          case 'disk_warning_threshold':
            this.thresholds.disk.warning = parseInt(config.value);
            break;
          case 'disk_critical_threshold':
            this.thresholds.disk.critical = parseInt(config.value);
            break;
        }
      }
      
      this.logger.info('Configuration loaded:', {
        refreshInterval: this.refreshInterval,
        thresholds: this.thresholds
      });
    } catch (error) {
      this.logger.error('Failed to load configuration:', error);
    }
  }

  /**
   * Load existing devices from database
   */
  async loadDevices() {
    try {
      const devices = await this.dbManager.getAllDevices();
      
      for (const device of devices) {
        this.currentDevices.set(device.ip, {
          id: device.id,
          ip: device.ip,
          hostname: device.hostname,
          description: device.description,
          location: device.location,
          contact: device.contact,
          community: device.community,
          status: 'unknown', // Will be updated on next scan
          lastSeen: new Date(device.last_seen),
          firstSeen: new Date(device.first_seen),
          isLocal: device.id === 'localhost'
        });
      }
      
      this.logger.info(`Loaded ${devices.length} devices from database`);
    } catch (error) {
      this.logger.error('Failed to load devices:', error);
    }
  }

  /**
   * Initialize local device if no devices exist
   */
  async initializeLocalDevice() {
    try {
      // Check if we already have devices
      if (this.currentDevices.size > 0) {
        // Check if localhost device exists
        const hasLocalhost = Array.from(this.currentDevices.values()).some(device => device.isLocal);
        if (hasLocalhost) {
          this.hasLocalDevice = true;
          return;
        }
      }

      // Create localhost device
      const localDevice = this.localMetricsCollector.createLocalhostDevice();
      
      // Add to database
      await this.dbManager.saveDevice({
        id: localDevice.id,
        ip: localDevice.ip,
        hostname: localDevice.hostname,
        description: localDevice.description,
        location: localDevice.location,
        contact: localDevice.contact,
        community: localDevice.community
      });

      // Add to current devices
      this.currentDevices.set(localDevice.ip, {
        ...localDevice,
        status: 'online',
        lastSeen: new Date(),
        firstSeen: new Date(),
        isLocal: true
      });

      this.hasLocalDevice = true;
      this.logger.info('Local device initialized:', localDevice.hostname);
    } catch (error) {
      this.logger.error('Failed to initialize local device:', error);
    }
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Network scanner events
    this.networkScanner.on('scanStarted', (data) => {
      this.scanInProgress = true;
      this.broadcastToClients('scanStarted', data);
    });

    this.networkScanner.on('scanProgress', (data) => {
      this.broadcastToClients('scanProgress', data);
    });

    this.networkScanner.on('hostDiscovered', (hostInfo) => {
      this.broadcastToClients('hostDiscovered', hostInfo);
    });

    this.networkScanner.on('scanCompleted', async (data) => {
      this.scanInProgress = false;
      this.lastScanTime = new Date();
      
      // Save scan history
      await this.dbManager.saveScanHistory({
        scan_range: data.scanRange || 'unknown',
        total_ips: data.totalScanned,
        discovered_hosts: data.totalFound,
        duration_ms: Date.now() - this.lastScanTime.getTime(),
        started_at: this.lastScanTime.toISOString()
      });
      
      this.broadcastToClients('scanCompleted', data);
    });

    // Alert manager events
    this.alertManager.on('alertCreated', (alert) => {
      this.broadcastToClients('alertCreated', alert);
    });

    this.alertManager.on('alertResolved', (alert) => {
      this.broadcastToClients('alertResolved', alert);
    });
  }

  /**
   * Start monitoring service
   */
  async start() {
    if (this.isRunning) {
      this.logger.warn('Monitoring service is already running');
      return;
    }

    this.isRunning = true;
    
    // Start periodic monitoring
    this.monitoringTimer = setInterval(async () => {
      await this.performMonitoringCycle();
    }, this.refreshInterval * 1000);
    
    // Perform initial monitoring cycle
    await this.performMonitoringCycle();
    
    this.logger.info(`Monitoring service started with ${this.refreshInterval}s interval`);
    this.emit('started');
  }

  /**
   * Stop monitoring service
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
    
    if (this.cleanupTask) {
      this.cleanupTask.stop();
      this.cleanupTask = null;
    }
    
    // Close SNMP sessions
    this.snmpCollector.closeAllSessions();
    
    this.logger.info('Monitoring service stopped');
    this.emit('stopped');
  }

  /**
   * Perform a complete monitoring cycle
   */
  async performMonitoringCycle() {
    if (this.scanInProgress) {
      this.logger.debug('Skipping monitoring cycle - scan in progress');
      return;
    }

    try {
      this.logger.debug('Starting monitoring cycle');
      const startTime = Date.now();
      
      const devices = Array.from(this.currentDevices.values());
      const monitoringResults = [];
      
      // Monitor each device
      for (const device of devices) {
        try {
          const result = await this.monitorDevice(device);
          monitoringResults.push(result);
        } catch (error) {
          this.logger.error(`Failed to monitor device ${device.ip}:`, error);
          
          // Mark device as offline
          await this.updateDeviceStatus(device.id, 'offline');
          
          // Create offline alert
          await this.alertManager.createAlert({
            deviceId: device.id,
            deviceIp: device.ip,
            type: 'offline',
            severity: 'critical',
            message: `Device ${device.hostname || device.ip} is unreachable`
          });
        }
      }
      
      // Broadcast monitoring results
      this.broadcastToClients('monitoringUpdate', {
        devices: monitoringResults,
        timestamp: new Date(),
        cycleTime: Date.now() - startTime
      });
      
      this.logger.debug(`Monitoring cycle completed in ${Date.now() - startTime}ms`);
      
    } catch (error) {
      this.logger.error('Error in monitoring cycle:', error);
    }
  }

  /**
   * Monitor a single device
   */
  async monitorDevice(device) {
    try {
      let metrics;
      
      // Use local metrics collector for localhost device
      if (device.isLocal) {
        metrics = await this.collectLocalMetrics(device);
      } else {
        // Collect SNMP metrics for remote devices
        metrics = await this.snmpCollector.collectAllMetrics(device.ip, device.community);
      }
      
      if (metrics.system) {
        // Update device information
        await this.dbManager.saveDevice({
          id: device.id,
          ip: device.ip,
          hostname: metrics.system.hostname || device.hostname,
          description: metrics.system.description || device.description,
          location: metrics.system.location || device.location,
          contact: metrics.system.contact || device.contact,
          community: device.community,
          status: 'online'
        });

        // Save system information
        await this.dbManager.saveSystemInfo(device.id, {
          uptime: metrics.system.uptime,
          processes: 0, // Will be implemented with additional SNMP OIDs
          users: 0
        });
      }

      // Save metrics to database
      const metricsToSave = [];
      
      if (metrics.cpu) {
        metricsToSave.push({
          type: 'cpu_usage',
          value: metrics.cpu.usage || metrics.cpu,
          unit: 'percent'
        });
      }
      
      if (metrics.memory) {
        metricsToSave.push({
          type: 'memory_usage',
          value: metrics.memory.usage,
          unit: 'percent'
        });
        metricsToSave.push({
          type: 'memory_total',
          value: metrics.memory.total,
          unit: 'bytes'
        });
        metricsToSave.push({
          type: 'memory_used',
          value: metrics.memory.used,
          unit: 'bytes'
        });
      }
      
      if (metrics.disk) {
        metricsToSave.push({
          type: 'disk_usage',
          value: metrics.disk.usage,
          unit: 'percent'
        });
        metricsToSave.push({
          type: 'disk_total',
          value: metrics.disk.total,
          unit: 'bytes'
        });
        metricsToSave.push({
          type: 'disk_used',
          value: metrics.disk.used,
          unit: 'bytes'
        });
      }

      if (metricsToSave.length > 0) {
        await this.dbManager.saveMetrics(device.id, metricsToSave);
      }

      // Save network interfaces
      if (metrics.network && metrics.network.length > 0) {
        await this.dbManager.saveNetworkInterfaces(device.id, metrics.network);
      }

      // Check thresholds and create alerts
      await this.checkThresholds(device, metrics);

      // Update device status
      await this.updateDeviceStatus(device.id, 'online');

      // Prepare result for broadcasting
      const result = {
        id: device.id,
        ip: device.ip,
        hostname: metrics.system?.hostname || device.hostname,
        status: 'online',
        cpu: metrics.cpu?.usage || 0,
        memory: metrics.memory?.usage || 0,
        disk: metrics.disk?.usage || 0,
        uptime: metrics.system?.uptime || 0,
        lastSeen: new Date(),
        community: device.community,
        errors: metrics.errors || []
      };

      // Update local cache
      this.currentDevices.set(device.ip, {
        ...device,
        ...result
      });

      return result;

    } catch (error) {
      this.logger.error(`Failed to monitor device ${device.ip}:`, error);
      throw error;
    }
  }

  /**
   * Collect metrics from local system
   */
  async collectLocalMetrics(device) {
    try {
      const localMetrics = await this.localMetricsCollector.collectAllMetrics();
      
      // Transform local metrics to match SNMP format
      return {
        system: {
          hostname: localMetrics.system.hostname,
          description: `${localMetrics.system.platform} ${localMetrics.system.arch}`,
          location: device.location || 'Local Machine',
          contact: device.contact || 'System Administrator',
          uptime: localMetrics.system.uptime
        },
        cpu: {
          usage: localMetrics.cpu
        },
        memory: {
          usage: localMetrics.memory.percentage,
          total: localMetrics.memory.total * 1024 * 1024, // Convert MB to bytes
          used: localMetrics.memory.used * 1024 * 1024
        },
        disk: {
          usage: localMetrics.disk.percentage,
          total: localMetrics.disk.total * 1024 * 1024 * 1024, // Convert GB to bytes
          used: localMetrics.disk.used * 1024 * 1024 * 1024
        },
        network: Object.entries(localMetrics.network).map(([name, interfaces]) => ({
          name,
          interfaces: interfaces.filter(iface => !iface.internal)
        })).filter(net => net.interfaces.length > 0),
        errors: []
      };
    } catch (error) {
      this.logger.error('Failed to collect local metrics:', error);
      return {
        system: { hostname: device.hostname, uptime: 0 },
        cpu: { usage: 0 },
        memory: { usage: 0, total: 0, used: 0 },
        disk: { usage: 0, total: 0, used: 0 },
        network: [],
        errors: [error.message]
      };
    }
  }

  /**
   * Check metric thresholds and create alerts
   */
  async checkThresholds(device, metrics) {
    const alerts = [];

    // Check CPU threshold
    if (metrics.cpu && metrics.cpu.usage !== null) {
      if (metrics.cpu.usage >= this.thresholds.cpu.critical) {
        alerts.push({
          type: 'cpu',
          severity: 'critical',
          message: `Critical CPU usage on ${device.hostname || device.ip}: ${metrics.cpu.usage}%`
        });
      } else if (metrics.cpu.usage >= this.thresholds.cpu.warning) {
        alerts.push({
          type: 'cpu',
          severity: 'warning',
          message: `High CPU usage on ${device.hostname || device.ip}: ${metrics.cpu.usage}%`
        });
      }
    }

    // Check Memory threshold
    if (metrics.memory && metrics.memory.usage !== null) {
      if (metrics.memory.usage >= this.thresholds.memory.critical) {
        alerts.push({
          type: 'memory',
          severity: 'critical',
          message: `Critical memory usage on ${device.hostname || device.ip}: ${metrics.memory.usage}%`
        });
      } else if (metrics.memory.usage >= this.thresholds.memory.warning) {
        alerts.push({
          type: 'memory',
          severity: 'warning',
          message: `High memory usage on ${device.hostname || device.ip}: ${metrics.memory.usage}%`
        });
      }
    }

    // Check Disk threshold
    if (metrics.disk && metrics.disk.usage !== null) {
      if (metrics.disk.usage >= this.thresholds.disk.critical) {
        alerts.push({
          type: 'disk',
          severity: 'critical',
          message: `Critical disk usage on ${device.hostname || device.ip}: ${metrics.disk.usage}%`
        });
      } else if (metrics.disk.usage >= this.thresholds.disk.warning) {
        alerts.push({
          type: 'disk',
          severity: 'warning',
          message: `High disk usage on ${device.hostname || device.ip}: ${metrics.disk.usage}%`
        });
      }
    }

    // Create alerts
    for (const alertData of alerts) {
      await this.alertManager.createAlert({
        deviceId: device.id,
        deviceIp: device.ip,
        ...alertData
      });
    }
  }

  /**
   * Update device status
   */
  async updateDeviceStatus(deviceId, status) {
    await this.dbManager.updateDeviceStatus(deviceId, status);
    
    // Update local cache
    for (const [ip, device] of this.currentDevices) {
      if (device.id === deviceId) {
        device.status = status;
        device.lastSeen = new Date();
        break;
      }
    }
  }

  /**
   * Scan network for new devices
   */
  async scanNetwork(range, options = {}) {
    try {
      this.logger.info(`Starting network scan for range: ${range}`);
      
      const discoveredHosts = await this.networkScanner.scanRange(range, options);
      
      // Process discovered hosts
      for (const host of discoveredHosts) {
        await this.processDiscoveredHost(host);
      }
      
      this.logger.info(`Network scan completed. Found ${discoveredHosts.length} hosts`);
      return discoveredHosts;
      
    } catch (error) {
      this.logger.error('Network scan failed:', error);
      throw error;
    }
  }

  /**
   * Process a newly discovered host
   */
  async processDiscoveredHost(host) {
    try {
      // Check if device already exists
      let existingDevice = await this.dbManager.getDeviceByIP(host.ip);
      
      if (!existingDevice) {
        // Create new device
        const deviceId = uuidv4();
        
        // Try to get system information via SNMP
        let systemInfo = null;
        const communities = ['public', 'private', 'monitoring'];
        
        for (const community of communities) {
          try {
            systemInfo = await this.snmpCollector.collectSystemInfo(host.ip, community);
            
            // Save device with SNMP info
            await this.dbManager.saveDevice({
              id: deviceId,
              ip: host.ip,
              hostname: systemInfo.hostname,
              description: systemInfo.description,
              location: systemInfo.location,
              contact: systemInfo.contact,
              community: community,
              status: 'online'
            });
            
            // Add to local cache
            this.currentDevices.set(host.ip, {
              id: deviceId,
              ip: host.ip,
              hostname: systemInfo.hostname,
              description: systemInfo.description,
              location: systemInfo.location,
              contact: systemInfo.contact,
              community: community,
              status: 'online',
              lastSeen: new Date(),
              firstSeen: new Date()
            });
            
            this.logger.info(`New device discovered: ${host.ip} (${systemInfo.hostname})`);
            break;
            
          } catch (error) {
            // Try next community string
            continue;
          }
        }
        
        // If SNMP failed, save basic device info
        if (!systemInfo) {
          await this.dbManager.saveDevice({
            id: deviceId,
            ip: host.ip,
            hostname: host.ip,
            description: 'Discovered device',
            community: 'public',
            status: 'online'
          });
          
          this.currentDevices.set(host.ip, {
            id: deviceId,
            ip: host.ip,
            hostname: host.ip,
            description: 'Discovered device',
            community: 'public',
            status: 'online',
            lastSeen: new Date(),
            firstSeen: new Date()
          });
          
          this.logger.info(`New device discovered (no SNMP): ${host.ip}`);
        }
      } else {
        // Update existing device status
        await this.updateDeviceStatus(existingDevice.id, 'online');
        this.logger.debug(`Updated existing device: ${host.ip}`);
      }
      
    } catch (error) {
      this.logger.error(`Failed to process discovered host ${host.ip}:`, error);
    }
  }

  /**
   * Get current monitoring status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      refreshInterval: this.refreshInterval,
      deviceCount: this.currentDevices.size,
      lastScanTime: this.lastScanTime,
      scanInProgress: this.scanInProgress,
      webSocketClients: this.webSocketClients.size,
      thresholds: this.thresholds
    };
  }

  /**
   * Get all monitored devices
   */
  getDevices() {
    return Array.from(this.currentDevices.values());
  }

  /**
   * WebSocket client management
   */
  addWebSocketClient(ws) {
    this.webSocketClients.add(ws);
    this.logger.debug(`WebSocket client added. Total: ${this.webSocketClients.size}`);
  }

  removeWebSocketClient(ws) {
    this.webSocketClients.delete(ws);
    this.logger.debug(`WebSocket client removed. Total: ${this.webSocketClients.size}`);
  }

  /**
   * Broadcast message to all WebSocket clients
   */
  broadcastToClients(type, data) {
    const message = JSON.stringify({
      type,
      data,
      timestamp: new Date().toISOString()
    });

    for (const client of this.webSocketClients) {
      try {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(message);
        } else {
          this.webSocketClients.delete(client);
        }
      } catch (error) {
        this.logger.error('Error broadcasting to WebSocket client:', error);
        this.webSocketClients.delete(client);
      }
    }
  }

  /**
   * Update monitoring configuration
   */
  async updateConfiguration(config) {
    try {
      // Update database
      for (const [key, value] of Object.entries(config)) {
        await this.dbManager.setConfiguration(key, value.toString());
      }
      
      // Reload configuration
      await this.loadConfiguration();
      
      // Restart monitoring with new interval if changed
      if (config.refresh_interval && config.refresh_interval !== this.refreshInterval) {
        await this.stop();
        await this.start();
      }
      
      this.logger.info('Configuration updated:', config);
      
    } catch (error) {
      this.logger.error('Failed to update configuration:', error);
      throw error;
    }
  }

  /**
   * Perform maintenance tasks
   */
  async performMaintenance() {
    try {
      this.logger.info('Starting maintenance tasks');
      
      // Clean up old data
      await this.dbManager.cleanupOldData();
      
      // Get database statistics
      const stats = await this.dbManager.getDatabaseStats();
      this.logger.info('Database statistics:', stats);
      
      this.logger.info('Maintenance tasks completed');
      
    } catch (error) {
      this.logger.error('Maintenance tasks failed:', error);
    }
  }
}