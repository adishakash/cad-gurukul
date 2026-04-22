'use strict';
require('dotenv').config();

const { URL } = require('url');

const parseInteger = (value, fallbackValue) => {
  const parsedValue = parseInt(value, 10);
  return Number.isFinite(parsedValue) ? parsedValue : fallbackValue;
};

const setSearchParamIfMissing = (url, key, value) => {
  if (value === undefined || value === null || value === '') {
    return;
  }

  if (!url.searchParams.has(key)) {
    url.searchParams.set(key, String(value).trim());
  }
};

const normalizeDatabaseUrl = (rawValue) => {
  if (!rawValue || typeof rawValue !== 'string') {
    return rawValue;
  }

  const trimmedValue = rawValue.trim();
  if (!trimmedValue) {
    return trimmedValue;
  }

  try {
    const parsedUrl = new URL(trimmedValue);
    const protocol = parsedUrl.protocol.replace(':', '');

    if (protocol !== 'postgres' && protocol !== 'postgresql') {
      return trimmedValue;
    }

    setSearchParamIfMissing(parsedUrl, 'connection_limit', process.env.PRISMA_CONNECTION_LIMIT);
    setSearchParamIfMissing(parsedUrl, 'pool_timeout', process.env.PRISMA_POOL_TIMEOUT);
    setSearchParamIfMissing(parsedUrl, 'connect_timeout', process.env.PRISMA_CONNECT_TIMEOUT);
    setSearchParamIfMissing(parsedUrl, 'socket_timeout', process.env.PRISMA_SOCKET_TIMEOUT);

    if (!parsedUrl.searchParams.has('pgbouncer') && process.env.PRISMA_PGBOUNCER === 'true') {
      parsedUrl.searchParams.set('pgbouncer', 'true');
    }

    return parsedUrl.toString();
  } catch {
    return trimmedValue;
  }
};

const directDatabaseUrl = (process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL || '').trim();
const runtimeDatabaseUrl = normalizeDatabaseUrl(process.env.DATABASE_POOL_URL || directDatabaseUrl);

if (directDatabaseUrl && !process.env.DATABASE_DIRECT_URL) {
  process.env.DATABASE_DIRECT_URL = directDatabaseUrl;
}

if (runtimeDatabaseUrl) {
  process.env.DATABASE_URL = runtimeDatabaseUrl;
}

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  frontendUrls: (
    process.env.FRONTEND_URLS
      ? process.env.FRONTEND_URLS.split(',').map((url) => url.trim()).filter(Boolean)
      : [process.env.FRONTEND_URL || 'http://localhost:3000']
  ),
  allowDigitalOceanPreviewOrigins: process.env.ALLOW_DO_PREVIEW_ORIGINS !== 'false',

  db: {
    url: process.env.DATABASE_URL,
    directUrl: process.env.DATABASE_DIRECT_URL,
    poolUrl: process.env.DATABASE_POOL_URL,
    writeProbeEnabled: process.env.SKIP_DB_WRITE_PROBE !== 'true' && (process.env.NODE_ENV || 'development') !== 'test',
    writeProbeTimeoutMs: parseInteger(process.env.DB_WRITE_PROBE_TIMEOUT_MS, 8000),
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS, 10) || 4096,
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-1.5-pro',
  },

  ai: {
    defaultProvider: process.env.AI_DEFAULT_PROVIDER || 'auto',
  },

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  },

  email: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM || 'CAD Gurukul <noreply@cadgurukul.com>',
    replyTo: process.env.EMAIL_REPLY_TO || process.env.EMAIL_FROM || 'CAD Gurukul <noreply@cadgurukul.com>',
    verifyOnStartup: process.env.EMAIL_VERIFY_ON_STARTUP !== 'false',
    connectionTimeoutMs: parseInteger(process.env.SMTP_CONNECTION_TIMEOUT_MS, 20000),
    greetingTimeoutMs: parseInteger(process.env.SMTP_GREETING_TIMEOUT_MS, 20000),
    socketTimeoutMs: parseInteger(process.env.SMTP_SOCKET_TIMEOUT_MS, 30000),
  },

  consultationAutomation: {
    enabled: process.env.ENABLE_CONSULTATION_AUTOMATION !== 'false',
    intervalMs: parseInteger(process.env.CONSULTATION_AUTOMATION_INTERVAL_MS, 5 * 60 * 1000),
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
    aiMax: parseInt(process.env.AI_RATE_LIMIT_MAX, 10) || 20,
  },

  log: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/app.log',
  },
};

// Validate critical config at startup
const required = ['JWT_SECRET', 'DATABASE_URL'];
required.forEach((key) => {
  if (!process.env[key]) {
    console.error(`[Config] FATAL: Missing required environment variable: ${key}`);
    process.exit(1);
  }
});

module.exports = config;
