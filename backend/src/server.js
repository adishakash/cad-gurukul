'use strict';
require('dotenv').config();
const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const prisma = require('./config/database');

const server = app.listen(config.port, async () => {
  try {
    await prisma.$connect();
    logger.info(`[Server] CAD Gurukul API started`, {
      port: config.port,
      env: config.env,
      url: `http://localhost:${config.port}/api/v1/health`,
    });
  } catch (err) {
    logger.error('[Server] Database connection failed at startup', { error: err.message });
    process.exit(1);
  }
});

// Graceful shutdown
const shutdown = async (signal) => {
  logger.info(`[Server] ${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    await prisma.$disconnect();
    logger.info('[Server] Server closed. DB disconnected.');
    process.exit(0);
  });
  // Force kill if graceful shutdown takes too long
  setTimeout(() => {
    logger.error('[Server] Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('[Server] Unhandled Promise Rejection', { reason });
});

process.on('uncaughtException', (err) => {
  logger.error('[Server] Uncaught Exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

module.exports = server;
