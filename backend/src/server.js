'use strict';
require('dotenv').config();
const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const prisma = require('./config/database');

const connectWithTimeout = (ms) =>
  Promise.race([
    prisma.$connect(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`DB connect timed out after ${ms}ms`)), ms)
    ),
  ]);

let server;

const start = async () => {
  await connectWithTimeout(10000);
  logger.info('[Server] Database connected');

  server = app.listen(config.port, () => {
    logger.info(`[Server] CAD Gurukul API started`, {
      port: config.port,
      env: config.env,
      url: `http://localhost:${config.port}/api/v1/health`,
    });
  });
};

start().catch((err) => {
  logger.error('[Server] Startup failed', { error: err.message });
  process.exit(1);
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
