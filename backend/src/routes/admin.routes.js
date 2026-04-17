'use strict';
const express = require('express');
const router = express.Router();

const { authenticate, authorizeRoles } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimiter');
const { upload, enforceSizeLimit } = require('../middleware/upload');
const adminController = require('../controllers/admin.controller');
const cclAdminController = require('../controllers/ccl.admin.controller');
const {
  adminLoginSchema,
  leadListQuerySchema,
  triggerActionSchema,
} = require('../validators/admin.validator');

// ─── Public routes (no auth) ──────────────────────────────────────────────────

router.post(
  '/login',
  authLimiter,
  validate(adminLoginSchema),
  adminController.loginAdmin
);

// ─── Protected routes (ADMIN role required) ───────────────────────────────────

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

// ─── Discount Policies (Phase 6) ─────────────────────────────────────────────
router.get('/discount-policies', cclAdminController.listPolicies);
router.put('/discount-policies', cclAdminController.upsertPolicy);

// ─── CCL Business Layer Oversight ────────────────────────────────────────────
// Admin can inspect and manage the entire CCL financial layer.

// Joining links
router.get('/ccl/joining-links', cclAdminController.listAllJoiningLinks);

// Attributed sales
router.get('/ccl/sales', cclAdminController.listAllSales);

// Commissions
router.get('/ccl/commissions', cclAdminController.listAllCommissions);

// Payouts: view, generate batch, update status
router.get('/ccl/payouts',              cclAdminController.listAllPayouts);
router.post('/ccl/payouts/generate',    cclAdminController.generatePayoutBatch);
router.get('/ccl/payouts/:id',          cclAdminController.getPayoutDetail);
router.patch('/ccl/payouts/:id',        cclAdminController.updatePayoutStatus);

// Training content CRUD (with optional file upload)
router.get('/ccl/training',          cclAdminController.listAllTraining);
router.post('/ccl/training',         upload.single('file'), enforceSizeLimit, cclAdminController.createTrainingContent);
router.patch('/ccl/training/:id',    cclAdminController.updateTrainingContent);
router.delete('/ccl/training/:id',   cclAdminController.deleteTrainingContent);

// ─── CC Business Layer Oversight (Phase 5) ────────────────────────────────────
// Admin can inspect and manage the entire CC financial layer.

const ccAdminController = require('../controllers/cc.admin.controller');

// Test links
router.get('/cc/test-links',          ccAdminController.listAllTestLinks);

// Attributed sales
router.get('/cc/sales',               ccAdminController.listAllSales);

// Commissions
router.get('/cc/commissions',         ccAdminController.listAllCommissions);

// Payouts: view, generate batch, update status
router.get('/cc/payouts',             ccAdminController.listAllPayouts);
router.post('/cc/payouts/generate',   ccAdminController.generatePayoutBatch);
router.get('/cc/payouts/:id',         ccAdminController.getPayoutDetail);
router.patch('/cc/payouts/:id',       ccAdminController.updatePayoutStatus);

// Training content CRUD (shared CclTrainingContent table with targetRole, with file upload)
router.get('/cc/training',            ccAdminController.listAllTraining);
router.post('/cc/training',           upload.single('file'), enforceSizeLimit, ccAdminController.createTrainingContent);
router.patch('/cc/training/:id',      ccAdminController.updateTrainingContent);
router.delete('/cc/training/:id',     ccAdminController.deleteTrainingContent);

module.exports = router;
