import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  HomeIcon, 
  ServerIcon, 
  MagnifyingGlassIcon, 
  ExclamationTriangleIcon, 
  CogIcon,
  WifiIcon,
  SignalIcon
} from '@heroicons/react/24/outline';

const Sidebar = ({ devices, alerts, isConnected }) => {
  const location = useLocation();
  
  const navigation = [
    { name: 'Dashboard', href: '/', icon: HomeIcon },
    { name: 'Devices', href: '/devices', icon: ServerIcon },
    { name: 'Network Scan', href: '/scan', icon: MagnifyingGlassIcon },
    { name: 'Alerts', href: '/alerts', icon: ExclamationTriangleIcon },
    { name: 'Settings', href: '/settings', icon: CogIcon },
  ];

  const getDeviceStatusCounts = () => {
    const counts = {
      online: 0,
      warning: 0,
      critical: 0,
      offline: 0
    };
    
    devices.forEach(device => {
      if (device.status === 'online') {
        // Check if device has high resource usage
        if (device.cpu > 90 || device.memory > 95 || device.disk > 95) {
          counts.critical++;
        } else if (device.cpu > 75 || device.memory > 80 || device.disk > 85) {
          counts.warning++;
        } else {
          counts.online++;
        }
      } else if (device.status === 'offline') {
        counts.offline++;
      } else {
        counts[device.status]++;
      }
    });
    
    return counts;
  };

  const getUnacknowledgedAlerts = () => {
    return alerts.filter(alert => !alert.acknowledged).length;
  };

  const statusCounts = getDeviceStatusCounts();
  const unacknowledgedAlerts = getUnacknowledgedAlerts();

  return (
    <div className="bg-gray-900 text-white w-64 min-h-screen flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <WifiIcon className="h-8 w-8 text-blue-400" />
          <div>
            <h1 className="text-xl font-bold">LAN Insight</h1>
            <div className="flex items-center space-x-1 text-xs">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
              <span className="text-gray-400">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;
            
            return (
              <li key={item.name}>
                <Link
                  to={item.href}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.name}</span>
                  {item.name === 'Alerts' && unacknowledgedAlerts > 0 && (
                    <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 ml-auto">
                      {unacknowledgedAlerts}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Status Summary */}
      <div className="p-4 border-t border-gray-700">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Network Status</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>Online</span>
            </div>
            <span className="text-gray-300">{statusCounts.online}</span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <span>Warning</span>
            </div>
            <span className="text-gray-300">{statusCounts.warning}</span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span>Critical</span>
            </div>
            <span className="text-gray-300">{statusCounts.critical}</span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
              <span>Offline</span>
            </div>
            <span className="text-gray-300">{statusCounts.offline}</span>
          </div>
        </div>
        
        <div className="mt-3 pt-3 border-t border-gray-700">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Total Devices</span>
            <span className="text-white font-medium">{devices.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;