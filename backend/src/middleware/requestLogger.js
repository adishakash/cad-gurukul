'use strict';
const logger = require('../utils/logger');

/**
 * HTTP request logger middleware using winston.
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('[HTTP]', {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
  });

  next();
};

module.exports = { requestLogger };
