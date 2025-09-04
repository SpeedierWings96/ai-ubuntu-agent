import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { config } from './config';
import { logger } from './utils/logger';
import { setupRoutes } from './api/routes';
import { setupWebSocket } from './api/websocket';
import { setupMetrics } from './utils/metrics';
import { ToolRegistry } from './tools/registry';
import { Planner } from './planner/react';
import { LLMClient } from './llm/client';

// Initialize services
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Global error handlers
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

async function initializeServer() {
  try {
    logger.info('Starting AI Ubuntu Agent Server...');

    // Middleware
    app.use(helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          connectSrc: ["'self'", 'ws:', 'wss:'],
        },
      },
    }));
    app.use(compression());
    app.use(cors());
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));
    
    // Logging
    if (config.logLevel === 'debug') {
      app.use(morgan('dev'));
    } else {
      app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));
    }

    // Initialize core services
    const llmClient = new LLMClient(config);
    const toolRegistry = new ToolRegistry();
    const planner = new Planner(llmClient, toolRegistry);

    // Register all tools
    await toolRegistry.initialize();
    logger.info(`Registered ${toolRegistry.getToolCount()} tools`);

    // Setup routes
    setupRoutes(app, { llmClient, toolRegistry, planner });

    // Setup WebSocket
    setupWebSocket(io, { llmClient, toolRegistry, planner });

    // Setup metrics
    if (config.enableMetrics) {
      setupMetrics(app);
      logger.info(`Metrics endpoint enabled at :${config.metricsPort}/metrics`);
    }

    // Health check endpoint
    app.get('/health', (req, res) => {
      const health = {
        status: 'healthy',
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        services: {
          desktop: toolRegistry.isDesktopConnected() ? 'healthy' : 'unhealthy',
          llm: llmClient.isHealthy() ? 'healthy' : 'unhealthy',
        },
        metrics: {
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage(),
        }
      };
      res.json(health);
    });

    // Error handling middleware
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Express error:', err);
      res.status(err.status || 500).json({
        error: {
          message: err.message || 'Internal Server Error',
          ...(config.nodeEnv === 'development' && { stack: err.stack })
        }
      });
    });

    // Start server
    const port = config.agentPort;
    httpServer.listen(port, () => {
      logger.info(`🚀 Agent server running at http://localhost:${port}`);
      logger.info(`📊 Environment: ${config.nodeEnv}`);
      logger.info(`🤖 Using model: ${config.openRouterModel}`);
      logger.info(`🖥️  Desktop host: ${config.desktopHost}:${config.desktopVncPort}`);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received, starting graceful shutdown...`);
      
      httpServer.close(() => {
        logger.info('HTTP server closed');
      });

      io.close(() => {
        logger.info('WebSocket server closed');
      });

      await toolRegistry.cleanup();
      await llmClient.cleanup();

      process.exit(0);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to initialize server:', error);
    process.exit(1);
  }
}

// Start the server
initializeServer();
