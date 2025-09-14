# LAN Insight - Network Monitoring System

A comprehensive server monitoring system for Local Area Networks (LAN) that continuously tracks, collects, and displays system metrics from multiple devices using SNMP protocol.

## 🚀 Features

### Core Functionality
- **Network Discovery**: Automatically scan LAN subnet ranges to discover active hosts
- **SNMP Monitoring**: Collect system metrics using SNMP protocol
- **Real-time Dashboard**: Live monitoring with WebSocket updates
- **Historical Data**: Store and visualize historical metrics
- **Alert System**: Configurable thresholds with real-time notifications
- **Multi-device Support**: Monitor multiple devices simultaneously

### System Metrics Collected
- **CPU Usage**: Real-time processor utilization
- **Memory Usage**: RAM consumption monitoring
- **Disk Usage**: Storage utilization tracking
- **System Uptime**: Device availability tracking
- **Network Status**: Connectivity monitoring

### Advanced Features
- **Multiple SNMP Communities**: Support for different community strings
- **Configurable Thresholds**: Customizable warning and critical levels
- **WebSocket Integration**: Real-time updates without page refresh
- **RESTful API**: Complete API for external integrations
- **Responsive UI**: Modern web interface with mobile support
- **Database Storage**: SQLite for reliable data persistence

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │    Database     │
│   (React)       │◄──►│   (Node.js)     │◄──►│   (SQLite)      │
│                 │    │                 │    │                 │
│ • Dashboard     │    │ • SNMP Client   │    │ • Metrics       │
│ • Device Mgmt   │    │ • Network Scan  │    │ • Devices       │
│ • Alerts        │    │ • Alert Engine  │    │ • Alerts        │
│ • Settings      │    │ • WebSocket     │    │ • Config        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │
         │              ┌─────────────────┐
         └──────────────►│   Network       │
                        │   Devices       │
                        │   (SNMP)        │
                        └─────────────────┘
```

## 📋 Prerequisites

- **Node.js** (v16 or higher)
- **npm** or **yarn**
- **Network access** to target devices
- **SNMP enabled** on target devices

## 🛠️ Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd lan-insight
```

### 2. Backend Setup
```bash
cd backend
npm install
```

Create `.env` file:
```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Database Configuration
DB_PATH=./data/monitoring.db

# SNMP Configuration
DEFAULT_COMMUNITY=public
SNMP_TIMEOUT=5000
SNMP_RETRIES=2

# Network Scanning
DEFAULT_SCAN_RANGE=192.168.1.1-254
SCAN_TIMEOUT=3000
PING_TIMEOUT=2000

# Monitoring Configuration
DEFAULT_REFRESH_INTERVAL=10
MAX_HISTORY_DAYS=30
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install
```

Create `.env` file:
```env
VITE_API_URL=http://localhost:3001/api
VITE_WS_URL=ws://localhost:3001
```

## 🚀 Running the Application

### Start Backend Server
```bash
cd backend
npm start
```
Server will start on `http://localhost:3001`

### Start Frontend Development Server
```bash
cd frontend
npm run dev
```
Frontend will be available on `http://localhost:8081`

## 📖 Usage Guide

### 1. Initial Setup
1. Access the web interface at `http://localhost:8081`
2. Navigate to **Settings** to configure monitoring parameters
3. Set SNMP community strings and thresholds

### 2. Device Discovery
1. Go to **Network Scan** page
2. Enter IP range (e.g., `192.168.1.1-254`)
3. Configure scan options and start scan
4. Discovered devices will appear in the **Devices** section

### 3. Manual Device Addition
1. Navigate to **Devices** page
2. Click **Add Device**
3. Enter device details:
   - IP Address
   - Hostname (optional)
   - SNMP Community
   - Description and Location

### 4. Monitoring Dashboard
- **Real-time Metrics**: View current CPU, Memory, and Disk usage
- **Device Status**: Monitor online/offline status
- **Historical Charts**: Analyze trends over time
- **Alert Summary**: View active alerts and notifications

### 5. Alert Management
1. Go to **Alerts** page
2. View all system alerts
3. Acknowledge or resolve alerts
4. Filter by severity or status

## 🔧 Configuration

### SNMP Settings
- **Community Strings**: Configure in device settings or globally
- **Timeout Values**: Adjust for network conditions
- **Retry Attempts**: Set based on network reliability

### Monitoring Thresholds
- **CPU Usage**: Warning (75%), Critical (90%)
- **Memory Usage**: Warning (80%), Critical (95%)
- **Disk Usage**: Warning (85%), Critical (95%)

### Data Retention
- **Historical Data**: Configurable retention period
- **Alert History**: Automatic cleanup of old alerts
- **Database Maintenance**: Scheduled cleanup tasks

## 📊 API Documentation

### Device Endpoints
```
GET    /api/devices              # List all devices
POST   /api/devices              # Add new device
GET    /api/devices/:id          # Get device details
PUT    /api/devices/:id          # Update device
DELETE /api/devices/:id          # Remove device
POST   /api/devices/:id/test-snmp # Test SNMP connection
```

