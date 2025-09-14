import React, { useState, useEffect } from 'react';
import { 
  ServerIcon, 
  ExclamationTriangleIcon, 
  ChartBarIcon,
  ClockIcon,
  CpuChipIcon,
  CircleStackIcon
} from '@heroicons/react/24/outline';
import { apiService } from '../services/api';
import MetricsChart from './MetricsChart';
import DeviceStatusCard from './DeviceStatusCard';
import AlertsList from './AlertsList';

const Dashboard = ({ devices, alerts, systemStatus, isConnected }) => {
  const [metricsOverview, setMetricsOverview] = useState(null);
  const [realtimeMetrics, setRealtimeMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
    
    // Set up periodic refresh for real-time data
    const interval = setInterval(loadRealtimeMetrics, 10000); // Every 10 seconds
    
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [overviewResponse, realtimeResponse] = await Promise.all([
        apiService.getMetricsOverview(),
        apiService.getRealtimeMetrics()
      ]);
      
      setMetricsOverview(overviewResponse.overview);
      setRealtimeMetrics(realtimeResponse);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRealtimeMetrics = async () => {
    try {
      const response = await apiService.getRealtimeMetrics();
      setRealtimeMetrics(response);
    } catch (error) {
      console.error('Failed to load realtime metrics:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return 'text-green-600 bg-green-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      case 'critical': return 'text-red-600 bg-red-100';
      case 'offline': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getDeviceStatus = (device) => {
    if (device.status === 'offline') return 'offline';
    if (device.cpu > 90 || device.memory > 95 || device.disk > 95) return 'critical';
    if (device.cpu > 75 || device.memory > 80 || device.disk > 85) return 'warning';
    return 'online';
  };

  const formatUptime = (seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const unacknowledgedAlerts = alerts.filter(alert => !alert.acknowledged);
  const criticalAlerts = unacknowledgedAlerts.filter(alert => alert.severity === 'critical');
  
  // Check if we only have local device
  const hasOnlyLocalDevice = devices.length === 1 && devices[0]?.isLocal;
  const localDevice = devices.find(device => device.isLocal);
  const remoteDevices = devices.filter(device => !device.isLocal);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-lg shadow h-32"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Network Dashboard</h1>
          <p className="text-gray-600">
            Real-time monitoring of your LAN infrastructure
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm text-gray-600">
            {isConnected ? 'Live' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ServerIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Devices</p>
              <p className="text-2xl font-bold text-gray-900">{devices.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <ChartBarIcon className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Online</p>
              <p className="text-2xl font-bold text-gray-900">
                {devices.filter(d => d.status === 'online').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Critical Alerts</p>
              <p className="text-2xl font-bold text-gray-900">{criticalAlerts.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <ClockIcon className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Avg CPU Usage</p>
              <p className="text-2xl font-bold text-gray-900">
                {metricsOverview ? `${metricsOverview.averageUsage.cpu}%` : '0%'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Local System Metrics - Show prominently when only local device exists */}
      {hasOnlyLocalDevice && localDevice && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
          <div className="p-6 border-b border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Local System Monitoring</h2>
                <p className="text-sm text-gray-600">
                  Real-time metrics from {localDevice.hostname} ({localDevice.ip})
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-sm text-green-600 font-medium">Live</span>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="p-4 bg-white rounded-lg shadow-sm border">
                  <CpuChipIcon className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                  <div className={`text-2xl font-bold ${
                    localDevice.cpu > 80 ? 'text-red-600' : 
                    localDevice.cpu > 60 ? 'text-yellow-600' : 'text-green-600'
                  }`}>
                    {localDevice.cpu || 0}%
                  </div>
                  <div className="text-sm text-gray-600">CPU Usage</div>
                </div>
              </div>
              <div className="text-center">
                <div className="p-4 bg-white rounded-lg shadow-sm border">
                  <CircleStackIcon className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <div className={`text-2xl font-bold ${
                    localDevice.memory > 85 ? 'text-red-600' : 
                    localDevice.memory > 70 ? 'text-yellow-600' : 'text-green-600'
                  }`}>
                    {localDevice.memory || 0}%
                  </div>
                  <div className="text-sm text-gray-600">Memory Usage</div>
                </div>
              </div>
              <div className="text-center">
                <div className="p-4 bg-white rounded-lg shadow-sm border">
                  <ServerIcon className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                  <div className={`text-2xl font-bold ${
                    localDevice.disk > 90 ? 'text-red-600' : 
                    localDevice.disk > 75 ? 'text-yellow-600' : 'text-green-600'
                  }`}>
                    {localDevice.disk || 0}%
                  </div>
                  <div className="text-sm text-gray-600">Disk Usage</div>
                </div>
              </div>
              <div className="text-center">
                <div className="p-4 bg-white rounded-lg shadow-sm border">
                  <ClockIcon className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-gray-900">
                    {formatUptime(localDevice.uptime)}
                  </div>
                  <div className="text-sm text-gray-600">Uptime</div>
                </div>
              </div>
            </div>
            
            {/* System Information */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg p-4 shadow-sm border">
                <h3 className="font-medium text-gray-900 mb-3">System Information</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Platform:</span>
                    <span className="font-medium">{localDevice.platform}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Architecture:</span>
                    <span className="font-medium">{localDevice.arch}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">CPU Cores:</span>
                    <span className="font-medium">{localDevice.cpus}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Memory:</span>
                    <span className="font-medium">{localDevice.totalMemory} GB</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-4 shadow-sm border">
                <h3 className="font-medium text-gray-900 mb-3">Quick Actions</h3>
                <div className="space-y-2">
                  <button 
                    onClick={() => window.location.href = '/scan'}
                    className="w-full text-left px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                  >
                    🔍 Scan for Network Devices
                  </button>
                  <button 
                    onClick={() => window.location.href = '/devices'}
                    className="w-full text-left px-3 py-2 text-sm bg-green-50 text-green-700 rounded hover:bg-green-100"
                  >
                    ➕ Add Device Manually
                  </button>
                  <button 
                    onClick={() => window.location.href = '/settings'}
                    className="w-full text-left px-3 py-2 text-sm bg-gray-50 text-gray-700 rounded hover:bg-gray-100"
                  >
                    ⚙️ Configure Thresholds
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Device Status */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Device Status</h2>
            </div>
            <div className="p-6">
              {devices.length === 0 ? (
                <div className="text-center py-8">
                  <ServerIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No devices found</p>
                  <p className="text-sm text-gray-400">Start a network scan to discover devices</p>
                </div>
              ) : hasOnlyLocalDevice ? (
                <div className="text-center py-8">
                  <div className="p-4 bg-blue-50 rounded-lg inline-block mb-4">
                    <ServerIcon className="h-12 w-12 text-blue-600 mx-auto" />
                  </div>
                  <p className="text-gray-900 font-medium">Monitoring Local System</p>
                  <p className="text-sm text-gray-600 mb-4">
                    Currently monitoring {localDevice.hostname} - your local machine
                  </p>
                  <div className="flex justify-center space-x-3">
                    <button 
                      onClick={() => window.location.href = '/scan'}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                    >
                      Discover Network Devices
                    </button>
                    <button 
                      onClick={() => window.location.href = '/devices'}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                    >
                      Add Device Manually
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {devices.slice(0, 6).map((device) => (
                    <DeviceStatusCard 
                      key={device.id} 
                      device={device}
                      status={getDeviceStatus(device)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Alerts */}
        <div>
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Recent Alerts</h2>
            </div>
            <div className="p-6">
              <AlertsList 
                alerts={unacknowledgedAlerts.slice(0, 5)} 
                compact={true}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Resource Usage Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center">
              <CpuChipIcon className="h-5 w-5 text-blue-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">CPU Usage</h3>
            </div>
          </div>
          <div className="p-6">
            <MetricsChart 
              devices={devices}
              metricType="cpu"
              color="#3B82F6"
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center">
              <CircleStackIcon className="h-5 w-5 text-green-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">Memory Usage</h3>
            </div>
          </div>
          <div className="p-6">
            <MetricsChart 
              devices={devices}
              metricType="memory"
              color="#10B981"
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center">
              <ServerIcon className="h-5 w-5 text-purple-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">Disk Usage</h3>
            </div>
          </div>
          <div className="p-6">
            <MetricsChart 
              devices={devices}
              metricType="disk"
              color="#8B5CF6"
            />
          </div>
        </div>
      </div>

      {/* System Information */}
      {systemStatus && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">System Information</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h4 className="text-sm font-medium text-gray-600 mb-2">Monitoring Service</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <span className={`font-medium ${systemStatus.monitoring.isRunning ? 'text-green-600' : 'text-red-600'}`}>
                      {systemStatus.monitoring.isRunning ? 'Running' : 'Stopped'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Refresh Interval:</span>
                    <span>{systemStatus.monitoring.refreshInterval}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span>WebSocket Clients:</span>
                    <span>{systemStatus.monitoring.webSocketClients}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-600 mb-2">Database</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Total Metrics:</span>
                    <span>{systemStatus.database.totalMetrics || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Alerts:</span>
                    <span>{systemStatus.database.totalAlerts || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>DB Size:</span>
                    <span>{Math.round((systemStatus.database.databaseSize || 0) / 1024)} KB</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-600 mb-2">Server</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Uptime:</span>
                    <span>{formatUptime(systemStatus.system.uptime)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Memory:</span>
                    <span>{Math.round(systemStatus.system.memory.used / 1024 / 1024)} MB</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Platform:</span>
                    <span>{systemStatus.system.platform}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;