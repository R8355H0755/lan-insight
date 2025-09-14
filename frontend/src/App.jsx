import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import DeviceList from './components/DeviceList';
import NetworkScan from './components/NetworkScan';
import AlertsPanel from './components/AlertsPanel';
import Settings from './components/Settings';
import DeviceDetails from './components/DeviceDetails';
import { apiService, wsService } from './services/api';

function App() {
  const [devices, setDevices] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [systemStatus, setSystemStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  // Initialize WebSocket connection
  useEffect(() => {
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';
    wsService.connect(wsUrl);

    wsService.on('connected', () => {
      setIsConnected(true);
      console.log('Connected to monitoring server');
    });

    wsService.on('disconnected', () => {
      setIsConnected(false);
      console.log('Disconnected from monitoring server');
    });

    wsService.on('monitoringUpdate', (data) => {
      if (data.devices) {
        setDevices(data.devices);
      }
    });

    wsService.on('alertCreated', (alert) => {
      setAlerts(prev => [alert, ...prev]);
    });

    wsService.on('alertResolved', (alert) => {
      setAlerts(prev => prev.filter(a => a.id !== alert.id));
    });

    wsService.on('scanStarted', (data) => {
      console.log('Network scan started:', data);
    });

    wsService.on('scanCompleted', (data) => {
      console.log('Network scan completed:', data);
      // Refresh devices after scan
      loadDevices();
    });

    wsService.on('hostDiscovered', (host) => {
      console.log('New host discovered:', host);
    });

    return () => {
      wsService.disconnect();
    };
  }, []);

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load devices, alerts, and system status in parallel
      const [devicesResponse, alertsResponse, statusResponse] = await Promise.all([
        apiService.getDevices(),
        apiService.getAlerts({ limit: 100 }),
        apiService.getSystemStatus()
      ]);

      setDevices(devicesResponse.devices || []);
      setAlerts(alertsResponse.alerts || []);
      setSystemStatus(statusResponse);

    } catch (err) {
      console.error('Failed to load initial data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadDevices = async () => {
    try {
      const response = await apiService.getDevices();
      setDevices(response.devices || []);
    } catch (err) {
      console.error('Failed to load devices:', err);
    }
  };

  const loadAlerts = async () => {
    try {
      const response = await apiService.getAlerts({ limit: 100 });
      setAlerts(response.alerts || []);
    } catch (err) {
      console.error('Failed to load alerts:', err);
    }
  };

  const handleDeviceAdd = async (deviceData) => {
    try {
      await apiService.addDevice(deviceData);
      await loadDevices();
    } catch (err) {
      console.error('Failed to add device:', err);
      throw err;
    }
  };

  const handleDeviceUpdate = async (deviceId, deviceData) => {
    try {
      await apiService.updateDevice(deviceId, deviceData);
      await loadDevices();
    } catch (err) {
      console.error('Failed to update device:', err);
      throw err;
    }
  };

  const handleDeviceDelete = async (deviceId) => {
    try {
      await apiService.deleteDevice(deviceId);
      await loadDevices();
    } catch (err) {
      console.error('Failed to delete device:', err);
      throw err;
    }
  };

  const handleAlertAcknowledge = async (alertId) => {
    try {
      await apiService.acknowledgeAlert(alertId);
      await loadAlerts();
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
      throw err;
    }
  };

  const handleAlertResolve = async (alertId) => {
    try {
      await apiService.resolveAlert(alertId);
      await loadAlerts();
    } catch (err) {
      console.error('Failed to resolve alert:', err);
      throw err;
    }
  };

  const handleNetworkScan = async (range, options) => {
    try {
      await apiService.startNetworkScan(range, options);
      // WebSocket will handle real-time updates
    } catch (err) {
      console.error('Failed to start network scan:', err);
      throw err;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading LAN Insight...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Connection Error</h1>
          <p className="text-gray-600 mb-4">Failed to connect to the monitoring server</p>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <button
            onClick={loadInitialData}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="flex h-screen bg-gray-100">
        <Sidebar 
          devices={devices}
          alerts={alerts}
          isConnected={isConnected}
        />
        
        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route 
              path="/" 
              element={
                <Dashboard 
                  devices={devices}
                  alerts={alerts}
                  systemStatus={systemStatus}
                  isConnected={isConnected}
                />
              } 
            />
            <Route 
              path="/devices" 
              element={
                <DeviceList 
                  devices={devices}
                  onDeviceAdd={handleDeviceAdd}
                  onDeviceUpdate={handleDeviceUpdate}
                  onDeviceDelete={handleDeviceDelete}
                />
              } 
            />
            <Route 
              path="/devices/:deviceId" 
              element={
                <DeviceDetails 
                  devices={devices}
                  onDeviceUpdate={handleDeviceUpdate}
                />
              } 
            />
            <Route 
              path="/scan" 
              element={
                <NetworkScan 
                  onScanStart={handleNetworkScan}
                />
              } 
            />
            <Route 
              path="/alerts" 
              element={
                <AlertsPanel 
                  alerts={alerts}
                  devices={devices}
                  onAlertAcknowledge={handleAlertAcknowledge}
                  onAlertResolve={handleAlertResolve}
                />
              } 
            />
            <Route 
              path="/settings" 
              element={
                <Settings 
                  systemStatus={systemStatus}
                  onConfigUpdate={loadInitialData}
                />
              } 
            />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;