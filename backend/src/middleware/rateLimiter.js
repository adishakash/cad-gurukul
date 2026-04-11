'use strict';
const rateLimit = require('express-rate-limit');
const config = require('../config');

/**
 * General API rate limiter
 */
const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests, please try again later.',
    },
  },
});

/**
 * Strict limiter for auth endpoints
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many login attempts. Please wait before trying again.',
    },
  },
});

/**
 * AI endpoint limiter – protect expensive AI calls
 */
const aiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.aiMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'AI request limit reached. Please wait before requesting more questions.',
    },
  },
});

module.exports = { generalLimiter, authLimiter, aiLimiter };
