'use strict';
const express = require('express');
const router  = express.Router();

const { authenticate, authorizeRoles } = require('../middleware/auth');
const { validate }                     = require('../middleware/validate');
const { authLimiter }                  = require('../middleware/rateLimiter');
const staffController                  = require('../controllers/staff.controller');
const cclController                    = require('../controllers/ccl.controller');
const { staffLoginSchema, staffLeadListQuerySchema } = require('../validators/staff.validator');
const { createJoiningLinkSchema, updateDiscountSchema } = require('../validators/ccl.validator');
const { getBankAccount, saveBankAccount } = require('../controllers/bankAccount.controller');
const { bulkSendJoiningLinks }           = require('../controllers/bulkSend.controller');

// ─── Public route ─────────────────────────────────────────────────────────────

/**
 * POST /api/v1/staff/login
 *
 * Unified internal staff login for CAREER_COUNSELLOR_LEAD (Phase 2)
 * and CAREER_COUNSELLOR (Phase 3 — no route changes needed, just expand
 * ALLOWED_STAFF_ROLES in staff.controller.js).
 *
 * Intentionally separate from /admin/login:
 *  - Admin portal uses a different localStorage key and redirects.
 *  - Staff portal redirects to /staff on success.
 *  - Keeps ADMIN-only / staff separation clean on the frontend.
 */
router.post('/login', authLimiter, validate(staffLoginSchema), staffController.loginStaff);

// ─── Protected routes (CAREER_COUNSELLOR_LEAD minimum required) ───────────────
//
// authorizeRoles('CAREER_COUNSELLOR_LEAD') means:
//   CAREER_COUNSELLOR_LEAD (level 3) ✅
//   ADMIN (level 4)                  ✅  (higher roles always pass lower-level checks)
//   CAREER_COUNSELLOR (level 2)      ❌  (Phase 3: move guard to authorizeRoles('CAREER_COUNSELLOR'))
//   STUDENT / PARENT (level 1)       ❌

router.use(authenticate, authorizeRoles('CAREER_COUNSELLOR_LEAD'));

// Auth
router.get('/profile', staffController.getStaffProfile);
router.post('/logout',  staffController.logoutStaff);

// Leads — read-only
router.get('/leads',     validate(staffLeadListQuerySchema, 'query'), staffController.listLeads);
router.get('/leads/:id', staffController.getLeadDetail);

// Students — read-only
router.get('/students', staffController.listStudents);

// Reports — read-only
router.get('/reports', staffController.listReports);

// ─── CCL Business Layer ────────────────────────────────────────────────────────
// All routes below require CAREER_COUNSELLOR_LEAD (already enforced by the
// router.use() middleware above). ADMIN (level 4) also passes through.

// Account & income summary
router.get('/account',              cclController.getAccountSummary);
router.get('/account/transactions', cclController.listTransactions);

// Joining links — CCL creates and shares these to recruit counsellor candidates
router.get('/joining-links',  cclController.listJoiningLinks);
router.post('/joining-links', validate(createJoiningLinkSchema), cclController.createJoiningLink);

// Discount policy — read-only range for inline discount on link creation
router.get('/discount-policy', cclController.getDiscountPolicy);

// Discount configuration — optional, capped at 20%
router.get('/discount', cclController.getDiscount);
router.put('/discount', validate(updateDiscountSchema), cclController.updateDiscount);

// Training content — read-only for CCL, managed by Admin
router.get('/training',            cclController.listTraining);
router.get('/training/:id/file',   cclController.serveTrainingFile);

// Payouts — CCL can view their own payout batches
router.get('/payouts',     cclController.listPayouts);
router.get('/payouts/:id', cclController.getPayoutDetail);

// Bank account
router.get('/bank-account', getBankAccount);
router.put('/bank-account', saveBankAccount);

// Bulk send
router.post('/joining-links/bulk', bulkSendJoiningLinks);

module.exports = router;
