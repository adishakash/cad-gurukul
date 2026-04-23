'use strict';
require('dotenv').config();
const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const { markDatabaseWriteProbeSkipped, runDatabaseWriteProbe } = require('./utils/databaseReadiness');
const prisma = require('./config/database');
const { isEmailConfigured, verifyEmailTransport } = require('./services/email/emailService');

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

  if (config.db.writeProbeEnabled) {
    await runDatabaseWriteProbe({ timeoutMs: config.db.writeProbeTimeoutMs });
    logger.info('[Server] Database write probe passed', { timeoutMs: config.db.writeProbeTimeoutMs });
  } else {
    markDatabaseWriteProbeSkipped();
    logger.info('[Server] Database write probe skipped');
  }

  if (isEmailConfigured() && config.email.verifyOnStartup) {
    try {
      await verifyEmailTransport({ force: true });
    } catch (emailErr) {
      logger.error('[Server] Email transport verification failed', { error: emailErr.message });
    }
  } else if (!isEmailConfigured()) {
    logger.warn('[Server] Email transport not configured. Application emails will fail until SMTP env vars are set.');
  }

  server = app.listen(config.port, () => {
    logger.info(`[Server] CAD Gurukul API started`, {
      port: config.port,
      env: config.env,
      url: `http://localhost:${config.port}/api/v1/health`,
    });

    // Start payout scheduler (Thursday 10AM IST cron)
    if (process.env.ENABLE_PAYOUT_SCHEDULER === 'true') {
      try {
        const { start: startPayoutScheduler } = require('./services/payout/payoutScheduler');
        startPayoutScheduler();
        logger.info('[Server] Payout scheduler started');
      } catch (schedErr) {
        logger.warn('[Server] Payout scheduler failed to start', { error: schedErr.message });
      }
    }

    if (config.consultationAutomation.enabled) {
      try {
        const { startConsultationAutomation } = require('./services/consultation/consultationAutomationService');
        startConsultationAutomation(config.consultationAutomation.intervalMs);
        logger.info('[Server] Consultation automation started', {
          intervalMs: config.consultationAutomation.intervalMs,
        });
      } catch (schedErr) {
        logger.warn('[Server] Consultation automation failed to start', { error: schedErr.message });
      }
    }
  });
};

start().catch((err) => {
  logger.error('[Server] Startup failed', { error: err.message });
  process.exit(1);
});

// Graceful shutdown
const shutdown = async (signal) => {
  logger.info(`[Server] ${signal} received. Shutting down gracefully...`);
  if (!server) {
    await prisma.$disconnect();
    process.exit(0);
    return;
  }
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
