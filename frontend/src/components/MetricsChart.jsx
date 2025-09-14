import React from 'react';

const MetricsChart = ({ devices, metricType, color }) => {
  const getMetricValue = (device, type) => {
    switch (type) {
      case 'cpu': return device.cpu || 0;
      case 'memory': return device.memory || 0;
      case 'disk': return device.disk || 0;
      default: return 0;
    }
  };

  const onlineDevices = devices.filter(device => device.status === 'online');
  
  if (onlineDevices.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No online devices</p>
      </div>
    );
  }

  const maxValue = 100; // Percentage
  const chartHeight = 200;

  return (
    <div className="space-y-4">
      {/* Chart */}
      <div className="relative" style={{ height: chartHeight }}>
        <svg width="100%" height={chartHeight} className="overflow-visible">
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((value) => (
            <g key={value}>
              <line
                x1="0"
                y1={chartHeight - (value / maxValue) * chartHeight}
                x2="100%"
                y2={chartHeight - (value / maxValue) * chartHeight}
                stroke="#e5e7eb"
                strokeWidth="1"
              />
              <text
                x="0"
                y={chartHeight - (value / maxValue) * chartHeight - 5}
                fontSize="12"
                fill="#6b7280"
              >
                {value}%
              </text>
            </g>
          ))}
          
          {/* Bars */}
          {onlineDevices.map((device, index) => {
            const value = getMetricValue(device, metricType);
            const barWidth = (100 / onlineDevices.length) - 2;
            const barHeight = (value / maxValue) * chartHeight;
            const x = (index * (100 / onlineDevices.length)) + 1;
            
            return (
              <g key={device.id}>
                <rect
                  x={`${x}%`}
                  y={chartHeight - barHeight}
                  width={`${barWidth}%`}
                  height={barHeight}
                  fill={color}
                  opacity={0.8}
                  className="hover:opacity-100 transition-opacity"
                />
                <text
                  x={`${x + barWidth/2}%`}
                  y={chartHeight - barHeight - 5}
                  fontSize="10"
                  fill="#374151"
                  textAnchor="middle"
                >
                  {value}%
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Device labels */}
      <div className="flex justify-between text-xs text-gray-600">
        {onlineDevices.map((device) => (
          <div key={device.id} className="text-center flex-1">
            <div className="truncate" title={device.hostname || device.ip}>
              {(device.hostname || device.ip).substring(0, 8)}
              {(device.hostname || device.ip).length > 8 ? '...' : ''}
            </div>
          </div>
        ))}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div className="text-center">
          <div className="text-gray-500">Average</div>
          <div className="font-semibold">
            {Math.round(
              onlineDevices.reduce((sum, device) => sum + getMetricValue(device, metricType), 0) / 
              onlineDevices.length
            )}%
          </div>
        </div>
        <div className="text-center">
          <div className="text-gray-500">Maximum</div>
          <div className="font-semibold">
            {Math.max(...onlineDevices.map(device => getMetricValue(device, metricType)))}%
          </div>
        </div>
        <div className="text-center">
          <div className="text-gray-500">Devices</div>
          <div className="font-semibold">{onlineDevices.length}</div>
        </div>
      </div>
    </div>
  );
};

export default MetricsChart;