'use strict';
const express = require('express');
const router  = express.Router();

const { authenticate, requirePortalRole } = require('../middleware/auth');
const { validate }                     = require('../middleware/validate');
const { staffLoginSchema, staffLeadListQuerySchema } = require('../validators/staff.validator');
const { createTestLinkSchema, updateDiscountSchema, couponCreateSchema, couponUpdateSchema } = require('../validators/cc.validator');
const staffController                  = require('../controllers/staff.controller');
const ccController                     = require('../controllers/cc.controller');
const { getBankAccount, saveBankAccount } = require('../controllers/bankAccount.controller');
const { bulkSendTestLinks }              = require('../controllers/bulkSend.controller');

// ─── Public route ─────────────────────────────────────────────────────────────

const { authLimiter } = require('../middleware/rateLimiter');
router.post('/login', authLimiter, validate(staffLoginSchema), staffController.loginStaff);

// ─── Protected routes (CC and CCL — strict portal membership, no ADMIN) ─────
//
// requirePortalRole uses exact role-set membership, NOT numeric hierarchy.
// This prevents ADMIN from leaking into the counsellor portal.
// CCL is included because CCLs can also perform CC-level work.

router.use(authenticate, requirePortalRole('CAREER_COUNSELLOR', 'CAREER_COUNSELLOR_LEAD'));

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

// Referral link + stats
router.get('/referral-link',        ccController.getReferralLink);
router.get('/referral-stats',       ccController.getReferralStats);

// Coupons
router.get('/coupons',              ccController.listCoupons);
router.post('/coupons',             validate(couponCreateSchema), ccController.createCoupon);
router.patch('/coupons/:id',        validate(couponUpdateSchema), ccController.updateCoupon);
router.delete('/coupons/:id',       ccController.deleteCoupon);

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

// Consultation sessions (authorized CC only)
router.get('/consultations/upcoming', ccController.listUpcomingConsultations);

// Bank account
router.get('/bank-account', getBankAccount);
router.put('/bank-account', saveBankAccount);

// Bulk send
router.post('/test-links/bulk', bulkSendTestLinks);

// Assigned Prospects — leads assigned to this CC by admin
// Uses the same handler as /staff/assigned-prospects (role-neutral, filters by req.user.id)
router.get('/assigned-prospects', staffController.getAssignedProspects);

module.exports = router;
