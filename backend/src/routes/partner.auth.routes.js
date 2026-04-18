'use strict';
const express = require('express');
const router  = express.Router();
const Joi     = require('joi');
const { validate } = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimiter');
const { registerPartner, loginPartner } = require('../controllers/partner.auth.controller');

const registerSchema = Joi.object({
  email:         Joi.string().email().lowercase().trim().required(),
  password:      Joi.string().min(8).max(72).required(),
  fullName:      Joi.string().min(2).max(100).trim().required(),
  phone:         Joi.string().pattern(/^[6-9]\d{9}$/).required(),
  role:          Joi.string().valid('CAREER_COUNSELLOR', 'CAREER_COUNSELLOR_LEAD').required(),
  city:          Joi.string().max(80).trim().optional(),
  qualification: Joi.string().max(200).trim().optional(),
  experience:    Joi.string().max(500).trim().optional(),
  referredBy:    Joi.string().trim().optional(),
});

const loginSchema = Joi.object({
  email:    Joi.string().email().lowercase().trim().required(),
  password: Joi.string().required(),
});

// Rate-limited — 10 attempts per 15 minutes
router.post('/register', authLimiter, validate(registerSchema), registerPartner);
router.post('/login',    authLimiter, validate(loginSchema),    loginPartner);

module.exports = router;
