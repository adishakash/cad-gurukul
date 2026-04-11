'use strict';
const express = require('express');
const router = express.Router();

const { validate } = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimiter');
const { authenticate } = require('../middleware/auth');
const authController = require('../controllers/auth.controller');
const authValidator = require('../validators/auth.validator');

router.post('/register', authLimiter, validate(authValidator.register), authController.register);
router.post('/login', authLimiter, validate(authValidator.login), authController.login);
router.post('/refresh', validate(authValidator.refreshToken), authController.refresh);
router.post('/logout', authenticate, authController.logout);
router.post('/admin/login', authLimiter, validate(authValidator.login), authController.adminLogin);

module.exports = router;
