const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      
      return await response.text();
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  // Device endpoints
  async getDevices() {
    return this.request('/devices');
  }

  async getDevice(deviceId) {
    return this.request(`/devices/${deviceId}`);
  }

  async addDevice(deviceData) {
    return this.request('/devices', {
      method: 'POST',
      body: deviceData,
    });
  }

  async updateDevice(deviceId, deviceData) {
    return this.request(`/devices/${deviceId}`, {
      method: 'PUT',
      body: deviceData,
    });
  }

  async deleteDevice(deviceId) {
    return this.request(`/devices/${deviceId}`, {
      method: 'DELETE',
    });
  }

  async testDeviceSNMP(deviceId, community) {
    return this.request(`/devices/${deviceId}/test-snmp`, {
      method: 'POST',
      body: { community },
    });
  }

  async collectDeviceMetrics(deviceId) {
    return this.request(`/devices/${deviceId}/collect-metrics`, {
      method: 'POST',
    });
  }

  async getDeviceMetricsHistory(deviceId, type, hours = 24) {
    const params = new URLSearchParams({ hours: hours.toString() });
    if (type) params.append('type', type);
    return this.request(`/devices/${deviceId}/metrics/history?${params}`);
  }

  // Scan endpoints
  async startNetworkScan(range, options = {}) {
    return this.request('/scan/start', {
      method: 'POST',
      body: { range, options },
    });
  }

  async getScanStatus() {
    return this.request('/scan/status');
  }

  async stopNetworkScan() {
    return this.request('/scan/stop', {
      method: 'POST',
    });
  }

  async getScanHistory(limit = 50) {
    return this.request(`/scan/history?limit=${limit}`);
  }

  async pingHost(ip, timeout = 3000) {
    return this.request('/scan/ping', {
      method: 'POST',
      body: { ip, timeout },
    });
  }

  async scanPorts(ip, ports = null, timeout = 2000) {
    return this.request('/scan/port-scan', {
      method: 'POST',
      body: { ip, ports, timeout },
    });
  }

  async getDiscoveredHosts() {
    return this.request('/scan/discovered-hosts');
  }

  async clearScanCache() {
    return this.request('/scan/clear-cache', {
      method: 'POST',
    });
  }

  async validateIPRange(range) {
    return this.request('/scan/validate-range', {
      method: 'POST',
      body: { range },
    });
  }

  async getScanPresets() {
    return this.request('/scan/presets');
  }

  // Metrics endpoints
  async getMetricsOverview() {
    return this.request('/metrics/overview');
  }

  async getDeviceMetrics() {
    return this.request('/metrics/devices');
  }

  async getDeviceDetailedMetrics(deviceId, hours = 24, metricTypes = null) {
    const params = new URLSearchParams({ hours: hours.toString() });
    if (metricTypes) params.append('metricTypes', metricTypes.join(','));
    return this.request(`/metrics/device/${deviceId}?${params}`);
  }

  async getMetricsHistory(metricType = 'cpu_usage', hours = 24, deviceIds = null) {
    const params = new URLSearchParams({ metricType, hours: hours.toString() });
    if (deviceIds) params.append('deviceIds', deviceIds.join(','));
    return this.request(`/metrics/history?${params}`);
  }

  async getAggregatedMetrics(metricType = 'cpu_usage', period = 'hour', deviceId = null) {
    const params = new URLSearchParams({ metricType, period });
    if (deviceId) params.append('deviceId', deviceId);
    return this.request(`/metrics/aggregated?${params}`);
  }

  async getTopUsageDevices(metricType = 'cpu_usage', limit = 10) {
    return this.request(`/metrics/top-usage?metricType=${metricType}&limit=${limit}`);
  }

  async getMetricsThresholds() {
    return this.request('/metrics/thresholds');
  }

  async getRealtimeMetrics() {
    return this.request('/metrics/realtime');
  }

  // Alert endpoints
  async getAlerts(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });
    return this.request(`/alerts?${params}`);
  }

  async getAlertStatistics() {
    return this.request('/alerts/statistics');
  }

  async getAlert(alertId) {
    return this.request(`/alerts/${alertId}`);
  }

  async acknowledgeAlert(alertId, acknowledgedBy = 'user') {
    return this.request(`/alerts/${alertId}/acknowledge`, {
      method: 'POST',
      body: { acknowledgedBy },
    });
  }

  async resolveAlert(alertId, resolvedBy = 'user') {
    return this.request(`/alerts/${alertId}/resolve`, {
      method: 'POST',
      body: { resolvedBy },
    });
  }

  async deleteAlert(alertId) {
    return this.request(`/alerts/${alertId}`, {
      method: 'DELETE',
    });
  }

  async bulkAcknowledgeAlerts(alertIds, acknowledgedBy = 'user') {
    return this.request('/alerts/bulk-acknowledge', {
      method: 'POST',
      body: { alertIds, acknowledgedBy },
    });
  }

  async bulkResolveAlerts(alertIds, resolvedBy = 'user') {
    return this.request('/alerts/bulk-resolve', {
      method: 'POST',
      body: { alertIds, resolvedBy },
    });
  }

  async getDeviceAlerts(deviceId, filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });
    return this.request(`/alerts/device/${deviceId}?${params}`);
  }

  async createTestAlert(alertData) {
    return this.request('/alerts/test', {
      method: 'POST',
      body: alertData,
    });
  }

  async clearAlertHistory() {
    return this.request('/alerts/clear-history', {
      method: 'POST',
    });
  }

  async exportAlerts() {
    return this.request('/alerts/export');
  }

  // System endpoints
  async getSystemStatus() {
    return this.request('/system/status');
  }

  async getSystemConfiguration() {
    return this.request('/system/configuration');
  }

  async updateSystemConfiguration(config) {
    return this.request('/system/configuration', {
      method: 'PUT',
      body: config,
    });
  }

  async startMonitoring() {
    return this.request('/system/monitoring/start', {
      method: 'POST',
    });
  }

  async stopMonitoring() {
    return this.request('/system/monitoring/stop', {
      method: 'POST',
    });
  }

  async performMaintenance() {
    return this.request('/system/maintenance', {
      method: 'POST',
    });
  }

  async getSystemLogs(lines = 100, level = null) {
    const params = new URLSearchParams({ lines: lines.toString() });
    if (level) params.append('level', level);
    return this.request(`/system/logs?${params}`);
  }

  async clearSystemLogs() {
    return this.request('/system/logs', {
      method: 'DELETE',
    });
  }

  async getDatabaseStats() {
    return this.request('/system/database/stats');
  }

  async cleanupDatabase() {
    return this.request('/system/database/cleanup', {
      method: 'POST',
    });
  }

  async getSystemHealth() {
    return this.request('/system/health');
  }

  async getSystemVersion() {
    return this.request('/system/version');
  }

  // Health check
  async healthCheck() {
    return this.request('/health');
  }
}

// WebSocket service for real-time updates
class WebSocketService {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.listeners = new Map();
    this.isConnected = false;
  }

  connect(url = 'ws://localhost:3001') {
    try {
      this.ws = new WebSocket(url);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        // Subscribe to updates
        this.send({ type: 'subscribe' });
        
        this.emit('connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.emit('message', data);
          
          // Emit specific event types
          if (data.type) {
            this.emit(data.type, data.data);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.isConnected = false;
        this.emit('disconnected');
        
        // Attempt to reconnect
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          setTimeout(() => {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            this.connect(url);
          }, this.reconnectDelay * this.reconnectAttempts);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.emit('error', error);
      };

    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  }

  disconnect() {
    if (this.ws) {
      this.send({ type: 'unsubscribe' });
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in WebSocket event handler for ${event}:`, error);
        }
      });
    }
  }

  ping() {
    this.send({ type: 'ping' });
  }
}

// Create singleton instances
export const apiService = new ApiService();
export const wsService = new WebSocketService();

export default apiService;