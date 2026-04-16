'use strict';
const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const { successResponse, errorResponse } = require('../utils/helpers');
const { signAccessToken, signRefreshToken, saveRefreshToken } = require('../utils/token');
const logger = require('../utils/logger');

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Roles allowed to use the staff login endpoint.
 * Phase 2: CAREER_COUNSELLOR_LEAD only.
 * Phase 3: add 'CAREER_COUNSELLOR' to this set — no other auth changes needed.
 */
const ALLOWED_STAFF_ROLES = new Set(['CAREER_COUNSELLOR_LEAD']);

// Structurally valid bcrypt hash — used as timing-safe dummy target.
const DUMMY_HASH = '$2a$12$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/staff/login  (public — no auth required)
 *
 * Unified internal staff login for CAREER_COUNSELLOR_LEAD (Phase 2) and
 * CAREER_COUNSELLOR (Phase 3 — just add to ALLOWED_STAFF_ROLES above).
 *
 * Security:
 *  - bcrypt.compare() always runs (prevents timing-based user enumeration)
 *  - All failure cases return the same 401 INVALID_CREDENTIALS
 *  - Role check prevents STUDENTs/PARENTs from logging in via this endpoint
 *  - Role check prevents ADMINs from using this endpoint (they have /admin/login)
 */
const loginStaff = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true, email: true, passwordHash: true,
        role: true, name: true, isActive: true,
      },
    });

    // Always run bcrypt — prevent timing-based enumeration.
    const hashToCompare = (user && user.isActive) ? user.passwordHash : DUMMY_HASH;
    const isPasswordValid = await bcrypt.compare(password, hashToCompare);

    // Generic 401 for: not found | inactive | wrong password | wrong role.
    if (!user || !user.isActive || !isPasswordValid || !ALLOWED_STAFF_ROLES.has(user.role)) {
      return errorResponse(res, 'Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    const accessToken  = signAccessToken(user.id, user.role);
    const refreshToken = signRefreshToken();
    await saveRefreshToken(user.id, refreshToken);

    logger.info('[Staff] Staff logged in', { userId: user.id, email: user.email, role: user.role });

    return successResponse(res, {
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      accessToken,
      refreshToken,
    }, 'Login successful');
  } catch (err) {
    logger.error('[Staff] loginStaff error', { error: err.message });
    throw err;
  }
};

/**
 * POST /api/v1/staff/logout  (CCL+ required)
 * Revokes the staff refresh token.
 */
const logoutStaff = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    }
    logger.info('[Staff] Staff logged out', { userId: req.user.id });
    return successResponse(res, null, 'Logged out successfully');
  } catch (err) {
    logger.error('[Staff] logoutStaff error', { error: err.message });
    throw err;
  }
};

/**
 * GET /api/v1/staff/profile  (CCL+ required)
 */
const getStaffProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, email: true, name: true, role: true,
        isActive: true, createdAt: true, updatedAt: true,
      },
    });

    if (!user) return errorResponse(res, 'Staff member not found', 404, 'NOT_FOUND');

    return successResponse(res, { user });
  } catch (err) {
    logger.error('[Staff] getStaffProfile error', { error: err.message });
    throw err;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// LEADS (read-only view — no mutations, no admin actions)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/staff/leads  (CCL+ required)
 * Paginated, filterable lead list — read-only.
 * Same filter surface as admin but no destructive operations exposed.
 */
const listLeads = async (req, res) => {
  try {
    const {
      page = 1, limit = 25,
      status, leadSource, classStandard, selectedPlan,
      dateFrom, dateTo,
      search, sortBy = 'createdAt', sortDir = 'desc',
    } = req.query;

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const where = {};

    if (status)        where.status        = status;
    if (leadSource)    where.leadSource    = leadSource;
    if (classStandard) where.classStandard = classStandard;
    if (selectedPlan)  where.selectedPlan  = selectedPlan;

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo)   where.createdAt.lte = new Date(dateTo);
    }

    if (search) {
      where.OR = [
        { fullName:     { contains: search, mode: 'insensitive' } },
        { email:        { contains: search, mode: 'insensitive' } },
        { mobileNumber: { contains: search } },
        { city:         { contains: search, mode: 'insensitive' } },
      ];
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { [sortBy]: sortDir },
        select: {
          id: true, fullName: true, email: true, mobileNumber: true,
          classStandard: true, stream: true, city: true, userType: true,
          selectedPlan: true, status: true, leadSource: true,
          counsellingInterested: true, assessmentId: true,
          reportId: true, createdAt: true, updatedAt: true,
        },
      }),
      prisma.lead.count({ where }),
    ]);

    return successResponse(res, { leads, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    logger.error('[Staff] listLeads error', { error: err.message });
    throw err;
  }
};

/**
 * GET /api/v1/staff/leads/:id  (CCL+ required)
 * Lead detail with event timeline and linked student profile.
 *
 * Explicit field selection on the lead itself deliberately excludes:
 *  - paymentId      — financial reference (admin-only)
 *  - utmSource/Medium/Campaign/Content — marketing attribution (admin-only)
 *  - referralCode   — marketing attribution (admin-only)
 */
const getLeadDetail = async (req, res) => {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      select: {
        // Lead core fields — safe for CCL
        id: true,
        userId: true,
        fullName: true,
        email: true,
        mobileNumber: true,
        classStandard: true,
        stream: true,
        city: true,
        pincode: true,
        userType: true,
        selectedPlan: true,
        status: true,
        leadSource: true,
        counsellingInterested: true,
        counsellingNotes: true,
        assessmentId: true,
        reportId: true,
        createdAt: true,
        updatedAt: true,
        // paymentId intentionally excluded — financial reference (admin-only)
        // utmSource/Medium/Campaign/Content/referralCode excluded — marketing attribution (admin-only)

        // Related data
        events: { orderBy: { createdAt: 'asc' } },
        user: {
          select: {
            id: true, email: true, role: true, isActive: true, createdAt: true,
            studentProfile: {
              select: {
                fullName: true, classStandard: true, board: true,
                city: true, mobileNumber: true, isOnboardingComplete: true,
                careerAspirations: true, preferredSubjects: true,
              },
            },
            assessments: {
              orderBy: { createdAt: 'desc' },
              take: 3,
              select: {
                id: true, status: true, accessLevel: true,
                currentStep: true, totalQuestions: true,
                startedAt: true, completedAt: true,
              },
            },
            // payments intentionally excluded — financial data (admin-only)
          },
        },
      },
    });

    if (!lead) return errorResponse(res, 'Lead not found', 404, 'NOT_FOUND');

    return successResponse(res, lead);
  } catch (err) {
    logger.error('[Staff] getLeadDetail error', { error: err.message });
    throw err;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// STUDENTS (read-only view)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/staff/students  (CCL+ required)
 * Paginated user list — read-only, no status toggle.
 */
const listStudents = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { role: 'STUDENT' };
    if (search) {
      where.OR = [{ email: { contains: search, mode: 'insensitive' } }];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, email: true, role: true, isActive: true, createdAt: true,
          studentProfile: {
            select: { fullName: true, classStandard: true, city: true, isOnboardingComplete: true },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return successResponse(res, { users, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    logger.error('[Staff] listStudents error', { error: err.message });
    throw err;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// REPORTS (read-only view)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/staff/reports  (CCL+ required)
 * Paginated career report list — read-only.
 */
const listReports = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const where = status ? { status } : {};

    const [reports, total] = await Promise.all([
      prisma.careerReport.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, accessLevel: true, status: true,
          topCareers: true, recommendedStream: true,
          confidenceScore: true, generatedAt: true, createdAt: true,
          userId: true,
        },
      }),
      prisma.careerReport.count({ where }),
    ]);

    return successResponse(res, { reports, total, page: parseInt(page) });
  } catch (err) {
    logger.error('[Staff] listReports error', { error: err.message });
    throw err;
  }
};

module.exports = {
  loginStaff,
  logoutStaff,
  getStaffProfile,
  listLeads,
  getLeadDetail,
  listStudents,
  listReports,
};
