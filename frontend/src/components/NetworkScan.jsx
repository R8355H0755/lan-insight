import React, { useState, useEffect } from 'react';
import { MagnifyingGlassIcon, StopIcon } from '@heroicons/react/24/outline';
import { apiService } from '../services/api';

const NetworkScan = ({ onScanStart }) => {
  const [scanRange, setScanRange] = useState('192.168.1.1-254');
  const [scanOptions, setScanOptions] = useState({
    timeout: 3000,
    concurrent: 50,
    includePorts: false
  });
  const [scanStatus, setScanStatus] = useState(null);
  const [discoveredHosts, setDiscoveredHosts] = useState([]);
  const [scanHistory, setScanHistory] = useState([]);
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadScanData();
  }, []);

  const loadScanData = async () => {
    try {
      const [statusResponse, historyResponse, presetsResponse] = await Promise.all([
        apiService.getScanStatus(),
        apiService.getScanHistory(10),
        apiService.getScanPresets()
      ]);
      
      setScanStatus(statusResponse.scan);
      setScanHistory(historyResponse.history);
      setPresets(presetsResponse.presets);
    } catch (error) {
      console.error('Failed to load scan data:', error);
    }
  };

  const handleStartScan = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await onScanStart(scanRange, scanOptions);
      await loadScanData();
    } catch (error) {
      alert('Failed to start scan: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStopScan = async () => {
    try {
      await apiService.stopNetworkScan();
      await loadScanData();
    } catch (error) {
      alert('Failed to stop scan: ' + error.message);
    }
  };

  const validateRange = async () => {
    try {
      const response = await apiService.validateIPRange(scanRange);
      if (response.valid) {
        alert(`Valid range: ${response.totalIPs} IPs to scan`);
      } else {
        alert(`Invalid range: ${response.error}`);
      }
    } catch (error) {
      alert('Failed to validate range: ' + error.message);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Network Scanner</h1>
        <p className="text-gray-600">Discover devices on your network</p>
      </div>

      {/* Scan Form */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Start Network Scan</h2>
        </div>
        <form onSubmit={handleStartScan} className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                IP Range
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={scanRange}
                  onChange={(e) => setScanRange(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="192.168.1.1-254"
                  required
                />
                <button
                  type="button"
                  onClick={validateRange}
                  className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                >
                  Validate
                </button>
              </div>
              
              {/* Presets */}
              <div className="mt-2">
                <label className="block text-xs text-gray-500 mb-1">Quick presets:</label>
                <div className="flex flex-wrap gap-1">
                  {presets.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => setScanRange(preset.range)}
                      className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      title={preset.description}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Timeout (ms)
                </label>
                <input
                  type="number"
                  value={scanOptions.timeout}
                  onChange={(e) => setScanOptions({...scanOptions, timeout: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1000"
                  max="10000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Concurrent Scans
                </label>
                <input
                  type="number"
                  value={scanOptions.concurrent}
                  onChange={(e) => setScanOptions({...scanOptions, concurrent: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                  max="100"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="includePorts"
                  checked={scanOptions.includePorts}
                  onChange={(e) => setScanOptions({...scanOptions, includePorts: e.target.checked})}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="includePorts" className="ml-2 text-sm text-gray-700">
                  Scan common ports
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            {scanStatus?.isScanning ? (
              <button
                type="button"
                onClick={handleStopScan}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center space-x-2"
              >
                <StopIcon className="h-5 w-5" />
                <span>Stop Scan</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2 disabled:opacity-50"
              >
                <MagnifyingGlassIcon className="h-5 w-5" />
                <span>{loading ? 'Starting...' : 'Start Scan'}</span>
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Scan Status */}
      {scanStatus && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Scan Status</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {scanStatus.isScanning ? 'Running' : 'Idle'}
                </div>
                <div className="text-sm text-gray-500">Status</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {scanStatus.progress || 0}%
                </div>
                <div className="text-sm text-gray-500">Progress</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {scanStatus.totalActiveHosts || 0}
                </div>
                <div className="text-sm text-gray-500">Hosts Found</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">
                  {scanStatus.totalScanned || 0}
                </div>
                <div className="text-sm text-gray-500">IPs Scanned</div>
              </div>
            </div>
            
            {scanStatus.isScanning && (
              <div className="mt-4">
                <div className="bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${scanStatus.progress || 0}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Scan History */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Scans</h2>
        </div>
        <div className="p-6">
          {scanHistory.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No scan history available</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Range
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total IPs
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Found
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Completed
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {scanHistory.map((scan, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {scan.scan_range}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {scan.total_ips}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {scan.discovered_hosts}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {Math.round(scan.duration_ms / 1000)}s
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(scan.completed_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NetworkScan;