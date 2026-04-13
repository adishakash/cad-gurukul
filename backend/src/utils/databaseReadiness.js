'use strict';

const prisma = require('../config/database');
const logger = require('./logger');

const writeProbeState = {
  status: 'pending',
  checkedAt: null,
};

const setWriteProbeState = (status) => {
  writeProbeState.status = status;
  writeProbeState.checkedAt = new Date().toISOString();
};

const getDatabaseReadinessSnapshot = () => ({
  write: writeProbeState.status,
  writeCheckedAt: writeProbeState.checkedAt,
});

const withTimeout = (promise, timeoutMs) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Database write probe timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);

const runDatabaseWriteProbe = async ({ timeoutMs = 8000 } = {}) => {
  try {
    await withTimeout(
      prisma.$transaction(async (tx) => {
        const probeRecord = await tx.contactQuery.create({
          data: {
            name: 'Deployment Readiness Probe',
            email: `healthcheck.${Date.now()}.${Math.random().toString(16).slice(2)}@cadgurukul.invalid`,
            subject: 'healthcheck',
            message: 'Automated deployment readiness probe.',
          },
        });

        await tx.contactQuery.delete({ where: { id: probeRecord.id } });
      }),
      timeoutMs
    );

    setWriteProbeState('ok');
    return getDatabaseReadinessSnapshot();
  } catch (error) {
    setWriteProbeState('failed');
    logger.error('[Database] Write probe failed', { error: error.message });
    throw error;
  }
};

const markDatabaseWriteProbeSkipped = () => {
  setWriteProbeState('skipped');
};

module.exports = {
  getDatabaseReadinessSnapshot,
  markDatabaseWriteProbeSkipped,
  runDatabaseWriteProbe,
};