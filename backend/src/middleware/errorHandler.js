'use strict';
const logger = require('../utils/logger');

/**
 * Global error handler middleware.
 * Must be registered LAST in Express middleware chain.
 */
const errorHandler = (err, req, res, _next) => {
  // Prisma known errors
  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      error: {
        code: 'CONFLICT',
        message: 'A record with this value already exists.',
        details: err.meta?.target || [],
      },
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Record not found.' },
    });
  }

  // Joi validation errors
  if (err.isJoi) {
    return res.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: err.details.map((d) => ({ field: d.context?.key, message: d.message })),
      },
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Authentication token is invalid or expired.' },
    });
  }

  // Log unexpected errors
  logger.error('[ErrorHandler] Unhandled error', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
  });

  const statusCode = err.statusCode || err.status || 500;
  return res.status(statusCode).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    },
  });
};

/**
 * 404 handler – must be registered before errorHandler
 */
const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`,
    },
  });
};

module.exports = { errorHandler, notFound };
