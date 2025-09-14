import React, { useState } from 'react';
import { PlusIcon, ServerIcon } from '@heroicons/react/24/outline';
import DeviceStatusCard from './DeviceStatusCard';

const DeviceList = ({ devices, onDeviceAdd, onDeviceUpdate, onDeviceDelete }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDevice, setNewDevice] = useState({
    ip: '',
    hostname: '',
    community: 'public',
    description: '',
    location: '',
    contact: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await onDeviceAdd(newDevice);
      setNewDevice({
        ip: '',
        hostname: '',
        community: 'public',
        description: '',
        location: '',
        contact: ''
      });
      setShowAddForm(false);
    } catch (error) {
      alert('Failed to add device: ' + error.message);
    }
  };

  const getDeviceStatus = (device) => {
    if (device.status === 'offline') return 'offline';
    if (device.cpu > 90 || device.memory > 95 || device.disk > 95) return 'critical';
    if (device.cpu > 75 || device.memory > 80 || device.disk > 85) return 'warning';
    return 'online';
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Devices</h1>
          <p className="text-gray-600">Manage and monitor network devices</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
        >
          <PlusIcon className="h-5 w-5" />
          <span>Add Device</span>
        </button>
      </div>

      {/* Add Device Form */}
      {showAddForm && (
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Add New Device</h2>
          </div>
          <form onSubmit={handleSubmit} className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  IP Address *
                </label>
                <input
                  type="text"
                  required
                  value={newDevice.ip}
                  onChange={(e) => setNewDevice({...newDevice, ip: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="192.168.1.100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hostname
                </label>
                <input
                  type="text"
                  value={newDevice.hostname}
                  onChange={(e) => setNewDevice({...newDevice, hostname: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="server-01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SNMP Community
                </label>
                <input
                  type="text"
                  value={newDevice.community}
                  onChange={(e) => setNewDevice({...newDevice, community: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="public"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={newDevice.location}
                  onChange={(e) => setNewDevice({...newDevice, location: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Server Room A"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={newDevice.description}
                  onChange={(e) => setNewDevice({...newDevice, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Web server"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Add Device
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Device Grid */}
      {devices.length === 0 ? (
        <div className="bg-white rounded-lg shadow">
          <div className="text-center py-12">
            <ServerIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No devices found</h3>
            <p className="text-gray-500 mb-4">
              Add devices manually or run a network scan to discover them automatically
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Add Your First Device
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Local Device Section */}
          {devices.some(device => device.isLocal) && (
            <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200 mb-6">
              <div className="p-6 border-b border-green-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Local System</h2>
                    <p className="text-sm text-gray-600">Your computer's real-time metrics</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="text-sm text-green-600 font-medium">Live Monitoring</span>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {devices.filter(device => device.isLocal).map((device) => (
                    <div key={device.id} className="bg-white rounded-lg border border-green-200 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <div className="p-2 bg-green-100 rounded-lg">
                            <ServerIcon className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900">{device.hostname}</h3>
                            <p className="text-sm text-gray-600">{device.ip}</p>
                          </div>
                        </div>
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                          Local
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                          <div className={`text-lg font-bold ${
                            device.cpu > 80 ? 'text-red-600' : 
                            device.cpu > 60 ? 'text-yellow-600' : 'text-green-600'
                          }`}>
                            {device.cpu || 0}%
                          </div>
                          <div className="text-xs text-gray-600">CPU</div>
                        </div>
                        <div>
                          <div className={`text-lg font-bold ${
                            device.memory > 85 ? 'text-red-600' : 
                            device.memory > 70 ? 'text-yellow-600' : 'text-green-600'
                          }`}>
                            {device.memory || 0}%
                          </div>
                          <div className="text-xs text-gray-600">Memory</div>
                        </div>
                        <div>
                          <div className={`text-lg font-bold ${
                            device.disk > 90 ? 'text-red-600' : 
                            device.disk > 75 ? 'text-yellow-600' : 'text-green-600'
                          }`}>
                            {device.disk || 0}%
                          </div>
                          <div className="text-xs text-gray-600">Disk</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Remote Devices Section */}
          {devices.filter(device => !device.isLocal).length > 0 && (
            <div className="bg-white rounded-lg shadow mb-6">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Network Devices</h2>
                <p className="text-sm text-gray-600">Devices discovered on your network</p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {devices.filter(device => !device.isLocal).map((device) => (
                    <DeviceStatusCard
                      key={device.id}
                      device={device}
                      status={getDeviceStatus(device)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Show message if only local device exists */}
          {devices.length === 1 && devices[0]?.isLocal && (
            <div className="bg-white rounded-lg shadow">
              <div className="text-center py-12">
                <div className="p-4 bg-blue-50 rounded-lg inline-block mb-4">
                  <ServerIcon className="h-12 w-12 text-blue-600 mx-auto" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to Discover Network Devices</h3>
                <p className="text-gray-500 mb-6">
                  Your local system is being monitored. Discover other devices on your network or add them manually.
                </p>
                <div className="flex justify-center space-x-3">
                  <button
                    onClick={() => window.location.href = '/scan'}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                  >
                    🔍 Scan Network
                  </button>
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200"
                  >
                    ➕ Add Device
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DeviceList;