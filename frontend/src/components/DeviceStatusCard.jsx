import React from 'react';
import { Link } from 'react-router-dom';
import { 
  ServerIcon, 
  CpuChipIcon, 
  CircleStackIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

const DeviceStatusCard = ({ device, status }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return 'bg-green-100 text-green-800 border-green-200';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'offline': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusDot = (status) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'critical': return 'bg-red-500';
      case 'offline': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const formatUptime = (seconds) => {
    if (!seconds) return 'N/A';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  return (
    <Link 
      to={`/devices/${device.id}`}
      className="block p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-2">
          <ServerIcon className="h-5 w-5 text-gray-600" />
          <div>
            <h3 className="font-medium text-gray-900">{device.hostname || device.ip}</h3>
            <p className="text-sm text-gray-500">{device.ip}</p>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <div className={`w-2 h-2 rounded-full ${getStatusDot(status)}`}></div>
          <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(status)}`}>
            {status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <CpuChipIcon className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-xs text-gray-500">CPU</div>
          <div className={`font-medium ${device.cpu > 80 ? 'text-red-600' : device.cpu > 60 ? 'text-yellow-600' : 'text-green-600'}`}>
            {device.cpu || 0}%
          </div>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <CircleStackIcon className="h-4 w-4 text-green-600" />
          </div>
          <div className="text-xs text-gray-500">Memory</div>
          <div className={`font-medium ${device.memory > 85 ? 'text-red-600' : device.memory > 70 ? 'text-yellow-600' : 'text-green-600'}`}>
            {device.memory || 0}%
          </div>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <ClockIcon className="h-4 w-4 text-purple-600" />
          </div>
          <div className="text-xs text-gray-500">Uptime</div>
          <div className="font-medium text-gray-900">
            {formatUptime(device.uptime)}
          </div>
        </div>
      </div>

      {device.lastSeen && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="text-xs text-gray-500">
            Last seen: {new Date(device.lastSeen).toLocaleTimeString()}
          </div>
        </div>
      )}
    </Link>
  );
};

export default DeviceStatusCard;