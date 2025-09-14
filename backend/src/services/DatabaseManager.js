import sqlite3 from 'sqlite3';
import { promises as fs } from 'fs';
import { dirname } from 'path';

export class DatabaseManager {
  constructor() {
    this.db = null;
    this.dbPath = process.env.DB_PATH || './data/monitoring.db';
  }

  /**
   * Initialize database connection and create tables
   */
  async initialize() {
    try {
      // Ensure data directory exists
      await fs.mkdir(dirname(this.dbPath), { recursive: true });

      // Open database connection
      this.db = new sqlite3.Database(this.dbPath);
      
      // Enable foreign keys
      await this.run('PRAGMA foreign_keys = ON');
      
      // Create tables
      await this.createTables();
      
      console.log('Database initialized successfully');
    } catch (error) {
      throw new Error(`Failed to initialize database: ${error.message}`);
    }
  }

  /**
   * Create database tables
   */
  async createTables() {
    const tables = [
      // Devices table
      `CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        ip TEXT UNIQUE NOT NULL,
        hostname TEXT,
        description TEXT,
        location TEXT,
        contact TEXT,
        community TEXT DEFAULT 'public',
        status TEXT DEFAULT 'unknown',
        first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Metrics table for historical data
      `CREATE TABLE IF NOT EXISTS metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL,
        metric_type TEXT NOT NULL,
        value REAL NOT NULL,
        unit TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE CASCADE
      )`,

      // System information table
      `CREATE TABLE IF NOT EXISTS system_info (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL,
        uptime INTEGER,
        processes INTEGER,
        users INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE CASCADE
      )`,

      // Network interfaces table
      `CREATE TABLE IF NOT EXISTS network_interfaces (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL,
        interface_index INTEGER,
        name TEXT,
        description TEXT,
        type INTEGER,
        speed INTEGER,
        admin_status INTEGER,
        oper_status INTEGER,
        in_octets INTEGER,
        out_octets INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE CASCADE
      )`,

      // Alerts table
      `CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL,
        device_ip TEXT NOT NULL,
        type TEXT NOT NULL,
        severity TEXT NOT NULL,
        message TEXT NOT NULL,
        acknowledged BOOLEAN DEFAULT FALSE,
        acknowledged_by TEXT,
        acknowledged_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        resolved_at DATETIME,
        FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE CASCADE
      )`,

      // Scan history table
      `CREATE TABLE IF NOT EXISTS scan_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scan_range TEXT NOT NULL,
        total_ips INTEGER,
        discovered_hosts INTEGER,
        duration_ms INTEGER,
        started_at DATETIME,
        completed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Configuration table
      `CREATE TABLE IF NOT EXISTS configuration (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        description TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const table of tables) {
      await this.run(table);
    }

    // Create indexes for better performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_devices_ip ON devices (ip)',
      'CREATE INDEX IF NOT EXISTS idx_devices_status ON devices (status)',
      'CREATE INDEX IF NOT EXISTS idx_metrics_device_timestamp ON metrics (device_id, timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_metrics_type_timestamp ON metrics (metric_type, timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_alerts_device_severity ON alerts (device_id, severity)',
      'CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged ON alerts (acknowledged)',
      'CREATE INDEX IF NOT EXISTS idx_network_interfaces_device ON network_interfaces (device_id)'
    ];

    for (const index of indexes) {
      await this.run(index);
    }

    // Insert default configuration
    await this.insertDefaultConfiguration();
  }

  /**
   * Insert default configuration values
   */
  async insertDefaultConfiguration() {
    const defaultConfig = [
      { key: 'refresh_interval', value: '10', description: 'Default refresh interval in seconds' },
      { key: 'default_community', value: 'public', description: 'Default SNMP community string' },
      { key: 'scan_timeout', value: '3000', description: 'Network scan timeout in milliseconds' },
      { key: 'snmp_timeout', value: '5000', description: 'SNMP timeout in milliseconds' },
      { key: 'max_history_days', value: '30', description: 'Maximum days to keep historical data' },
      { key: 'cpu_warning_threshold', value: '75', description: 'CPU usage warning threshold (%)' },
      { key: 'cpu_critical_threshold', value: '90', description: 'CPU usage critical threshold (%)' },
      { key: 'memory_warning_threshold', value: '80', description: 'Memory usage warning threshold (%)' },
      { key: 'memory_critical_threshold', value: '95', description: 'Memory usage critical threshold (%)' },
      { key: 'disk_warning_threshold', value: '85', description: 'Disk usage warning threshold (%)' },
      { key: 'disk_critical_threshold', value: '95', description: 'Disk usage critical threshold (%)' }
    ];

    for (const config of defaultConfig) {
      await this.run(
        'INSERT OR IGNORE INTO configuration (key, value, description) VALUES (?, ?, ?)',
        [config.key, config.value, config.description]
      );
    }
  }

  /**
   * Device management methods
   */

  async saveDevice(deviceData) {
    const {
      id,
      ip,
      hostname,
      description,
      location,
      contact,
      community = 'public',
      status = 'unknown'
    } = deviceData;

    return this.run(`
      INSERT OR REPLACE INTO devices 
      (id, ip, hostname, description, location, contact, community, status, last_seen, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [id, ip, hostname, description, location, contact, community, status]);
  }

  async getDevice(deviceId) {
    return this.get('SELECT * FROM devices WHERE id = ?', [deviceId]);
  }

  async getDeviceByIP(ip) {
    return this.get('SELECT * FROM devices WHERE ip = ?', [ip]);
  }

  async getAllDevices() {
    return this.all('SELECT * FROM devices ORDER BY ip');
  }

  async updateDeviceStatus(deviceId, status) {
    return this.run(
      'UPDATE devices SET status = ?, last_seen = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, deviceId]
    );
  }

  async deleteDevice(deviceId) {
    return this.run('DELETE FROM devices WHERE id = ?', [deviceId]);
  }

  /**
   * Metrics management methods
   */

  async saveMetric(deviceId, metricType, value, unit = null) {
    return this.run(
      'INSERT INTO metrics (device_id, metric_type, value, unit) VALUES (?, ?, ?, ?)',
      [deviceId, metricType, value, unit]
    );
  }

  async saveMetrics(deviceId, metrics) {
    const stmt = await this.prepare(
      'INSERT INTO metrics (device_id, metric_type, value, unit) VALUES (?, ?, ?, ?)'
    );

    try {
      for (const metric of metrics) {
        await this.runPrepared(stmt, [deviceId, metric.type, metric.value, metric.unit]);
      }
    } finally {
      await this.finalize(stmt);
    }
  }

  async getLatestMetrics(deviceId, metricTypes = null) {
    let query = `
      SELECT metric_type, value, unit, timestamp
      FROM metrics 
      WHERE device_id = ?
    `;
    
    const params = [deviceId];
    
    if (metricTypes && metricTypes.length > 0) {
      query += ` AND metric_type IN (${metricTypes.map(() => '?').join(',')})`;
      params.push(...metricTypes);
    }
    
    query += ` ORDER BY timestamp DESC`;
    
    return this.all(query, params);
  }

  async getMetricsHistory(deviceId, metricType, hours = 24) {
    return this.all(`
      SELECT value, unit, timestamp
      FROM metrics 
      WHERE device_id = ? AND metric_type = ? 
        AND timestamp >= datetime('now', '-${hours} hours')
      ORDER BY timestamp ASC
    `, [deviceId, metricType]);
  }

  async getDeviceMetricsSummary(deviceId) {
    return this.all(`
      SELECT 
        metric_type,
        COUNT(*) as count,
        AVG(value) as avg_value,
        MIN(value) as min_value,
        MAX(value) as max_value,
        MAX(timestamp) as last_updated
      FROM metrics 
      WHERE device_id = ? 
        AND timestamp >= datetime('now', '-24 hours')
      GROUP BY metric_type
    `, [deviceId]);
  }

  /**
   * System information methods
   */

  async saveSystemInfo(deviceId, systemInfo) {
    const { uptime, processes, users } = systemInfo;
    return this.run(
      'INSERT INTO system_info (device_id, uptime, processes, users) VALUES (?, ?, ?, ?)',
      [deviceId, uptime, processes, users]
    );
  }

  async getLatestSystemInfo(deviceId) {
    return this.get(
      'SELECT * FROM system_info WHERE device_id = ? ORDER BY timestamp DESC LIMIT 1',
      [deviceId]
    );
  }

  /**
   * Network interfaces methods
   */

  async saveNetworkInterfaces(deviceId, interfaces) {
    // Clear existing interfaces for this device
    await this.run('DELETE FROM network_interfaces WHERE device_id = ?', [deviceId]);

    if (interfaces.length === 0) return;

    const stmt = await this.prepare(`
      INSERT INTO network_interfaces 
      (device_id, interface_index, name, description, type, speed, admin_status, oper_status, in_octets, out_octets)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      for (const iface of interfaces) {
        await this.runPrepared(stmt, [
          deviceId,
          iface.index,
          iface.name || iface.description,
          iface.description,
          iface.type,
          iface.speed,
          iface.adminStatus,
          iface.operStatus,
          iface.inOctets,
          iface.outOctets
        ]);
      }
    } finally {
      await this.finalize(stmt);
    }
  }

  async getNetworkInterfaces(deviceId) {
    return this.all(
      'SELECT * FROM network_interfaces WHERE device_id = ? ORDER BY interface_index',
      [deviceId]
    );
  }

  /**
   * Alerts management methods
   */

  async saveAlert(alertData) {
    const {
      id,
      device_id,
      device_ip,
      type,
      severity,
      message,
      acknowledged = false
    } = alertData;

    return this.run(`
      INSERT OR REPLACE INTO alerts 
      (id, device_id, device_ip, type, severity, message, acknowledged)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, device_id, device_ip, type, severity, message, acknowledged]);
  }

  async getAlerts(options = {}) {
    const {
      deviceId = null,
      acknowledged = null,
      severity = null,
      limit = 100,
      offset = 0
    } = options;

    let query = 'SELECT * FROM alerts WHERE 1=1';
    const params = [];

    if (deviceId) {
      query += ' AND device_id = ?';
      params.push(deviceId);
    }

    if (acknowledged !== null) {
      query += ' AND acknowledged = ?';
      params.push(acknowledged);
    }

    if (severity) {
      query += ' AND severity = ?';
      params.push(severity);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return this.all(query, params);
  }

  async acknowledgeAlert(alertId, acknowledgedBy = null) {
    return this.run(
      'UPDATE alerts SET acknowledged = TRUE, acknowledged_by = ?, acknowledged_at = CURRENT_TIMESTAMP WHERE id = ?',
      [acknowledgedBy, alertId]
    );
  }

  async resolveAlert(alertId) {
    return this.run(
      'UPDATE alerts SET resolved_at = CURRENT_TIMESTAMP WHERE id = ?',
      [alertId]
    );
  }

  async deleteAlert(alertId) {
    return this.run('DELETE FROM alerts WHERE id = ?', [alertId]);
  }

  /**
   * Scan history methods
   */

  async saveScanHistory(scanData) {
    const {
      scan_range,
      total_ips,
      discovered_hosts,
      duration_ms,
      started_at
    } = scanData;

    return this.run(`
      INSERT INTO scan_history 
      (scan_range, total_ips, discovered_hosts, duration_ms, started_at)
      VALUES (?, ?, ?, ?, ?)
    `, [scan_range, total_ips, discovered_hosts, duration_ms, started_at]);
  }

  async getScanHistory(limit = 50) {
    return this.all(
      'SELECT * FROM scan_history ORDER BY completed_at DESC LIMIT ?',
      [limit]
    );
  }

  /**
   * Configuration methods
   */

  async getConfiguration(key = null) {
    if (key) {
      return this.get('SELECT * FROM configuration WHERE key = ?', [key]);
    }
    return this.all('SELECT * FROM configuration ORDER BY key');
  }

  async setConfiguration(key, value, description = null) {
    return this.run(
      'INSERT OR REPLACE INTO configuration (key, value, description, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
      [key, value, description]
    );
  }

  /**
   * Maintenance methods
   */

  async cleanupOldData() {
    const maxHistoryDays = await this.getConfiguration('max_history_days');
    const days = maxHistoryDays ? parseInt(maxHistoryDays.value) : 30;

    // Clean old metrics
    await this.run(
      `DELETE FROM metrics WHERE timestamp < datetime('now', '-${days} days')`
    );

    // Clean old system info
    await this.run(
      `DELETE FROM system_info WHERE timestamp < datetime('now', '-${days} days')`
    );

    // Clean old network interfaces (keep only latest)
    await this.run(`
      DELETE FROM network_interfaces 
      WHERE timestamp < datetime('now', '-1 day')
    `);

    // Clean resolved alerts older than 7 days
    await this.run(`
      DELETE FROM alerts 
      WHERE resolved_at IS NOT NULL 
        AND resolved_at < datetime('now', '-7 days')
    `);

    console.log(`Cleaned up data older than ${days} days`);
  }

  async getDatabaseStats() {
    const stats = {};
    
    const tables = ['devices', 'metrics', 'system_info', 'network_interfaces', 'alerts', 'scan_history'];
    
    for (const table of tables) {
      const result = await this.get(`SELECT COUNT(*) as count FROM ${table}`);
      stats[table] = result.count;
    }

    // Database size
    const sizeResult = await this.get("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()");
    stats.database_size_bytes = sizeResult.size;

    return stats;
  }

  /**
   * Database utility methods
   */

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(error) {
        if (error) {
          reject(error);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (error, row) => {
        if (error) {
          reject(error);
        } else {
          resolve(row);
        }
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (error, rows) => {
        if (error) {
          reject(error);
        } else {
          resolve(rows);
        }
      });
    });
  }

  prepare(sql) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(sql, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve(stmt);
        }
      });
    });
  }

  runPrepared(stmt, params = []) {
    return new Promise((resolve, reject) => {
      stmt.run(params, function(error) {
        if (error) {
          reject(error);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  finalize(stmt) {
    return new Promise((resolve, reject) => {
      stmt.finalize((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Close database connection
   */
  async close() {
    if (this.db) {
      return new Promise((resolve, reject) => {
        this.db.close((error) => {
          if (error) {
            reject(error);
          } else {
            console.log('Database connection closed');
            resolve();
          }
        });
      });
    }
  }
}