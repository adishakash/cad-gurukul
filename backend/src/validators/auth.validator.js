'use strict';
const Joi = require('joi');

const register = Joi.object({
  email: Joi.string().email().lowercase().trim().required(),
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      'string.pattern.base': 'Password must contain uppercase, lowercase, and a number',
      'string.min': 'Password must be at least 8 characters',
    }),
  fullName: Joi.string().min(2).max(100).trim().required(),
  role: Joi.string().valid('STUDENT', 'PARENT').default('STUDENT'),
});

const login = Joi.object({
  email: Joi.string().email().lowercase().trim().required(),
  password: Joi.string().required(),
});

const refreshToken = Joi.object({
  refreshToken: Joi.string().required(),
});

const forgotPassword = Joi.object({
  email: Joi.string().email().lowercase().trim().required(),
});

const resetPassword = Joi.object({
  token: Joi.string().required(),
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required(),
});

module.exports = { register, login, refreshToken, forgotPassword, resetPassword };
