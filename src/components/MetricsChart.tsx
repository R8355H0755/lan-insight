import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts';
import { TrendingUp, Activity, Cpu, MemoryStick, HardDrive } from 'lucide-react';
import { Device } from './MonitoringDashboard';

interface MetricsChartProps {
  devices: Device[];
}

interface HistoricalData {
  timestamp: string;
  time: string;
  [key: string]: string | number;
}

export const MetricsChart = ({ devices }: MetricsChartProps) => {
  const [historicalData, setHistoricalData] = useState<HistoricalData[]>([]);

  // Generate historical data
  useEffect(() => {
    const generateHistoricalData = () => {
      const data: HistoricalData[] = [];
      const now = new Date();
      
      // Generate last 20 data points (10 minutes of data with 30s intervals)
      for (let i = 19; i >= 0; i--) {
        const timestamp = new Date(now.getTime() - i * 30000);
        const entry: HistoricalData = {
          timestamp: timestamp.toISOString(),
          time: timestamp.toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
          })
        };

        // Add current device data for the last entry, simulate for others
        devices.forEach(device => {
          const baseValue = i === 0 ? device.cpu : 30 + Math.random() * 40;
          entry[`${device.hostname}_cpu`] = Math.round(baseValue + Math.sin(i * 0.3) * 10);
          
          const memValue = i === 0 ? device.memory : 40 + Math.random() * 30;
          entry[`${device.hostname}_memory`] = Math.round(memValue + Math.cos(i * 0.2) * 8);
          
          const diskValue = i === 0 ? device.disk : 50 + Math.random() * 25;
          entry[`${device.hostname}_disk`] = Math.round(diskValue + Math.sin(i * 0.1) * 5);
        });

        data.push(entry);
      }
      
      return data;
    };

    setHistoricalData(generateHistoricalData());
  }, [devices]);

  const chartColors = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium mb-2">{`Time: ${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {`${entry.name}: ${entry.value}%`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderCpuChart = () => (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={historicalData}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis 
          dataKey="time" 
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
        />
        <YAxis 
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          domain={[0, 100]}
        />
        <Tooltip content={<CustomTooltip />} />
        {devices.map((device, index) => (
          <Line
            key={device.id}
            type="monotone"
            dataKey={`${device.hostname}_cpu`}
            stroke={chartColors[index % chartColors.length]}
            strokeWidth={2}
            dot={false}
            name={device.hostname}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );

  const renderMemoryChart = () => (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={historicalData}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis 
          dataKey="time" 
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
        />
        <YAxis 
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          domain={[0, 100]}
        />
        <Tooltip content={<CustomTooltip />} />
        {devices.map((device, index) => (
          <Area
            key={device.id}
            type="monotone"
            dataKey={`${device.hostname}_memory`}
            stackId="1"
            stroke={chartColors[index % chartColors.length]}
            fill={chartColors[index % chartColors.length]}
            fillOpacity={0.3}
            name={device.hostname}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );

  const renderDiskChart = () => (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={historicalData.slice(-5)}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis 
          dataKey="time" 
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
        />
        <YAxis 
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          domain={[0, 100]}
        />
        <Tooltip content={<CustomTooltip />} />
        {devices.map((device, index) => (
          <Bar
            key={device.id}
            dataKey={`${device.hostname}_disk`}
            fill={chartColors[index % chartColors.length]}
            name={device.hostname}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );

  const calculateAverage = (metric: string) => {
    const values = devices.map(device => {
      switch (metric) {
        case 'cpu': return device.cpu;
        case 'memory': return device.memory;
        case 'disk': return device.disk;
        default: return 0;
      }
    });
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  };

  return (
    <div className="space-y-6">
      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average CPU Usage</CardTitle>
            <Cpu className="h-4 w-4 text-chart-1" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-chart-1">{calculateAverage('cpu')}%</div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 inline mr-1" />
              Across all devices
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Memory Usage</CardTitle>
            <MemoryStick className="h-4 w-4 text-chart-2" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-chart-2">{calculateAverage('memory')}%</div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 inline mr-1" />
              Across all devices
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Disk Usage</CardTitle>
            <HardDrive className="h-4 w-4 text-chart-3" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-chart-3">{calculateAverage('disk')}%</div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 inline mr-1" />
              Across all devices
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="cpu" className="space-y-4">
            <TabsList className="grid grid-cols-3 w-full max-w-sm">
              <TabsTrigger value="cpu">CPU Usage</TabsTrigger>
              <TabsTrigger value="memory">Memory</TabsTrigger>
              <TabsTrigger value="disk">Disk</TabsTrigger>
            </TabsList>

            <TabsContent value="cpu" className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">CPU Usage Over Time</h3>
                <p className="text-sm text-muted-foreground">Real-time CPU utilization across all monitored devices</p>
              </div>
              {renderCpuChart()}
            </TabsContent>

            <TabsContent value="memory" className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Memory Usage Trends</h3>
                <p className="text-sm text-muted-foreground">Memory consumption patterns across devices</p>
              </div>
              {renderMemoryChart()}
            </TabsContent>

            <TabsContent value="disk" className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Disk Usage Snapshot</h3>
                <p className="text-sm text-muted-foreground">Current disk utilization across all devices</p>
              </div>
              {renderDiskChart()}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};