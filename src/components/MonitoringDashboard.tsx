import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  Server, 
  Wifi, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Clock,
  HardDrive,
  Cpu,
  MemoryStick,
  Play,
  Pause,
  RefreshCw
} from 'lucide-react';
import { DeviceList } from './DeviceList';
import { MetricsChart } from './MetricsChart';
import { AlertPanel } from './AlertPanel';
import { NetworkScanner } from './NetworkScanner';

export interface Device {
  id: string;
  ip: string;
  hostname: string;
  status: 'online' | 'warning' | 'critical' | 'offline';
  cpu: number;
  memory: number;
  disk: number;
  uptime: number;
  lastSeen: Date;
  community: string;
}

export interface Alert {
  id: string;
  deviceIp: string;
  type: 'cpu' | 'memory' | 'disk' | 'offline';
  severity: 'warning' | 'critical';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
}

// Simulated device data generator
const generateDeviceData = (): Device[] => {
  const devices: Device[] = [];
  const baseIps = ['192.168.1.1', '192.168.1.10', '192.168.1.50', '192.168.1.100', '192.168.1.150'];
  const hostnames = ['gateway-01', 'server-db', 'app-server-01', 'web-server', 'backup-storage'];
  
  baseIps.forEach((ip, index) => {
    const cpu = Math.random() * 100;
    const memory = Math.random() * 100;
    const disk = Math.random() * 100;
    
    let status: Device['status'] = 'online';
    if (cpu > 90 || memory > 90 || disk > 95) status = 'critical';
    else if (cpu > 75 || memory > 75 || disk > 85) status = 'warning';
    if (Math.random() < 0.1) status = 'offline';
    
    devices.push({
      id: `device-${index}`,
      ip,
      hostname: hostnames[index],
      status,
      cpu: Math.round(cpu),
      memory: Math.round(memory),
      disk: Math.round(disk),
      uptime: Math.floor(Math.random() * 365 * 24 * 60), // minutes
      lastSeen: new Date(Date.now() - Math.random() * 60000),
      community: Math.random() > 0.5 ? 'public' : 'private'
    });
  });
  
  return devices;
};

export const MonitoringDashboard = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanRange, setScanRange] = useState('192.168.1.1-254');
  const [refreshInterval, setRefreshInterval] = useState(10);
  const [isMonitoring, setIsMonitoring] = useState(true);

  // Initialize with sample data
  useEffect(() => {
    const initialDevices = generateDeviceData();
    setDevices(initialDevices);
    generateAlerts(initialDevices);
  }, []);

  // Generate alerts based on device status
  const generateAlerts = (devices: Device[]) => {
    const newAlerts: Alert[] = [];
    
    devices.forEach(device => {
      if (device.status === 'offline') {
        newAlerts.push({
          id: `alert-${device.id}-offline`,
          deviceIp: device.ip,
          type: 'offline',
          severity: 'critical',
          message: `Device ${device.hostname} (${device.ip}) is unreachable`,
          timestamp: new Date(),
          acknowledged: false
        });
      }
      
      if (device.cpu > 90) {
        newAlerts.push({
          id: `alert-${device.id}-cpu`,
          deviceIp: device.ip,
          type: 'cpu',
          severity: device.cpu > 95 ? 'critical' : 'warning',
          message: `High CPU usage on ${device.hostname}: ${device.cpu}%`,
          timestamp: new Date(),
          acknowledged: false
        });
      }
      
      if (device.memory > 90) {
        newAlerts.push({
          id: `alert-${device.id}-memory`,
          deviceIp: device.ip,
          type: 'memory',
          severity: device.memory > 95 ? 'critical' : 'warning',
          message: `High memory usage on ${device.hostname}: ${device.memory}%`,
          timestamp: new Date(),
          acknowledged: false
        });
      }
      
      if (device.disk > 95) {
        newAlerts.push({
          id: `alert-${device.id}-disk`,
          deviceIp: device.ip,
          type: 'disk',
          severity: 'critical',
          message: `Disk space critical on ${device.hostname}: ${device.disk}%`,
          timestamp: new Date(),
          acknowledged: false
        });
      }
    });
    
    setAlerts(newAlerts);
  };

  // Periodic refresh
  useEffect(() => {
    if (!isMonitoring) return;
    
    const interval = setInterval(() => {
      const updatedDevices = generateDeviceData();
      setDevices(updatedDevices);
      generateAlerts(updatedDevices);
    }, refreshInterval * 1000);
    
    return () => clearInterval(interval);
  }, [refreshInterval, isMonitoring]);

  const startScan = () => {
    setIsScanning(true);
    // Simulate network scan
    setTimeout(() => {
      const newDevices = generateDeviceData();
      setDevices(newDevices);
      generateAlerts(newDevices);
      setIsScanning(false);
    }, 3000);
  };

  const onlineDevices = devices.filter(d => d.status === 'online').length;
  const warningDevices = devices.filter(d => d.status === 'warning').length;
  const criticalDevices = devices.filter(d => d.status === 'critical').length;
  const offlineDevices = devices.filter(d => d.status === 'offline').length;
  const unacknowledgedAlerts = alerts.filter(a => !a.acknowledged).length;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">LAN Server Monitor</h1>
              <p className="text-muted-foreground">Real-time network monitoring dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={isMonitoring ? "default" : "secondary"} className="flex items-center gap-1">
              {isMonitoring ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
              {isMonitoring ? 'Monitoring' : 'Paused'}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsMonitoring(!isMonitoring)}
            >
              {isMonitoring ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Online Devices</CardTitle>
              <CheckCircle className="h-4 w-4 text-status-online" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-status-online">{onlineDevices}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Warning</CardTitle>
              <AlertTriangle className="h-4 w-4 text-status-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-status-warning">{warningDevices}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Critical</CardTitle>
              <XCircle className="h-4 w-4 text-status-critical" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-status-critical">{criticalDevices}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Offline</CardTitle>
              <Server className="h-4 w-4 text-status-offline" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-status-offline">{offlineDevices}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{unacknowledgedAlerts}</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="devices" className="space-y-4">
          <TabsList className="grid grid-cols-4 w-full max-w-md">
            <TabsTrigger value="devices">Devices</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
            <TabsTrigger value="scanner">Scanner</TabsTrigger>
          </TabsList>

          <TabsContent value="devices" className="space-y-4">
            <DeviceList devices={devices} />
          </TabsContent>

          <TabsContent value="metrics" className="space-y-4">
            <MetricsChart devices={devices} />
          </TabsContent>

          <TabsContent value="alerts" className="space-y-4">
            <AlertPanel alerts={alerts} setAlerts={setAlerts} />
          </TabsContent>

          <TabsContent value="scanner" className="space-y-4">
            <NetworkScanner
              scanRange={scanRange}
              setScanRange={setScanRange}
              isScanning={isScanning}
              onStartScan={startScan}
              refreshInterval={refreshInterval}
              setRefreshInterval={setRefreshInterval}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};