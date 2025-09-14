import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { 
  Server, 
  Cpu, 
  MemoryStick, 
  HardDrive, 
  Clock,
  Wifi,
  MoreHorizontal 
} from 'lucide-react';
import { Device } from './MonitoringDashboard';

interface DeviceListProps {
  devices: Device[];
}

export const DeviceList = ({ devices }: DeviceListProps) => {
  const getStatusColor = (status: Device['status']) => {
    switch (status) {
      case 'online': return 'text-status-online bg-status-online/10 border-status-online/20';
      case 'warning': return 'text-status-warning bg-status-warning/10 border-status-warning/20';
      case 'critical': return 'text-status-critical bg-status-critical/10 border-status-critical/20';
      case 'offline': return 'text-status-offline bg-status-offline/10 border-status-offline/20';
      default: return 'text-muted-foreground bg-muted/10 border-border';
    }
  };

  const getStatusIcon = (status: Device['status']) => {
    switch (status) {
      case 'online': return <Wifi className="h-3 w-3" />;
      case 'warning': return <Wifi className="h-3 w-3" />;
      case 'critical': return <Wifi className="h-3 w-3" />;
      case 'offline': return <Server className="h-3 w-3" />;
      default: return <Server className="h-3 w-3" />;
    }
  };

  const formatUptime = (minutes: number) => {
    const days = Math.floor(minutes / (24 * 60));
    const hours = Math.floor((minutes % (24 * 60)) / 60);
    const mins = minutes % 60;
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const getProgressColor = (value: number) => {
    if (value >= 95) return 'bg-status-critical';
    if (value >= 85) return 'bg-status-warning';
    return 'bg-status-online';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="h-5 w-5" />
          Network Devices ({devices.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>CPU</TableHead>
                <TableHead>Memory</TableHead>
                <TableHead>Disk</TableHead>
                <TableHead>Uptime</TableHead>
                <TableHead>Community</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {devices.map((device) => (
                <TableRow key={device.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium">{device.hostname}</div>
                      <div className="text-sm text-muted-foreground">{device.ip}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline" 
                      className={`capitalize ${getStatusColor(device.status)}`}
                    >
                      {getStatusIcon(device.status)}
                      <span className="ml-1">{device.status}</span>
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Cpu className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm font-medium">{device.cpu}%</span>
                      </div>
                      <Progress 
                        value={device.cpu} 
                        className="h-1"
                        indicatorClassName={getProgressColor(device.cpu)}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <MemoryStick className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm font-medium">{device.memory}%</span>
                      </div>
                      <Progress 
                        value={device.memory} 
                        className="h-1"
                        indicatorClassName={getProgressColor(device.memory)}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <HardDrive className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm font-medium">{device.disk}%</span>
                      </div>
                      <Progress 
                        value={device.disk} 
                        className="h-1"
                        indicatorClassName={getProgressColor(device.disk)}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm">{formatUptime(device.uptime)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {device.community}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};