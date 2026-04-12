'use strict';
require('dotenv').config();

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
