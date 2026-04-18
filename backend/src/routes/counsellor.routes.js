'use strict';
const express = require('express');
const router  = express.Router();

const { authenticate, authorizeRoles } = require('../middleware/auth');
const { validate }                     = require('../middleware/validate');
const { staffLoginSchema, staffLeadListQuerySchema } = require('../validators/staff.validator');
const { createTestLinkSchema, updateDiscountSchema } = require('../validators/cc.validator');
const staffController                  = require('../controllers/staff.controller');
const ccController                     = require('../controllers/cc.controller');
const { getBankAccount, saveBankAccount } = require('../controllers/bankAccount.controller');
const { bulkSendTestLinks }              = require('../controllers/bulkSend.controller');

// ─── Public route ─────────────────────────────────────────────────────────────

const { authLimiter } = require('../middleware/rateLimiter');
router.post('/login', authLimiter, validate(staffLoginSchema), staffController.loginStaff);

// ─── Protected routes (CAREER_COUNSELLOR minimum — CC, CCL, ADMIN all pass) ──

router.use(authenticate, authorizeRoles('CAREER_COUNSELLOR'));

// Auth
router.get('/profile', staffController.getStaffProfile);
router.post('/logout',  staffController.logoutStaff);

// Leads — filtered to counsellingInterested: true (counsellor-scoped)
router.get('/leads', validate(staffLeadListQuerySchema, 'query'), staffController.listCounsellorLeads);

// Students — scoped to students with at least one counselling-interested lead
router.get('/students', staffController.listCounsellorStudents);

// Reports — scoped to reports for students with counselling-interested leads
router.get('/reports', staffController.listCounsellorReports);

// ─── CC Business Layer routes (Phase 5) ──────────────────────────────────────

// Account / income summary
router.get('/account',              ccController.getAccountSummary);
router.get('/account/transactions', ccController.listTransactions);

// Test links
router.get('/test-links',           ccController.listTestLinks);
router.post('/test-links',          validate(createTestLinkSchema), ccController.createTestLink);

// Discount policy — read-only range for inline discount on link creation
router.get('/discount-policy',      ccController.getDiscountPolicy);

// Discount config
router.get('/discount',             ccController.getDiscount);
router.put('/discount',             validate(updateDiscountSchema), ccController.updateDiscount);

// Training content
router.get('/training',            ccController.listTraining);
router.get('/training/:id/file',   ccController.serveTrainingFile);

// Payouts
router.get('/payouts',              ccController.listPayouts);
router.get('/payouts/:id',          ccController.getPayoutDetail);

// Bank account
router.get('/bank-account', getBankAccount);
router.put('/bank-account', saveBankAccount);

// Bulk send
router.post('/test-links/bulk', bulkSendTestLinks);

module.exports = router;
