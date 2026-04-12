'use strict';

const { runFrontendSmoke } = require('./run-frontend-smoke');

const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5173';
const timeoutMs = Number.parseInt(process.env.SMOKE_TIMEOUT_MS || '15000', 10);

runFrontendSmoke({ baseUrl, timeoutMs, label: 'local' }).catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});