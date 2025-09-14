import React from 'react';
import { 
  ExclamationTriangleIcon,
  CpuChipIcon,
  CircleStackIcon,
  ServerIcon,
  WifiIcon
} from '@heroicons/react/24/outline';

const AlertsList = ({ alerts, compact = false, onAcknowledge, onResolve }) => {
  const getAlertIcon = (type) => {
    switch (type) {
      case 'cpu': return CpuChipIcon;
      case 'memory': return CircleStackIcon;
      case 'disk': return ServerIcon;
      case 'network': return WifiIcon;
      case 'offline': return ServerIcon;
      default: return ExclamationTriangleIcon;
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'info': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const formatTimeAgo = (date) => {
    const now = new Date();
    const alertTime = new Date(date);
    const diffMs = now - alertTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (alerts.length === 0) {
    return (
      <div className="text-center py-8">
        <ExclamationTriangleIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">No alerts</p>
        <p className="text-sm text-gray-400">All systems are running normally</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => {
        const Icon = getAlertIcon(alert.type);
        
        return (
          <div
            key={alert.id}
            className={`p-4 border rounded-lg ${getSeverityColor(alert.severity)} ${
              alert.acknowledged ? 'opacity-60' : ''
            }`}
          >
            <div className="flex items-start space-x-3">
              <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium truncate">
                    {alert.deviceIp} - {alert.type.toUpperCase()}
                  </p>
                  <span className="text-xs">
                    {formatTimeAgo(alert.createdAt)}
                  </span>
                </div>
                
                <p className="text-sm mb-2">{alert.message}</p>
                
                {!compact && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-xs">
                      <span className={`px-2 py-1 rounded-full ${getSeverityColor(alert.severity)}`}>
                        {alert.severity}
                      </span>
                      {alert.acknowledged && (
                        <span className="text-gray-500">
                          Acknowledged by {alert.acknowledgedBy}
                        </span>
                      )}
                    </div>
                    
                    {!alert.acknowledged && onAcknowledge && onResolve && (
                      <div className="flex space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onAcknowledge(alert.id);
                          }}
                          className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        >
                          Acknowledge
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onResolve(alert.id);
                          }}
                          className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                        >
                          Resolve
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AlertsList;