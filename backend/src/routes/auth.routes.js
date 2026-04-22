'use strict';
const express = require('express');
const router = express.Router();

const { validate } = require('../middleware/validate');
const { authLimiter, resendLimiter } = require('../middleware/rateLimiter');
const { authenticate } = require('../middleware/auth');
const authController = require('../controllers/auth.controller');
const authValidator = require('../validators/auth.validator');

router.post('/register', authLimiter, validate(authValidator.register), authController.register);
router.post('/verify-email', authLimiter, validate(authValidator.verifyEmail), authController.verifyEmail);
router.post('/resend-verification', resendLimiter, validate(authValidator.resendVerification), authController.resendVerification);
router.post('/login', authLimiter, validate(authValidator.login), authController.login);
router.post('/refresh', validate(authValidator.refreshToken), authController.refresh);
router.post('/logout', authenticate, authController.logout);
router.delete('/account', authLimiter, authenticate, authController.deleteAccount);

// ⚠️  LEGACY ENDPOINT — authenticates against the old `AdminUser` table and
//    issues a JWT with { adminId, type:'admin' } which is NOT compatible with
//    the new `authenticate` middleware.  Do NOT use for new features.
//    Use POST /api/v1/admin/login instead.
router.post('/admin/login', authLimiter, validate(authValidator.login), authController.adminLogin);

module.exports = router;
