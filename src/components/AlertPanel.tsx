import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AlertTriangle, 
  XCircle, 
  CheckCircle, 
  Clock,
  X,
  Check,
  Bell,
  BellOff 
} from 'lucide-react';
import { Alert } from './MonitoringDashboard';

interface AlertPanelProps {
  alerts: Alert[];
  setAlerts: (alerts: Alert[]) => void;
}

export const AlertPanel = ({ alerts, setAlerts }: AlertPanelProps) => {
  const acknowledgeAlert = (alertId: string) => {
    setAlerts(alerts.map(alert => 
      alert.id === alertId 
        ? { ...alert, acknowledged: true }
        : alert
    ));
  };

  const dismissAlert = (alertId: string) => {
    setAlerts(alerts.filter(alert => alert.id !== alertId));
  };

  const acknowledgeAllAlerts = () => {
    setAlerts(alerts.map(alert => ({ ...alert, acknowledged: true })));
  };

  const getSeverityColor = (severity: Alert['severity']) => {
    switch (severity) {
      case 'warning': return 'text-status-warning bg-status-warning/10 border-status-warning/20';
      case 'critical': return 'text-status-critical bg-status-critical/10 border-status-critical/20';
      default: return 'text-muted-foreground bg-muted/10 border-border';
    }
  };

  const getSeverityIcon = (severity: Alert['severity']) => {
    switch (severity) {
      case 'warning': return <AlertTriangle className="h-3 w-3" />;
      case 'critical': return <XCircle className="h-3 w-3" />;
      default: return <Bell className="h-3 w-3" />;
    }
  };

  const getTypeIcon = (type: Alert['type']) => {
    switch (type) {
      case 'cpu': return '🔥';
      case 'memory': return '💾';
      case 'disk': return '💽';
      case 'offline': return '📡';
      default: return '⚠️';
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  const activeAlerts = alerts.filter(alert => !alert.acknowledged);
  const acknowledgedAlerts = alerts.filter(alert => alert.acknowledged);
  const criticalAlerts = alerts.filter(alert => alert.severity === 'critical' && !alert.acknowledged);
  const warningAlerts = alerts.filter(alert => alert.severity === 'warning' && !alert.acknowledged);

  const AlertRow = ({ alert }: { alert: Alert }) => (
    <TableRow key={alert.id} className={alert.acknowledged ? 'opacity-60' : ''}>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="text-lg">{getTypeIcon(alert.type)}</span>
          <Badge 
            variant="outline" 
            className={`capitalize ${getSeverityColor(alert.severity)}`}
          >
            {getSeverityIcon(alert.severity)}
            <span className="ml-1">{alert.severity}</span>
          </Badge>
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <div className="font-medium">{alert.message}</div>
          <div className="text-sm text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatTimestamp(alert.timestamp)}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <code className="text-xs bg-muted px-2 py-1 rounded">{alert.deviceIp}</code>
      </TableCell>
      <TableCell>
        {alert.acknowledged ? (
          <Badge variant="outline" className="text-status-online bg-status-online/10 border-status-online/20">
            <CheckCircle className="h-3 w-3 mr-1" />
            Acknowledged
          </Badge>
        ) : (
          <Badge variant="outline" className="text-destructive bg-destructive/10 border-destructive/20">
            <Bell className="h-3 w-3 mr-1" />
            Active
          </Badge>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          {!alert.acknowledged && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => acknowledgeAlert(alert.id)}
              className="h-7 text-xs"
            >
              <Check className="h-3 w-3 mr-1" />
              Ack
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => dismissAlert(alert.id)}
            className="h-7 text-xs text-destructive hover:text-destructive"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-6">
      {/* Alert Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <Bell className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{activeAlerts.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
            <XCircle className="h-4 w-4 text-status-critical" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-status-critical">{criticalAlerts.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Warning</CardTitle>
            <AlertTriangle className="h-4 w-4 text-status-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-status-warning">{warningAlerts.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Acknowledged</CardTitle>
            <CheckCircle className="h-4 w-4 text-status-online" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-status-online">{acknowledgedAlerts.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Alert Actions */}
      {activeAlerts.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <span className="font-medium">
                  {activeAlerts.length} active alert{activeAlerts.length !== 1 ? 's' : ''} require attention
                </span>
              </div>
              <Button
                variant="outline"
                onClick={acknowledgeAllAlerts}
                className="flex items-center gap-2"
              >
                <Check className="h-4 w-4" />
                Acknowledge All
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alert List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Alert Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="active" className="space-y-4">
            <TabsList className="grid grid-cols-3 w-full max-w-md">
              <TabsTrigger value="active">
                Active ({activeAlerts.length})
              </TabsTrigger>
              <TabsTrigger value="acknowledged">
                Acknowledged ({acknowledgedAlerts.length})
              </TabsTrigger>
              <TabsTrigger value="all">
                All ({alerts.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active">
              {activeAlerts.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-status-online mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Active Alerts</h3>
                  <p className="text-muted-foreground">All systems are running normally</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Severity</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead>Device</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeAlerts.map(alert => (
                        <AlertRow key={alert.id} alert={alert} />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="acknowledged">
              {acknowledgedAlerts.length === 0 ? (
                <div className="text-center py-8">
                  <BellOff className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Acknowledged Alerts</h3>
                  <p className="text-muted-foreground">No alerts have been acknowledged yet</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Severity</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead>Device</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {acknowledgedAlerts.map(alert => (
                        <AlertRow key={alert.id} alert={alert} />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="all">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Severity</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alerts.map(alert => (
                      <AlertRow key={alert.id} alert={alert} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};