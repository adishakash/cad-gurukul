'use strict';

/**
 * Standard API success response
 */
const successResponse = (res, data = null, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    data,
    message,
  });
};

/**
 * Standard API error response
 */
const errorResponse = (res, message = 'An error occurred', statusCode = 500, code = 'INTERNAL_ERROR', details = []) => {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details,
    },
  });
};

/**
 * Safely parse JSON, returning defaultValue on failure
 */
const safeJsonParse = (str, defaultValue = null) => {
  try {
    return JSON.parse(str);
  } catch {
    return defaultValue;
  }
};

/**
 * Mask sensitive fields for logging
 */
const maskSensitive = (obj, fields = ['password', 'passwordHash', 'token', 'secret']) => {
  const masked = { ...obj };
  fields.forEach((field) => {
    if (masked[field]) masked[field] = '***';
  });
  return masked;
};

/**
 * Sleep utility (for retry logic)
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retry a function with exponential backoff
 */
const withRetry = async (fn, retries = 3, baseDelay = 1000) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries) throw err;
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }
};

/**
 * Convert rupees to paise
 */
const rupeesToPaise = (rupees) => Math.round(rupees * 100);

/**
 * Convert paise to rupees
 */
const paiseToRupees = (paise) => (paise / 100).toFixed(2);

/**
 * Sanitize string input (remove null bytes and trim)
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return str.replace(/\0/g, '').trim();
};

module.exports = {
  successResponse,
  errorResponse,
  safeJsonParse,
  maskSensitive,
  sleep,
  withRetry,
  rupeesToPaise,
  paiseToRupees,
  sanitizeString,
};
