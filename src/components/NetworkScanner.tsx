import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Radar, 
  Play, 
  Pause, 
  Settings, 
  RefreshCw,
  Clock,
  Wifi,
  Shield
} from 'lucide-react';

interface NetworkScannerProps {
  scanRange: string;
  setScanRange: (range: string) => void;
  isScanning: boolean;
  onStartScan: () => void;
  refreshInterval: number;
  setRefreshInterval: (interval: number) => void;
}

export const NetworkScanner = ({
  scanRange,
  setScanRange,
  isScanning,
  onStartScan,
  refreshInterval,
  setRefreshInterval
}: NetworkScannerProps) => {
  const scanProgress = isScanning ? Math.floor(Math.random() * 100) : 0;

  const commonRanges = [
    { label: 'Home Network', range: '192.168.1.1-254' },
    { label: 'Office Network', range: '192.168.0.1-254' },
    { label: 'Small Business', range: '10.0.0.1-100' },
    { label: 'Enterprise', range: '172.16.0.1-255' }
  ];

  const snmpCommunities = [
    { name: 'public', description: 'Default read-only community' },
    { name: 'private', description: 'Default read-write community' },
    { name: 'monitoring', description: 'Custom monitoring community' }
  ];

  return (
    <div className="space-y-6">
      {/* Scanner Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radar className="h-5 w-5" />
            Network Scanner Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* IP Range Configuration */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="scan-range">IP Range to Scan</Label>
              <Input
                id="scan-range"
                placeholder="192.168.1.1-254"
                value={scanRange}
                onChange={(e) => setScanRange(e.target.value)}
                className="font-mono"
              />
              <p className="text-sm text-muted-foreground">
                Enter IP range in format: 192.168.1.1-254 or single IP: 192.168.1.100
              </p>
            </div>

            <div className="space-y-2">
              <Label>Quick Range Selection</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {commonRanges.map((range) => (
                  <Button
                    key={range.range}
                    variant="outline"
                    size="sm"
                    onClick={() => setScanRange(range.range)}
                    className="text-xs"
                  >
                    {range.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <Separator />

          {/* Refresh Interval */}
          <div className="space-y-2">
            <Label htmlFor="refresh-interval">Refresh Interval (seconds)</Label>
            <div className="flex items-center gap-4">
              <Input
                id="refresh-interval"
                type="number"
                min="5"
                max="300"
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(parseInt(e.target.value) || 10)}
                className="w-32"
              />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Data collected every {refreshInterval} seconds
              </div>
            </div>
          </div>

          <Separator />

          {/* SNMP Configuration */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <Label>SNMP Communities</Label>
            </div>
            <div className="grid gap-3">
              {snmpCommunities.map((community) => (
                <div key={community.name} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        {community.name}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{community.description}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    Active
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scan Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Scan Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="font-medium">Network Discovery</div>
              <p className="text-sm text-muted-foreground">
                Scan the specified IP range for active devices
              </p>
            </div>
            <Button
              onClick={onStartScan}
              disabled={isScanning}
              className="flex items-center gap-2"
            >
              {isScanning ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Start Scan
                </>
              )}
            </Button>
          </div>

          {isScanning && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Scanning progress</span>
                <span>{scanProgress}%</span>
              </div>
              <Progress value={scanProgress} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Discovering devices in range {scanRange}...
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scan Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            Scanner Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="space-y-1">
                <div className="font-medium text-sm">SNMP Protocol</div>
                <p className="text-xs text-muted-foreground">
                  Simple Network Management Protocol v2c
                </p>
              </div>
              <Badge variant="outline">Enabled</Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="space-y-1">
                <div className="font-medium text-sm">Port Scanning</div>
                <p className="text-xs text-muted-foreground">
                  TCP/UDP 161 (SNMP), 22 (SSH), 80 (HTTP)
                </p>
              </div>
              <Badge variant="outline">Active</Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="space-y-1">
                <div className="font-medium text-sm">Discovery Method</div>
                <p className="text-xs text-muted-foreground">
                  ICMP ping + SNMP probe + Port scan
                </p>
              </div>
              <Badge variant="outline">Multi-method</Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="space-y-1">
                <div className="font-medium text-sm">Timeout Settings</div>
                <p className="text-xs text-muted-foreground">
                  Connection: 5s, SNMP: 3s, Retry: 2x
                </p>
              </div>
              <Badge variant="outline">Optimized</Badge>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="font-medium text-sm">Supported Metrics</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-chart-1 rounded-full"></div>
                CPU Usage (%)
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-chart-2 rounded-full"></div>
                Memory Usage (%)
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-chart-3 rounded-full"></div>
                Disk Usage (%)
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-chart-4 rounded-full"></div>
                Network Interfaces
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-chart-5 rounded-full"></div>
                System Uptime
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-status-online rounded-full"></div>
                Device Info
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};