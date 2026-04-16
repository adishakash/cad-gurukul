'use strict';
const express = require('express');
const router = express.Router();

const { authenticate, authorizeRoles } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimiter');
const adminController = require('../controllers/admin.controller');
const {
  adminLoginSchema,
  leadListQuerySchema,
  triggerActionSchema,
} = require('../validators/admin.validator');

// ─── Public routes (no auth) ──────────────────────────────────────────────────

/**
 * POST /api/v1/admin/login
 * Unified admin login. Validates email/password, enforces role = ADMIN,
 * returns a standard JWT that works with the `authenticate` middleware.
 */
router.post(
  '/login',
  authLimiter,
  validate(adminLoginSchema),
  adminController.loginAdmin
);

// ─── Protected routes (ADMIN role required) ───────────────────────────────────
// All routes below this point require a valid JWT with role = ADMIN.
// When CAREER_COUNSELLOR_LEAD / CAREER_COUNSELLOR are implemented in a future
// phase, add their routes ABOVE the middleware below or use per-route
// authorizeRoles() calls with the appropriate minimum role.

router.use(authenticate, authorizeRoles('ADMIN'));

// Profile
router.get('/profile', adminController.getAdminProfile);
router.post('/logout', adminController.logoutAdmin);

// Users
router.get('/users', adminController.listUsers);
router.put('/users/:id/toggle-status', adminController.toggleUserStatus);

// Dashboard analytics
router.get('/analytics', adminController.getAnalytics);

// Payments & Reports
router.get('/payments', adminController.listPayments);
router.get('/reports', adminController.listReports);

// AI usage
router.get('/ai-usage', adminController.getAIUsage);

// CSV exports
router.get('/export/leads', adminController.exportLeads);
router.get('/export/payments', adminController.exportPayments);

// Lead CRM
router.get('/leads', validate(leadListQuerySchema, 'query'), adminController.listLeads);
router.get('/funnel', adminController.getFunnelMetrics);
router.get('/leads/:id', adminController.getLeadDetail);
router.patch('/leads/:id', adminController.updateLeadAdmin);
router.post('/leads/:id/actions', validate(triggerActionSchema), adminController.triggerAdminAction);

module.exports = router;
