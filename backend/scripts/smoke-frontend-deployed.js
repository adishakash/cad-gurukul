'use strict';

const { runFrontendSmoke } = require('./run-frontend-smoke');

const baseUrl = process.env.SMOKE_DEPLOYED_BASE_URL || process.env.SMOKE_BASE_URL || 'https://cadgurukul.com';
const timeoutMs = Number.parseInt(process.env.SMOKE_TIMEOUT_MS || '30000', 10);

runFrontendSmoke({ baseUrl, timeoutMs, label: 'deployed' }).catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});