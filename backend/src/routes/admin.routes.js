'use strict';
const express = require('express');
const router = express.Router();

const { authenticateAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const adminController = require('../controllers/admin.controller');
const { leadListQuerySchema, triggerActionSchema } = require('../validators/admin.validator');

router.use(authenticateAdmin);

// Existing routes
router.get('/users', adminController.listUsers);
router.put('/users/:id/toggle-status', adminController.toggleUserStatus);
router.get('/analytics', adminController.getAnalytics);
router.get('/payments', adminController.listPayments);
router.get('/reports', adminController.listReports);
router.get('/ai-usage', adminController.getAIUsage);
router.get('/export/leads', adminController.exportLeads);
router.get('/export/payments', adminController.exportPayments);

// Lead management
router.get('/leads',              validate(leadListQuerySchema, 'query'), adminController.listLeads);
router.get('/funnel',             adminController.getFunnelMetrics);
router.get('/leads/:id',          adminController.getLeadDetail);
router.patch('/leads/:id',        adminController.updateLeadAdmin);
router.post('/leads/:id/actions', validate(triggerActionSchema), adminController.triggerAdminAction);

module.exports = router;
