import winston from 'winston';
import { promises as fs } from 'fs';
import { dirname } from 'path';

export class Logger {
  constructor() {
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.logFile = process.env.LOG_FILE || './logs/monitoring.log';
    this.logger = null;
    
    this.initialize();
  }

  async initialize() {
    try {
      // Ensure logs directory exists
      await fs.mkdir(dirname(this.logFile), { recursive: true });

      // Create winston logger
      this.logger = winston.createLogger({
        level: this.logLevel,
        format: winston.format.combine(
          winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
          }),
          winston.format.errors({ stack: true }),
          winston.format.json()
        ),
        defaultMeta: { service: 'lan-insight-backend' },
        transports: [
          // Write all logs to file
          new winston.transports.File({
            filename: this.logFile,
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
            tailable: true
          }),
          
          // Write errors to separate file
          new winston.transports.File({
            filename: this.logFile.replace('.log', '-error.log'),
            level: 'error',
            maxsize: 10 * 1024 * 1024,
            maxFiles: 5,
            tailable: true
          })
        ]
      });

      // Add console transport for development
      if (process.env.NODE_ENV !== 'production') {
        this.logger.add(new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
            winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
              let log = `${timestamp} [${service}] ${level}: ${message}`;
              
              // Add metadata if present
              if (Object.keys(meta).length > 0) {
                log += ` ${JSON.stringify(meta)}`;
              }
              
              return log;
            })
          )
        }));
      }

    } catch (error) {
      console.error('Failed to initialize logger:', error);
      // Fallback to console logging
      this.logger = console;
    }
  }

  info(message, meta = {}) {
    if (this.logger && this.logger.info) {
      this.logger.info(message, meta);
    } else {
      console.log(`INFO: ${message}`, meta);
    }
  }

  warn(message, meta = {}) {
    if (this.logger && this.logger.warn) {
      this.logger.warn(message, meta);
    } else {
      console.warn(`WARN: ${message}`, meta);
    }
  }

  error(message, meta = {}) {
    if (this.logger && this.logger.error) {
      this.logger.error(message, meta);
    } else {
      console.error(`ERROR: ${message}`, meta);
    }
  }

  debug(message, meta = {}) {
    if (this.logger && this.logger.debug) {
      this.logger.debug(message, meta);
    } else if (process.env.NODE_ENV !== 'production') {
      console.debug(`DEBUG: ${message}`, meta);
    }
  }

  verbose(message, meta = {}) {
    if (this.logger && this.logger.verbose) {
      this.logger.verbose(message, meta);
    } else if (process.env.NODE_ENV !== 'production') {
      console.log(`VERBOSE: ${message}`, meta);
    }
  }

  // Log HTTP requests
  logRequest(req, res, responseTime) {
    const logData = {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      contentLength: res.get('Content-Length') || 0
    };

    if (res.statusCode >= 400) {
      this.warn('HTTP Request Error', logData);
    } else {
      this.info('HTTP Request', logData);
    }
  }

  // Log SNMP operations
  logSNMP(operation, ip, community, success, error = null, responseTime = null) {
    const logData = {
      operation,
      ip,
      community,
      success,
      responseTime: responseTime ? `${responseTime}ms` : null,
      error: error ? error.message : null
    };

    if (success) {
      this.debug('SNMP Operation Success', logData);
    } else {
      this.warn('SNMP Operation Failed', logData);
    }
  }

  // Log network scan operations
  logNetworkScan(operation, range, hostsFound = null, duration = null, error = null) {
    const logData = {
      operation,
      range,
      hostsFound,
      duration: duration ? `${duration}ms` : null,
      error: error ? error.message : null
    };

    if (error) {
      this.error('Network Scan Error', logData);
    } else {
      this.info('Network Scan', logData);
    }
  }

  // Log database operations
  logDatabase(operation, table = null, recordCount = null, duration = null, error = null) {
    const logData = {
      operation,
      table,
      recordCount,
      duration: duration ? `${duration}ms` : null,
      error: error ? error.message : null
    };

    if (error) {
      this.error('Database Operation Error', logData);
    } else {
      this.debug('Database Operation', logData);
    }
  }

  // Log alert operations
  logAlert(operation, alertId, deviceIp, severity, message, error = null) {
    const logData = {
      operation,
      alertId,
      deviceIp,
      severity,
      message,
      error: error ? error.message : null
    };

    if (error) {
      this.error('Alert Operation Error', logData);
    } else if (severity === 'critical') {
      this.warn('Critical Alert', logData);
    } else {
      this.info('Alert Operation', logData);
    }
  }

  // Log system metrics
  logMetrics(deviceIp, metrics, collectionTime) {
    const logData = {
      deviceIp,
      cpu: metrics.cpu?.usage,
      memory: metrics.memory?.usage,
      disk: metrics.disk?.usage,
      uptime: metrics.system?.uptime,
      collectionTime: `${collectionTime}ms`,
      errors: metrics.errors?.length || 0
    };

    this.debug('Metrics Collected', logData);
  }

  // Log performance metrics
  logPerformance(operation, duration, details = {}) {
    const logData = {
      operation,
      duration: `${duration}ms`,
      ...details
    };

    if (duration > 5000) { // Log slow operations (>5s)
      this.warn('Slow Operation', logData);
    } else {
      this.debug('Performance', logData);
    }
  }

  // Create child logger with additional context
  child(context) {
    return {
      info: (message, meta = {}) => this.info(message, { ...context, ...meta }),
      warn: (message, meta = {}) => this.warn(message, { ...context, ...meta }),
      error: (message, meta = {}) => this.error(message, { ...context, ...meta }),
      debug: (message, meta = {}) => this.debug(message, { ...context, ...meta }),
      verbose: (message, meta = {}) => this.verbose(message, { ...context, ...meta })
    };
  }

  // Get log statistics
  async getLogStats() {
    try {
      const stats = await fs.stat(this.logFile);
      return {
        logFile: this.logFile,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        level: this.logLevel
      };
    } catch (error) {
      return {
        logFile: this.logFile,
        error: error.message,
        level: this.logLevel
      };
    }
  }

  // Read recent log entries
  async getRecentLogs(lines = 100) {
    try {
      const data = await fs.readFile(this.logFile, 'utf8');
      const logLines = data.trim().split('\n');
      const recentLines = logLines.slice(-lines);
      
      return recentLines.map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return { message: line, timestamp: new Date().toISOString() };
        }
      });
    } catch (error) {
      return [{ 
        level: 'error', 
        message: `Failed to read log file: ${error.message}`,
        timestamp: new Date().toISOString()
      }];
    }
  }

  // Clear log files
  async clearLogs() {
    try {
      await fs.writeFile(this.logFile, '');
      await fs.writeFile(this.logFile.replace('.log', '-error.log'), '');
      this.info('Log files cleared');
      return true;
    } catch (error) {
      this.error('Failed to clear log files:', error);
      return false;
    }
  }
}