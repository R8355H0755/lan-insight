import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ArrowLeftIcon, 
  CpuChipIcon, 
  CircleStackIcon, 
  ServerIcon,
  ClockIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { apiService } from '../services/api';

const DeviceDetails = ({ devices, onDeviceUpdate }) => {
  const { deviceId } = useParams();
  const [device, setDevice] = useState(null);
  const [metricsHistory, setMetricsHistory] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(24);

  useEffect(() => {
    if (deviceId) {
      loadDeviceDetails();
    }
  }, [deviceId, timeRange]);

  const loadDeviceDetails = async () => {
    try {
      setLoading(true);
      const deviceData = devices.find(d => d.id === deviceId);
      setDevice(deviceData);

      if (deviceData) {
        const [metricsResponse, alertsResponse] = await Promise.all([
          apiService.getDeviceDetailedMetrics(deviceId, timeRange),
          apiService.getDeviceAlerts(deviceId, { limit: 20 })
        ]);

        setMetricsHistory(metricsResponse.metrics);
        setAlerts(alertsResponse.alerts);
      }
    } catch (error) {
      console.error('Failed to load device details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCollectMetrics = async () => {
    try {
      await apiService.collectDeviceMetrics(deviceId);
      await loadDeviceDetails();
      alert('Metrics collected successfully');
    } catch (error) {
      alert('Failed to collect metrics: ' + error.message);
    }
  };

  const handleTestSNMP = async () => {
    try {
      const response = await apiService.testDeviceSNMP(deviceId, device.community);
      if (response.success) {
        alert('SNMP test successful');
      } else {
        alert('SNMP test failed: ' + response.error);
      }
    } catch (error) {
      alert('SNMP test failed: ' + error.message);
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

  const formatUptime = (seconds) => {
    if (!seconds) return 'N/A';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-lg shadow h-32"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!device) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <ServerIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Device not found</h3>
          <Link to="/devices" className="text-blue-600 hover:text-blue-800">
            Back to devices
          </Link>
        </div>
      </div>
    );
  }

  const deviceStatus = device.status === 'offline' ? 'offline' :
    (device.cpu > 90 || device.memory > 95 || device.disk > 95) ? 'critical' :
    (device.cpu > 75 || device.memory > 80 || device.disk > 85) ? 'warning' : 'online';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link 
            to="/devices"
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {device.hostname || device.ip}
            </h1>
            <p className="text-gray-600">{device.ip}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(deviceStatus)}`}>
            {deviceStatus}
          </span>
        </div>
        
        <div className="flex space-x-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={1}>Last Hour</option>
            <option value={6}>Last 6 Hours</option>
            <option value={24}>Last 24 Hours</option>
            <option value={168}>Last Week</option>
          </select>
          <button
            onClick={handleTestSNMP}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            Test SNMP
          </button>
          <button
            onClick={handleCollectMetrics}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Collect Metrics
          </button>
        </div>
      </div>

      {/* Device Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <CpuChipIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">CPU Usage</p>
              <p className={`text-2xl font-bold ${
                device.cpu > 80 ? 'text-red-600' : 
                device.cpu > 60 ? 'text-yellow-600' : 'text-green-600'
              }`}>
                {device.cpu || 0}%
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CircleStackIcon className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Memory Usage</p>
              <p className={`text-2xl font-bold ${
                device.memory > 85 ? 'text-red-600' : 
                device.memory > 70 ? 'text-yellow-600' : 'text-green-600'
              }`}>
                {device.memory || 0}%
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <ServerIcon className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Disk Usage</p>
              <p className={`text-2xl font-bold ${
                device.disk > 90 ? 'text-red-600' : 
                device.disk > 75 ? 'text-yellow-600' : 'text-green-600'
              }`}>
                {device.disk || 0}%
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <ClockIcon className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Uptime</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatUptime(device.uptime)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Device Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Device Information</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">IP Address:</span>
                <span className="font-medium">{device.ip}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Hostname:</span>
                <span className="font-medium">{device.hostname || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">SNMP Community:</span>
                <span className="font-medium">{device.community}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Description:</span>
                <span className="font-medium">{device.description || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Location:</span>
                <span className="font-medium">{device.location || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Last Seen:</span>
                <span className="font-medium">
                  {device.lastSeen ? new Date(device.lastSeen).toLocaleString() : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Alerts */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Recent Alerts</h2>
          </div>
          <div className="p-6">
            {alerts.length === 0 ? (
              <div className="text-center py-8">
                <ExclamationTriangleIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No recent alerts</p>
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.slice(0, 5).map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-3 border rounded-lg ${
                      alert.severity === 'critical' ? 'border-red-200 bg-red-50' :
                      alert.severity === 'warning' ? 'border-yellow-200 bg-yellow-50' :
                      'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {alert.type.toUpperCase()}
                        </p>
                        <p className="text-sm text-gray-600">{alert.message}</p>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(alert.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Metrics History Charts */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Metrics History ({timeRange}h)
          </h2>
        </div>
        <div className="p-6">
          {Object.keys(metricsHistory).length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No historical data available</p>
              <button
                onClick={handleCollectMetrics}
                className="mt-2 text-blue-600 hover:text-blue-800"
              >
                Collect metrics to see historical data
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {['cpu', 'memory', 'disk'].map((metric) => (
                <div key={metric} className="text-center">
                  <h3 className="text-sm font-medium text-gray-700 mb-2 capitalize">
                    {metric} Usage
                  </h3>
                  <div className="h-32 bg-gray-100 rounded-lg flex items-center justify-center">
                    <p className="text-gray-500 text-sm">Chart placeholder</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeviceDetails;