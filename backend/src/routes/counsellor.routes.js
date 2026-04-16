'use strict';
const express = require('express');
const router  = express.Router();

const { authenticate, authorizeRoles } = require('../middleware/auth');
const { validate }                     = require('../middleware/validate');
const { staffLoginSchema, staffLeadListQuerySchema } = require('../validators/staff.validator');
const staffController                  = require('../controllers/staff.controller');

// ─── Public route ─────────────────────────────────────────────────────────────

/**
 * POST /api/v1/counsellor/login
 *
 * Alias of the unified staff login — allows a counsellor-branded login URL.
 * The underlying controller (`loginStaff`) validates role against ALLOWED_STAFF_ROLES,
 * which includes CAREER_COUNSELLOR as of Phase 3.
 *
 * Both /staff/login and /counsellor/login go to the same controller so there
 * is no duplicated auth logic. The frontend uses whichever URL it prefers;
 * the currently shared StaffLogin page uses /staff/login.
 */
const { authLimiter } = require('../middleware/rateLimiter');
router.post('/login', authLimiter, validate(staffLoginSchema), staffController.loginStaff);

// ─── Protected routes (CAREER_COUNSELLOR minimum — CC, CCL, ADMIN all pass) ──
//
// authorizeRoles('CAREER_COUNSELLOR') means:
//   CAREER_COUNSELLOR (level 2)      ✅
//   CAREER_COUNSELLOR_LEAD (level 3) ✅  (higher roles always pass lower-level checks)
//   ADMIN (level 4)                  ✅
//   STUDENT / PARENT (level 1)       ❌

router.use(authenticate, authorizeRoles('CAREER_COUNSELLOR'));

// Auth
router.get('/profile', staffController.getStaffProfile);
router.post('/logout',  staffController.logoutStaff);

// Leads — filtered to counsellingInterested: true (counsellor-scoped)
// Phase 4: will also filter by assignedCounsellorId once that schema field exists.
router.get('/leads', validate(staffLeadListQuerySchema, 'query'), staffController.listCounsellorLeads);

// Students — scoped to students with at least one counselling-interested lead
// (narrower than /staff/students which returns all students)
router.get('/students', staffController.listCounsellorStudents);

// Reports — scoped to reports for students with counselling-interested leads
// (narrower than /staff/reports which returns all reports)
router.get('/reports', staffController.listCounsellorReports);

module.exports = router;
