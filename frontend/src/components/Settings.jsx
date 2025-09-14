import React, { useState, useEffect } from 'react';
import { CogIcon } from '@heroicons/react/24/outline';
import { apiService } from '../services/api';

const Settings = ({ systemStatus, onConfigUpdate }) => {
  const [config, setConfig] = useState({
    refresh_interval: 10,
    cpu_warning_threshold: 75,
    cpu_critical_threshold: 90,
    memory_warning_threshold: 80,
    memory_critical_threshold: 95,
    disk_warning_threshold: 85,
    disk_critical_threshold: 95,
    max_history_days: 30,
    default_community: 'public',
    scan_timeout: 3000,
    snmp_timeout: 5000
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      setLoading(true);
      const response = await apiService.getSystemConfiguration();
      
      // Flatten the grouped configuration
      const flatConfig = {};
      Object.values(response.configuration).forEach(group => {
        Object.entries(group).forEach(([key, { value }]) => {
          flatConfig[key] = isNaN(value) ? value : parseInt(value);
        });
      });
      
      setConfig(prev => ({ ...prev, ...flatConfig }));
    } catch (error) {
      console.error('Failed to load configuration:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await apiService.updateSystemConfiguration(config);
      await onConfigUpdate();
      alert('Configuration saved successfully');
    } catch (error) {
      alert('Failed to save configuration: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleMaintenanceTask = async (task) => {
    try {
      switch (task) {
        case 'cleanup':
          await apiService.cleanupDatabase();
          alert('Database cleanup completed');
          break;
        case 'maintenance':
          await apiService.performMaintenance();
          alert('Maintenance tasks completed');
          break;
        case 'clearLogs':
          await apiService.clearSystemLogs();
          alert('System logs cleared');
          break;
        default:
          break;
      }
    } catch (error) {
      alert(`Failed to perform ${task}: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="bg-white p-6 rounded-lg shadow h-64"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Configure monitoring parameters and system settings</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Monitoring Settings */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Monitoring Settings</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Refresh Interval (seconds)
                </label>
                <input
                  type="number"
                  value={config.refresh_interval}
                  onChange={(e) => setConfig({...config, refresh_interval: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="5"
                  max="300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  History Retention (days)
                </label>
                <input
                  type="number"
                  value={config.max_history_days}
                  onChange={(e) => setConfig({...config, max_history_days: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                  max="365"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Alert Thresholds */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Alert Thresholds</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* CPU Thresholds */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">CPU Usage (%)</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Warning</label>
                    <input
                      type="number"
                      value={config.cpu_warning_threshold}
                      onChange={(e) => setConfig({...config, cpu_warning_threshold: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="1"
                      max="100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Critical</label>
                    <input
                      type="number"
                      value={config.cpu_critical_threshold}
                      onChange={(e) => setConfig({...config, cpu_critical_threshold: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="1"
                      max="100"
                    />
                  </div>
                </div>
              </div>

              {/* Memory Thresholds */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Memory Usage (%)</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Warning</label>
                    <input
                      type="number"
                      value={config.memory_warning_threshold}
                      onChange={(e) => setConfig({...config, memory_warning_threshold: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="1"
                      max="100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Critical</label>
                    <input
                      type="number"
                      value={config.memory_critical_threshold}
                      onChange={(e) => setConfig({...config, memory_critical_threshold: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="1"
                      max="100"
                    />
                  </div>
                </div>
              </div>

              {/* Disk Thresholds */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Disk Usage (%)</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Warning</label>
                    <input
                      type="number"
                      value={config.disk_warning_threshold}
                      onChange={(e) => setConfig({...config, disk_warning_threshold: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="1"
                      max="100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Critical</label>
                    <input
                      type="number"
                      value={config.disk_critical_threshold}
                      onChange={(e) => setConfig({...config, disk_critical_threshold: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="1"
                      max="100"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Network Settings */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Network Settings</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default SNMP Community
                </label>
                <input
                  type="text"
                  value={config.default_community}
                  onChange={(e) => setConfig({...config, default_community: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Scan Timeout (ms)
                </label>
                <input
                  type="number"
                  value={config.scan_timeout}
                  onChange={(e) => setConfig({...config, scan_timeout: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1000"
                  max="30000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  SNMP Timeout (ms)
                </label>
                <input
                  type="number"
                  value={config.snmp_timeout}
                  onChange={(e) => setConfig({...config, snmp_timeout: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1000"
                  max="30000"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </form>

      {/* Maintenance Tasks */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Maintenance Tasks</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => handleMaintenanceTask('cleanup')}
              className="p-4 border border-gray-300 rounded-lg hover:bg-gray-50 text-left"
            >
              <h3 className="font-medium text-gray-900 mb-1">Database Cleanup</h3>
              <p className="text-sm text-gray-500">Remove old metrics and logs</p>
            </button>
            <button
              onClick={() => handleMaintenanceTask('maintenance')}
              className="p-4 border border-gray-300 rounded-lg hover:bg-gray-50 text-left"
            >
              <h3 className="font-medium text-gray-900 mb-1">System Maintenance</h3>
              <p className="text-sm text-gray-500">Run all maintenance tasks</p>
            </button>
            <button
              onClick={() => handleMaintenanceTask('clearLogs')}
              className="p-4 border border-gray-300 rounded-lg hover:bg-gray-50 text-left"
            >
              <h3 className="font-medium text-gray-900 mb-1">Clear Logs</h3>
              <p className="text-sm text-gray-500">Clear system log files</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;