import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export class AlertManager extends EventEmitter {
  constructor() {
    super();
    this.activeAlerts = new Map();
    this.alertHistory = [];
    this.dbManager = null;
    this.logger = null;
  }

  /**
   * Initialize alert manager with dependencies
   */
  initialize(dbManager, logger) {
    this.dbManager = dbManager;
    this.logger = logger;
    
    // Load existing alerts from database
    this.loadActiveAlerts();
  }

  /**
   * Load active alerts from database
   */
  async loadActiveAlerts() {
    try {
      if (!this.dbManager) return;
      
      const alerts = await this.dbManager.getAlerts({
        acknowledged: false,
        limit: 1000
      });
      
      for (const alert of alerts) {
        this.activeAlerts.set(alert.id, {
          id: alert.id,
          deviceId: alert.device_id,
          deviceIp: alert.device_ip,
          type: alert.type,
          severity: alert.severity,
          message: alert.message,
          acknowledged: alert.acknowledged,
          acknowledgedBy: alert.acknowledged_by,
          acknowledgedAt: alert.acknowledged_at ? new Date(alert.acknowledged_at) : null,
          createdAt: new Date(alert.created_at),
          resolvedAt: alert.resolved_at ? new Date(alert.resolved_at) : null
        });
      }
      
      if (this.logger) {
        this.logger.info(`Loaded ${alerts.length} active alerts`);
      }
      
    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to load active alerts:', error);
      }
    }
  }

  /**
   * Create a new alert
   */
  async createAlert(alertData) {
    const {
      deviceId,
      deviceIp,
      type,
      severity,
      message,
      metadata = {}
    } = alertData;

    // Check if similar alert already exists
    const existingAlert = this.findSimilarAlert(deviceId, type, severity);
    if (existingAlert) {
      // Update existing alert timestamp instead of creating duplicate
      existingAlert.lastOccurrence = new Date();
      existingAlert.occurrenceCount = (existingAlert.occurrenceCount || 1) + 1;
      
      if (this.dbManager) {
        // Update in database (you might want to add an occurrences table)
        // For now, we'll just log it
        if (this.logger) {
          this.logger.debug(`Similar alert exists, incrementing count: ${existingAlert.id}`);
        }
      }
      
      return existingAlert;
    }

    // Create new alert
    const alert = {
      id: uuidv4(),
      deviceId,
      deviceIp,
      type,
      severity,
      message,
      acknowledged: false,
      acknowledgedBy: null,
      acknowledgedAt: null,
      createdAt: new Date(),
      resolvedAt: null,
      metadata,
      occurrenceCount: 1,
      lastOccurrence: new Date()
    };

    // Add to active alerts
    this.activeAlerts.set(alert.id, alert);

    // Save to database
    if (this.dbManager) {
      try {
        await this.dbManager.saveAlert({
          id: alert.id,
          device_id: alert.deviceId,
          device_ip: alert.deviceIp,
          type: alert.type,
          severity: alert.severity,
          message: alert.message,
          acknowledged: alert.acknowledged
        });
      } catch (error) {
        if (this.logger) {
          this.logger.error('Failed to save alert to database:', error);
        }
      }
    }

    // Log alert creation
    if (this.logger) {
      this.logger.warn(`Alert created: ${alert.severity.toUpperCase()} - ${alert.message}`);
    }

    // Emit event
    this.emit('alertCreated', alert);

    return alert;
  }

  /**
   * Find similar existing alert
   */
  findSimilarAlert(deviceId, type, severity) {
    for (const alert of this.activeAlerts.values()) {
      if (
        alert.deviceId === deviceId &&
        alert.type === type &&
        alert.severity === severity &&
        !alert.acknowledged &&
        !alert.resolvedAt
      ) {
        return alert;
      }
    }
    return null;
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId, acknowledgedBy = 'system') {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    if (alert.acknowledged) {
      throw new Error(`Alert already acknowledged: ${alertId}`);
    }

    // Update alert
    alert.acknowledged = true;
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = new Date();

    // Update in database
    if (this.dbManager) {
      try {
        await this.dbManager.acknowledgeAlert(alertId, acknowledgedBy);
      } catch (error) {
        if (this.logger) {
          this.logger.error('Failed to acknowledge alert in database:', error);
        }
      }
    }

    // Log acknowledgment
    if (this.logger) {
      this.logger.info(`Alert acknowledged by ${acknowledgedBy}: ${alert.message}`);
    }

    // Emit event
    this.emit('alertAcknowledged', alert);

    return alert;
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId, resolvedBy = 'system') {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    if (alert.resolvedAt) {
      throw new Error(`Alert already resolved: ${alertId}`);
    }

    // Update alert
    alert.resolvedAt = new Date();
    alert.resolvedBy = resolvedBy;

    // Remove from active alerts
    this.activeAlerts.delete(alertId);

    // Add to history
    this.alertHistory.push(alert);

    // Update in database
    if (this.dbManager) {
      try {
        await this.dbManager.resolveAlert(alertId);
      } catch (error) {
        if (this.logger) {
          this.logger.error('Failed to resolve alert in database:', error);
        }
      }
    }

    // Log resolution
    if (this.logger) {
      this.logger.info(`Alert resolved by ${resolvedBy}: ${alert.message}`);
    }

    // Emit event
    this.emit('alertResolved', alert);

    return alert;
  }

  /**
   * Auto-resolve alerts for devices that are back to normal
   */
  async autoResolveAlerts(deviceId, type, currentValue, threshold) {
    const alertsToResolve = [];
    
    for (const alert of this.activeAlerts.values()) {
      if (
        alert.deviceId === deviceId &&
        alert.type === type &&
        !alert.resolvedAt
      ) {
        // Check if condition is resolved
        let shouldResolve = false;
        
        switch (type) {
          case 'cpu':
          case 'memory':
          case 'disk':
            // Resolve if current value is below warning threshold
            shouldResolve = currentValue < threshold.warning;
            break;
          case 'offline':
            // Resolve offline alerts when device comes back online
            shouldResolve = true;
            break;
        }
        
        if (shouldResolve) {
          alertsToResolve.push(alert.id);
        }
      }
    }
    
    // Resolve alerts
    for (const alertId of alertsToResolve) {
      try {
        await this.resolveAlert(alertId, 'auto-resolve');
      } catch (error) {
        if (this.logger) {
          this.logger.error(`Failed to auto-resolve alert ${alertId}:`, error);
        }
      }
    }
    
    return alertsToResolve.length;
  }

  /**
   * Delete an alert
   */
  async deleteAlert(alertId) {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    // Remove from active alerts
    this.activeAlerts.delete(alertId);

    // Delete from database
    if (this.dbManager) {
      try {
        await this.dbManager.deleteAlert(alertId);
      } catch (error) {
        if (this.logger) {
          this.logger.error('Failed to delete alert from database:', error);
        }
      }
    }

    // Log deletion
    if (this.logger) {
      this.logger.info(`Alert deleted: ${alert.message}`);
    }

    // Emit event
    this.emit('alertDeleted', alert);

    return alert;
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts(filters = {}) {
    let alerts = Array.from(this.activeAlerts.values());

    // Apply filters
    if (filters.deviceId) {
      alerts = alerts.filter(alert => alert.deviceId === filters.deviceId);
    }

    if (filters.deviceIp) {
      alerts = alerts.filter(alert => alert.deviceIp === filters.deviceIp);
    }

    if (filters.type) {
      alerts = alerts.filter(alert => alert.type === filters.type);
    }

    if (filters.severity) {
      alerts = alerts.filter(alert => alert.severity === filters.severity);
    }

    if (filters.acknowledged !== undefined) {
      alerts = alerts.filter(alert => alert.acknowledged === filters.acknowledged);
    }

    // Sort by creation time (newest first)
    alerts.sort((a, b) => b.createdAt - a.createdAt);

    return alerts;
  }

  /**
   * Get alert statistics
   */
  getAlertStatistics() {
    const activeAlerts = Array.from(this.activeAlerts.values());
    
    const stats = {
      total: activeAlerts.length,
      critical: activeAlerts.filter(a => a.severity === 'critical').length,
      warning: activeAlerts.filter(a => a.severity === 'warning').length,
      acknowledged: activeAlerts.filter(a => a.acknowledged).length,
      unacknowledged: activeAlerts.filter(a => !a.acknowledged).length,
      byType: {},
      byDevice: {},
      recentResolved: this.alertHistory.filter(a => 
        a.resolvedAt && (Date.now() - a.resolvedAt.getTime()) < 24 * 60 * 60 * 1000
      ).length
    };

    // Count by type
    for (const alert of activeAlerts) {
      stats.byType[alert.type] = (stats.byType[alert.type] || 0) + 1;
    }

    // Count by device
    for (const alert of activeAlerts) {
      const deviceKey = `${alert.deviceIp} (${alert.deviceId})`;
      stats.byDevice[deviceKey] = (stats.byDevice[deviceKey] || 0) + 1;
    }

    return stats;
  }

  /**
   * Get alert by ID
   */
  getAlert(alertId) {
    return this.activeAlerts.get(alertId);
  }

  /**
   * Clear all resolved alerts from history
   */
  clearHistory() {
    const count = this.alertHistory.length;
    this.alertHistory = [];
    
    if (this.logger) {
      this.logger.info(`Cleared ${count} resolved alerts from history`);
    }
    
    return count;
  }

  /**
   * Bulk acknowledge alerts
   */
  async bulkAcknowledgeAlerts(alertIds, acknowledgedBy = 'system') {
    const results = [];
    
    for (const alertId of alertIds) {
      try {
        const alert = await this.acknowledgeAlert(alertId, acknowledgedBy);
        results.push({ alertId, success: true, alert });
      } catch (error) {
        results.push({ alertId, success: false, error: error.message });
      }
    }
    
    return results;
  }

  /**
   * Bulk resolve alerts
   */
  async bulkResolveAlerts(alertIds, resolvedBy = 'system') {
    const results = [];
    
    for (const alertId of alertIds) {
      try {
        const alert = await this.resolveAlert(alertId, resolvedBy);
        results.push({ alertId, success: true, alert });
      } catch (error) {
        results.push({ alertId, success: false, error: error.message });
      }
    }
    
    return results;
  }

  /**
   * Get alerts for a specific device
   */
  getDeviceAlerts(deviceId) {
    return this.getActiveAlerts({ deviceId });
  }

  /**
   * Check if device has critical alerts
   */
  hasDeviceCriticalAlerts(deviceId) {
    const alerts = this.getDeviceAlerts(deviceId);
    return alerts.some(alert => alert.severity === 'critical' && !alert.acknowledged);
  }

  /**
   * Get device alert summary
   */
  getDeviceAlertSummary(deviceId) {
    const alerts = this.getDeviceAlerts(deviceId);
    
    return {
      total: alerts.length,
      critical: alerts.filter(a => a.severity === 'critical').length,
      warning: alerts.filter(a => a.severity === 'warning').length,
      acknowledged: alerts.filter(a => a.acknowledged).length,
      unacknowledged: alerts.filter(a => !a.acknowledged).length,
      types: [...new Set(alerts.map(a => a.type))],
      latestAlert: alerts.length > 0 ? alerts[0] : null
    };
  }

  /**
   * Clean up old resolved alerts
   */
  async cleanupOldAlerts(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7 days default
    const cutoffTime = Date.now() - maxAge;
    const initialCount = this.alertHistory.length;
    
    // Remove old alerts from history
    this.alertHistory = this.alertHistory.filter(alert => 
      !alert.resolvedAt || alert.resolvedAt.getTime() > cutoffTime
    );
    
    const removedCount = initialCount - this.alertHistory.length;
    
    if (this.logger && removedCount > 0) {
      this.logger.info(`Cleaned up ${removedCount} old resolved alerts`);
    }
    
    return removedCount;
  }

  /**
   * Export alerts to JSON
   */
  exportAlerts() {
    return {
      activeAlerts: Array.from(this.activeAlerts.values()),
      resolvedAlerts: this.alertHistory,
      statistics: this.getAlertStatistics(),
      exportedAt: new Date().toISOString()
    };
  }

  /**
   * Get alert severity color
   */
  static getSeverityColor(severity) {
    switch (severity) {
      case 'critical':
        return '#dc2626'; // red-600
      case 'warning':
        return '#d97706'; // amber-600
      case 'info':
        return '#2563eb'; // blue-600
      default:
        return '#6b7280'; // gray-500
    }
  }

  /**
   * Get alert type icon
   */
  static getTypeIcon(type) {
    switch (type) {
      case 'cpu':
        return 'cpu';
      case 'memory':
        return 'memory-stick';
      case 'disk':
        return 'hard-drive';
      case 'network':
        return 'wifi';
      case 'offline':
        return 'server-off';
      default:
        return 'alert-triangle';
    }
  }
}