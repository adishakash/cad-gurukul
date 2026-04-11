'use strict';
const { errorResponse } = require('../utils/helpers');

/**
 * Middleware factory that validates req.body against a Joi schema.
 */
const validate = (schema, target = 'body') => (req, res, next) => {
  const data = target === 'body' ? req.body : target === 'query' ? req.query : req.params;
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });

  if (error) {
    const details = error.details.map((d) => ({
      field: d.context?.key,
      message: d.message.replace(/['"]/g, ''),
    }));
    return errorResponse(res, 'Validation failed', 422, 'VALIDATION_ERROR', details);
  }

  // Replace request data with validated & sanitized value
  if (target === 'body') req.body = value;
  else if (target === 'query') req.query = value;
  else req.params = value;

  next();
};

module.exports = { validate };
