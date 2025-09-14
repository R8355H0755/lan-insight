import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { NetworkScanner } from './src/services/NetworkScanner.js';
import { SNMPCollector } from './src/services/SNMPCollector.js';
import { DatabaseManager } from './src/services/DatabaseManager.js';
import { MonitoringService } from './src/services/MonitoringService.js';
import { AlertManager } from './src/services/AlertManager.js';
import { Logger } from './src/utils/Logger.js';

import deviceRoutes from './src/routes/devices.js';
import metricsRoutes from './src/routes/metrics.js';
import alertRoutes from './src/routes/alerts.js';
import scanRoutes from './src/routes/scan.js';
import systemRoutes from './src/routes/system.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3001;

// Initialize services
const logger = new Logger();
const dbManager = new DatabaseManager();
const networkScanner = new NetworkScanner();
const snmpCollector = new SNMPCollector();
const alertManager = new AlertManager();
const monitoringService = new MonitoringService({
  dbManager,
  networkScanner,
  snmpCollector,
  alertManager,
  logger
});

// Make services available to routes
app.locals.logger = logger;
app.locals.dbManager = dbManager;
app.locals.networkScanner = networkScanner;
app.locals.snmpCollector = snmpCollector;
app.locals.alertManager = alertManager;
app.locals.monitoringService = monitoringService;

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
});

app.use(limiter);

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['http://localhost:5173', 'http://localhost:4173'] 
    : true,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/devices', deviceRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/scan', scanRoutes);
app.use('/api/system', systemRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  logger.info(`WebSocket client connected from ${req.socket.remoteAddress}`);
  
  // Send initial data
  ws.send(JSON.stringify({
    type: 'connection',
    message: 'Connected to LAN Insight monitoring server',
    timestamp: new Date().toISOString()
  }));

  // Handle client messages
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      switch (data.type) {
        case 'subscribe':
          // Subscribe to real-time updates
          monitoringService.addWebSocketClient(ws);
          break;
          
        case 'unsubscribe':
          monitoringService.removeWebSocketClient(ws);
          break;
          
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
          break;
          
        default:
          logger.warn(`Unknown WebSocket message type: ${data.type}`);
      }
    } catch (error) {
      logger.error('Error processing WebSocket message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format',
        timestamp: new Date().toISOString()
      }));
    }
  });

  ws.on('close', () => {
    logger.info('WebSocket client disconnected');
    monitoringService.removeWebSocketClient(ws);
  });

  ws.on('error', (error) => {
    logger.error('WebSocket error:', error);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.originalUrl} not found`
  });
});

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database
    await dbManager.initialize();
    logger.info('Database initialized successfully');

    // Initialize alert manager
    alertManager.initialize(dbManager, logger);
    logger.info('Alert manager initialized');

    // Initialize monitoring service
    await monitoringService.initialize();
    logger.info('Monitoring service initialized');

    // Start server
    server.listen(PORT, () => {
      logger.info(`LAN Insight backend server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`WebSocket server ready for connections`);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  // Stop monitoring service
  await monitoringService.stop();
  
  // Close database connections
  await dbManager.close();
  
  // Close server
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  await monitoringService.stop();
  await dbManager.close();
  
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startServer();