### Metrics Endpoints
```
GET    /api/metrics/overview     # System overview
GET    /api/metrics/devices      # All device metrics
GET    /api/metrics/device/:id   # Device-specific metrics
GET    /api/metrics/history      # Historical data
```

### Scan Endpoints
```
POST   /api/scan/start           # Start network scan
GET    /api/scan/status          # Get scan status
POST   /api/scan/stop            # Stop active scan
GET    /api/scan/history         # Scan history
```

### Alert Endpoints
```
GET    /api/alerts               # List alerts
POST   /api/alerts/:id/acknowledge # Acknowledge alert
POST   /api/alerts/:id/resolve   # Resolve alert
GET    /api/alerts/statistics    # Alert statistics
```

### System Endpoints
```
GET    /api/system/status        # System status
GET    /api/system/configuration # Get configuration
PUT    /api/system/configuration # Update configuration
GET    /api/system/health        # Health check
```

## 🔌 WebSocket Events

### Client → Server
```javascript
{ type: 'subscribe' }     // Subscribe to updates
{ type: 'unsubscribe' }   // Unsubscribe from updates
{ type: 'ping' }          // Heartbeat
```

### Server → Client
```javascript
{ type: 'monitoringUpdate', data: {...} }  // Metrics update
{ type: 'alertCreated', data: {...} }      // New alert
{ type: 'alertResolved', data: {...} }     // Alert resolved
{ type: 'scanStarted', data: {...} }       // Scan started
{ type: 'scanCompleted', data: {...} }     // Scan completed
{ type: 'hostDiscovered', data: {...} }    // New host found
```

## 🛡️ Security Considerations

### Network Security
- **SNMP Communities**: Use secure community strings
- **Network Isolation**: Deploy in secure network segments
- **Access Control**: Implement proper firewall rules

### Application Security
- **Input Validation**: All inputs are validated
- **Rate Limiting**: API endpoints are rate-limited
- **CORS Configuration**: Properly configured for production
- **Helmet.js**: Security headers implemented

### Data Security
- **Local Storage**: Data stored locally in SQLite
- **No External Dependencies**: No cloud services required
- **Audit Logging**: All actions are logged

## 🔧 Troubleshooting

### Common Issues

#### SNMP Connection Failures
```bash
# Check SNMP service on target device
snmpwalk -v2c -c public 192.168.1.100 1.3.6.1.2.1.1.1.0

# Verify community string
# Check firewall settings (UDP port 161)
```

#### Network Scan Issues
- Verify IP range format: `192.168.1.1-254`
- Check network connectivity
- Adjust timeout values for slow networks
- Ensure sufficient permissions for ping operations

#### Database Issues
```bash
# Check database file permissions
ls -la backend/data/monitoring.db

# Reset database (will lose data)
rm backend/data/monitoring.db
npm start  # Will recreate database
```

#### WebSocket Connection Issues
- Check firewall settings
- Verify WebSocket URL in frontend configuration
- Check browser console for connection errors

### Performance Optimization

#### Large Networks
- Increase scan timeout for large subnets
- Reduce concurrent scan limit
- Implement device grouping
- Use selective monitoring

#### Database Performance
- Regular database maintenance
- Adjust data retention periods
- Monitor database size
- Implement data archiving

## 🚀 Deployment

### Production Deployment

#### Backend
```bash
# Build for production
npm run build

# Use PM2 for process management
npm install -g pm2
pm2 start server.js --name "lan-insight-backend"
```

#### Frontend
```bash
# Build for production
npm run build

# Serve with nginx or Apache
# Copy dist/ folder to web server
```

#### Environment Variables
```env
NODE_ENV=production
PORT=3001
DB_PATH=/var/lib/lan-insight/monitoring.db
LOG_LEVEL=info
```

### Docker Deployment
```dockerfile
# Dockerfile example
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Development Guidelines
- Follow ESLint configuration
- Write meaningful commit messages
- Update documentation for new features
- Test thoroughly before submitting

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review the API documentation

## 🔮 Future Enhancements

### Planned Features
- **SNMPv3 Support**: Enhanced security
- **Custom Dashboards**: User-configurable layouts
- **Email Notifications**: Alert delivery via email
- **Mobile App**: Native mobile application
- **Multi-tenant Support**: Multiple organization support
- **Advanced Analytics**: Machine learning insights
- **Export/Import**: Configuration backup and restore
- **Plugin System**: Extensible monitoring modules

### Integration Possibilities
- **Grafana Integration**: Advanced visualization
- **Prometheus Metrics**: Metrics export
- **Slack/Teams Notifications**: Chat integrations
- **LDAP Authentication**: Enterprise authentication
- **REST API Webhooks**: External system integration

---

**LAN Insight** - Comprehensive Network Monitoring Made Simple