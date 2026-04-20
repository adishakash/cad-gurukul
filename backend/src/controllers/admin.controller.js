// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE OAUTH ADMIN CONNECT (refresh token generation)
// ─────────────────────────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

/**
 * GET /api/v1/admin/google/connect/initiate
 * Step 1: Redirect admin to Google OAuth consent screen.
 */
const googleConnectInitiate = (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${req.protocol}://${req.get('host')}/api/v1/admin/google/connect/callback`;
  if (!clientId || !clientSecret) {
    return errorResponse(res, 'Google client ID/secret missing in env', 500);
  }
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/userinfo.email',
    'openid',
  ];
  const url = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes,
  });
  return res.redirect(url);
};

/**
 * GET /api/v1/admin/google/connect/callback
 * Step 2: Handle Google OAuth callback, extract refresh token, and store securely.
 */
const googleConnectCallback = async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${req.protocol}://${req.get('host')}/api/v1/admin/google/connect/callback`;
  const code = req.query.code;
  if (!clientId || !clientSecret) {
    return errorResponse(res, 'Google client ID/secret missing in env', 500);
  }
  if (!code) {
    return errorResponse(res, 'Missing code in callback', 400);
  }
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  try {
    const { tokens } = await oauth2.getToken(code);
    if (!tokens.refresh_token) {
      return errorResponse(res, 'No refresh token received. Try removing previous consent in your Google account.', 400);
    }
    // Store refresh token securely (write to .env.local, never commit to git)
    const envPath = path.join(__dirname, '../../.env.local');
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
      envContent = envContent.replace(/^GOOGLE_REFRESH_TOKEN=.*$/m, '');
    }
    envContent += `\nGOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`;
    fs.writeFileSync(envPath, envContent, 'utf8');
    logger.info('[GoogleOAuth] Refresh token stored in .env.local');
    return res.send('Google OAuth successful! Refresh token saved to backend/.env.local. Copy it to your main .env for production.');
  } catch (err) {
    logger.error('[GoogleOAuth] Error exchanging code', { error: err.message });
    return errorResponse(res, 'Failed to exchange code for tokens', 500);
  }
};
'use strict';
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../config/database');
const { successResponse, errorResponse } = require('../utils/helpers');
const { signAccessToken, signRefreshToken, saveRefreshToken } = require('../utils/token');
const logger = require('../utils/logger');
const { triggerAutomation } = require('../services/automation/automationService');
const { generateReportAsync } = require('./assessment.controller');
const { sendReportReadyEmail, sendCounsellingReportEmail } = require('../services/email/emailService');

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/admin/login  (public — no auth required)
 *
 * Unified login for admin roles.  Looks up the User model (not AdminUser),
 * enforces role = ADMIN, and issues a standard JWT `{ userId, role }` so that
 * the same `authenticate` middleware works for all roles.
 *
 * Returns: accessToken (JWT) + refreshToken (opaque UUID, stored in DB).
 *
 * Security notes:
 *  - Always runs bcrypt.compare() regardless of whether the user exists,
 *    to prevent user-enumeration via response timing.
 *  - Non-existent user, wrong password, and wrong role all return the
 *    same 401 INVALID_CREDENTIALS to prevent information leakage.
 */

// Structurally valid bcrypt hash (cost 12, 60 chars).
// Used as a dummy target when no real user is found so that
// bcrypt still performs its full work-factor computation.
const DUMMY_HASH = '$2a$12$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true, email: true, passwordHash: true,
        role: true, name: true, isActive: true,
      },
    });

    // Always run bcrypt to prevent timing-based user enumeration.
    const hashToCompare = (user && user.isActive) ? user.passwordHash : DUMMY_HASH;
    const isPasswordValid = await bcrypt.compare(password, hashToCompare);

    // Generic error for: user not found | inactive | wrong password | wrong role.
    // All cases return identical 401 — no information leakage.
    if (!user || !user.isActive || !isPasswordValid || user.role !== 'ADMIN') {
      return errorResponse(res, 'Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    const accessToken = signAccessToken(user.id, user.role);
    const refreshToken = signRefreshToken();
    await saveRefreshToken(user.id, refreshToken);

    logger.info('[Admin] Admin logged in', { userId: user.id, email: user.email });

    return successResponse(res, {
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      accessToken,
      refreshToken,
    }, 'Login successful');
  } catch (err) {
    logger.error('[Admin] loginAdmin error', { error: err.message });
    throw err;
  }
};

/**
 * POST /api/v1/admin/logout  (ADMIN only)
 * Revokes the admin's refresh token so it cannot be used to get new access tokens.
 */
const logoutAdmin = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    }
    logger.info('[Admin] Admin logged out', { userId: req.user.id });
    return successResponse(res, null, 'Logged out successfully');
  } catch (err) {
    logger.error('[Admin] logoutAdmin error', { error: err.message });
    throw err;
  }
};

/**
 * GET /api/v1/admin/profile  (ADMIN only)
 * Returns the authenticated admin's own user record.
 */
const getAdminProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, email: true, name: true, role: true,
        isActive: true, createdAt: true, updatedAt: true,
      },
    });

    if (!user) return errorResponse(res, 'Admin not found', 404, 'NOT_FOUND');

    return successResponse(res, { user });
  } catch (err) {
    logger.error('[Admin] getAdminProfile error', { error: err.message });
    throw err;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /admin/users  —  paginated user list with optional search.
 * Alias: getAllUsers
 */
const listUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = search
      ? { OR: [{ email: { contains: search, mode: 'insensitive' } }] }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, email: true, role: true, isActive: true, createdAt: true,
          studentProfile: { select: { fullName: true, classStandard: true, city: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return successResponse(res, { users, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    logger.error('[Admin] listUsers error', { error: err.message });
    throw err;
  }
};

/**
 * GET /admin/analytics
 */
const getAnalytics = async (req, res) => {
  try {
    const { days } = req.query;
    const since = days ? new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000) : null;
    const dateFilter = since ? { createdAt: { gte: since } } : {};

    const [
      totalUsers, totalAssessments, totalCompletedReports,
      totalPayments, totalRevenuePaise, recentSignups,
    ] = await Promise.all([
      prisma.user.count({ where: dateFilter }),
      prisma.assessment.count({ where: dateFilter }),
      prisma.careerReport.count({ where: { status: 'COMPLETED', ...dateFilter } }),
      prisma.payment.count({ where: { status: 'CAPTURED', ...dateFilter } }),
      prisma.payment.aggregate({ where: { status: 'CAPTURED', ...dateFilter }, _sum: { amountPaise: true } }),
      prisma.user.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
    ]);

    return successResponse(res, {
      totalUsers,
      totalAssessments,
      totalCompletedReports,
      totalPayments,
      totalRevenueRupees: ((totalRevenuePaise._sum.amountPaise || 0) / 100).toFixed(2),
      recentSignups,
    });
  } catch (err) {
    logger.error('[Admin] getAnalytics error', { error: err.message });
    throw err;
  }
};

/**
 * GET /admin/payments
 */
const listPayments = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { email: true } } },
      }),
      prisma.payment.count(),
    ]);

    return successResponse(res, { payments, total, page: parseInt(page) });
  } catch (err) {
    logger.error('[Admin] listPayments error', { error: err.message });
    throw err;
  }
};

/**
 * GET /admin/reports
 */
const listReports = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
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
    logger.error('[Admin] listReports error', { error: err.message });
    throw err;
  }
};

/**
 * GET /admin/ai-usage
 */
const getAIUsage = async (req, res) => {
  try {
    const [byProvider, totals] = await Promise.all([
      prisma.aISession.groupBy({
        by: ['provider', 'model'],
        _sum: { totalTokens: true, promptTokens: true, completionTokens: true },
        _count: { id: true },
      }),
      prisma.aISession.aggregate({
        _sum: { totalTokens: true },
        _count: { id: true },
        _avg: { latencyMs: true },
      }),
    ]);

    return successResponse(res, { byProvider, totals });
  } catch (err) {
    logger.error('[Admin] getAIUsage error', { error: err.message });
    throw err;
  }
};

/**
 * GET /admin/export/leads – CSV export of lead funnel records
 */
const exportLeads = async (req, res) => {
  try {
    const leads = await prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

    const csvRows = [
      'Name,Email,Mobile,Class,Stream,City,Plan,Status,Lead Source,UTM Source,UTM Campaign,Counselling Interested,Created At',
      ...leads.map((l) =>
        [
          escape(l.fullName),
          escape(l.email),
          escape(l.mobileNumber),
          escape(l.classStandard || ''),
          escape(l.stream || ''),
          escape(l.city || ''),
          escape(l.selectedPlan),
          escape(l.status),
          escape(l.leadSource),
          escape(l.utmSource || ''),
          escape(l.utmCampaign || ''),
          escape(l.counsellingInterested ? 'Yes' : 'No'),
          escape(l.createdAt.toISOString()),
        ].join(',')
      ),
    ];

    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="cad-gurukul-leads.csv"',
    });

    return res.send(csvRows.join('\n'));
  } catch (err) {
    logger.error('[Admin] exportLeads error', { error: err.message });
    throw err;
  }
};

/**
 * GET /admin/export/payments – CSV export
 */
const exportPayments = async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { email: true } } },
    });

    const csvRows = [
      'Payment ID,User Email,Amount (INR),Status,Provider,Razorpay Order ID,Razorpay Payment ID,Paid At,Created At',
      ...payments.map((p) =>
        `"${p.id}","${p.user?.email || ''}","${(p.amountPaise || 0) / 100}","${p.status}","${p.provider}","${p.razorpayOrderId || ''}","${p.razorpayPaymentId || ''}","${p.paidAt ? p.paidAt.toISOString() : ''}","${p.createdAt.toISOString()}"`
      ),
    ];

    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="cad-gurukul-payments.csv"',
    });

    return res.send(csvRows.join('\n'));
  } catch (err) {
    logger.error('[Admin] exportPayments error', { error: err.message });
    throw err;
  }
};

/**
 * DELETE /api/v1/admin/users/:id
 * Soft-delete a user account:
 *   - Sets deletedAt + isActive=false → login blocked immediately.
 *   - Revokes all refresh tokens.
 *   - Preserves payments, reports, leads (relational integrity maintained).
 *   - Does NOT delete ADMIN accounts via this endpoint.
 */
const deleteUser = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return errorResponse(res, 'User not found', 404, 'NOT_FOUND');
    if (user.role === 'ADMIN') {
      return errorResponse(res, 'Admin accounts cannot be deleted via this endpoint', 403, 'FORBIDDEN');
    }
    if (user.deletedAt) {
      return errorResponse(res, 'User is already deleted', 409, 'ALREADY_DELETED');
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: req.params.id },
        data: { deletedAt: new Date(), isActive: false },
      }),
      prisma.refreshToken.deleteMany({ where: { userId: req.params.id } }),
    ]);

    logger.info('[Admin] User soft-deleted', { targetId: req.params.id, adminId: req.user.id });
    return successResponse(res, null, 'User account deleted. Login access revoked.');
  } catch (err) {
    logger.error('[Admin] deleteUser error', { error: err.message });
    throw err;
  }
};

/**
 * PUT /admin/users/:id/toggle-status
 */
const toggleUserStatus = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) {
      return errorResponse(res, 'User not found', 404, 'NOT_FOUND');
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: !user.isActive },
      select: { id: true, email: true, isActive: true },
    });

    return successResponse(res, updated, `User ${updated.isActive ? 'activated' : 'deactivated'}`);
  } catch (err) {
    logger.error('[Admin] toggleUserStatus error', { error: err.message });
    throw err;
  }
};

/**
 * GET /admin/leads
 * List leads with filters: status, leadSource, class, date range, plan
 */
const listLeads = async (req, res) => {
  try {
    const {
      page = 1, limit = 25,
      status, leadSource, classStandard, selectedPlan,
      source, plan, dateFrom, dateTo,
      search, from, to, sortBy = 'createdAt', sortDir = 'desc',
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    const finalLeadSource = leadSource || source;
    const finalSelectedPlan = selectedPlan || plan;
    const finalDateFrom = dateFrom || from;
    const finalDateTo = dateTo || to;

    if (status)        where.status       = status;
    if (finalLeadSource) where.leadSource = finalLeadSource;
    if (classStandard) where.classStandard = classStandard;
    if (finalSelectedPlan) where.selectedPlan = finalSelectedPlan;

    if (finalDateFrom || finalDateTo) {
      where.createdAt = {};
      if (finalDateFrom) where.createdAt.gte = new Date(finalDateFrom);
      if (finalDateTo)   where.createdAt.lte = new Date(finalDateTo);
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
          utmSource: true, utmCampaign: true,
          counsellingInterested: true, assessmentId: true,
          reportId: true, paymentId: true, createdAt: true, updatedAt: true,
          assignedStaffId: true, assignedAt: true,
          assignedStaff: { select: { id: true, name: true, email: true, role: true } },
        },
      }),
      prisma.lead.count({ where }),
    ]);

    return successResponse(res, { leads, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    logger.error('[Admin] listLeads error', { error: err.message });
    throw err;
  }
};

/**
 * GET /admin/leads/:id
 * Full lead detail with event timeline.
 */
const getLeadDetail = async (req, res) => {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      include: {
        events: { orderBy: { createdAt: 'asc' } },
        user: {
          select: {
            id: true, email: true, role: true, isActive: true, createdAt: true,
            studentProfile: { select: { fullName: true, classStandard: true, board: true, city: true, mobileNumber: true, isOnboardingComplete: true } },
            assessments: {
              orderBy: { createdAt: 'desc' },
              take: 3,
              select: { id: true, status: true, accessLevel: true, currentStep: true, totalQuestions: true, startedAt: true, completedAt: true },
            },
            payments: {
              orderBy: { createdAt: 'desc' },
              take: 3,
              select: { id: true, amountPaise: true, status: true, razorpayOrderId: true, paidAt: true, createdAt: true },
            },
          },
        },
      },
    });

    if (!lead) return errorResponse(res, 'Lead not found', 404, 'NOT_FOUND');

    return successResponse(res, lead);
  } catch (err) {
    logger.error('[Admin] getLeadDetail error', { error: err.message });
    throw err;
  }
};

/**
 * GET /admin/funnel
 * Conversion funnel metrics + source breakdown.
 */
const getFunnelMetrics = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

    const [
      totalLeads,
      byStatus,
      bySource,
      totalRevenuePaise,
      paidLeads,
      assessmentStarted,
      assessmentCompleted,
      freeReportReady,
      premiumReportReady,
      counsellingInterested,
    ] = await Promise.all([
      prisma.lead.count({ where: { createdAt: { gte: since } } }),
      prisma.lead.groupBy({
        by: ['status'],
        _count: { id: true },
        where: { createdAt: { gte: since } },
      }),
      prisma.lead.groupBy({
        by: ['leadSource'],
        _count: { id: true },
        where: { createdAt: { gte: since } },
      }),
      prisma.payment.aggregate({
        where: { status: 'CAPTURED', createdAt: { gte: since } },
        _sum: { amountPaise: true },
      }),
      prisma.lead.count({ where: { status: 'paid', createdAt: { gte: since } } }),
      prisma.lead.count({ where: { status: 'assessment_started', createdAt: { gte: since } } }),
      prisma.lead.count({ where: { status: 'assessment_completed', createdAt: { gte: since } } }),
      prisma.lead.count({ where: { status: 'free_report_ready', createdAt: { gte: since } } }),
      prisma.lead.count({ where: { status: 'premium_report_ready', createdAt: { gte: since } } }),
      prisma.lead.count({ where: { counsellingInterested: true, createdAt: { gte: since } } }),
    ]);

    const conversionRate = totalLeads > 0
      ? ((paidLeads / totalLeads) * 100).toFixed(1)
      : '0.0';

    return successResponse(res, {
      period: { days: parseInt(days), since },
      funnel: {
        totalLeads,
        assessmentStarted,
        assessmentCompleted,
        freeReportReady,
        paid: paidLeads,
        premiumReportReady,
        counsellingInterested,
      },
      conversionRate: `${conversionRate}%`,
      totalRevenueRupees: ((totalRevenuePaise._sum.amountPaise || 0) / 100).toFixed(2),
      statusBreakdown: byStatus.map((r) => ({ status: r.status, count: r._count.id })),
      sourceBreakdown: bySource.map((r) => ({ source: r.leadSource, count: r._count.id })),
    });
  } catch (err) {
    logger.error('[Admin] getFunnelMetrics error', { error: err.message });
    throw err;
  }
};

/**
 * PUT /api/v1/admin/leads/:id/assign
 * Assign (or unassign) a lead to a specific CC or CCL staff member.
 * Body: { staffId: string|null }  — null unassigns.
 * Only one staff member can be assigned at a time (previous assignment replaced).
 */
const assignLead = async (req, res) => {
  try {
    const { staffId } = req.body;

    // Unassign: staffId = null
    if (staffId === null || staffId === undefined) {
      const updated = await prisma.lead.update({
        where: { id: req.params.id },
        data: { assignedStaffId: null, assignedAt: null, assignedBy: null },
        select: { id: true, fullName: true, assignedStaffId: true, assignedAt: true },
      });
      logger.info('[Admin] Lead unassigned', { leadId: req.params.id, adminId: req.user.id });
      return successResponse(res, updated, 'Lead assignment removed.');
    }

    // Validate staff member exists and has an allowed role
    const staff = await prisma.user.findUnique({
      where: { id: staffId },
      select: { id: true, name: true, email: true, role: true, isActive: true, deletedAt: true },
    });
    if (!staff) return errorResponse(res, 'Staff member not found', 404, 'NOT_FOUND');
    if (!STAFF_ROLES.has(staff.role)) {
      return errorResponse(res, 'Assignee must be a CC or CCL staff member', 422, 'INVALID_ASSIGNEE');
    }
    if (!staff.isActive || staff.deletedAt) {
      return errorResponse(res, 'Cannot assign to an inactive or deleted staff member', 422, 'STAFF_INACTIVE');
    }

    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } });
    if (!lead) return errorResponse(res, 'Lead not found', 404, 'NOT_FOUND');

    const updated = await prisma.lead.update({
      where: { id: req.params.id },
      data: {
        assignedStaffId: staffId,
        assignedAt: new Date(),
        assignedBy: req.user.id,
      },
      select: {
        id: true, fullName: true, assignedStaffId: true, assignedAt: true,
        assignedStaff: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    logger.info('[Admin] Lead assigned to staff', { leadId: req.params.id, staffId, adminId: req.user.id });
    return successResponse(res, updated, `Lead assigned to ${staff.name || staff.email}`);
  } catch (err) {
    logger.error('[Admin] assignLead error', { error: err.message });
    throw err;
  }
};

/**
 * PATCH /admin/leads/:id
 * Admin can update lead status, counselling flag, notes.
 */
const updateLeadAdmin = async (req, res) => {
  const VALID_STATUSES = [
    'new_lead', 'onboarding_started', 'plan_selected', 'assessment_started',
    'assessment_in_progress', 'assessment_completed', 'free_report_ready',
    'payment_pending', 'paid', 'premium_report_generating',
    'premium_report_ready', 'counselling_interested', 'closed',
  ];

  try {
    const { status, counsellingInterested, counsellingNotes } = req.body;

    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return errorResponse(res, `Invalid status value: ${status}`, 422, 'VALIDATION_ERROR');
    }

    const data = {};
    if (status !== undefined)               data.status = status;
    if (counsellingInterested !== undefined) data.counsellingInterested = counsellingInterested;
    if (counsellingNotes !== undefined)      data.counsellingNotes = counsellingNotes;

    const updated = await prisma.lead.update({
      where: { id: req.params.id },
      data,
    });

    logger.info('[Admin] Lead updated', { leadId: req.params.id, adminId: req.user.id });
    return successResponse(res, updated);
  } catch (err) {
    logger.error('[Admin] updateLeadAdmin error', { error: err.message });
    throw err;
  }
};

/**
 * POST /admin/leads/:id/actions
 * Manual trigger buttons: regenerate_report | resend_report_link | mark_counselling.
 */
const triggerAdminAction = async (req, res) => {
  try {
    const { action } = req.body;
    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } });
    if (!lead) return errorResponse(res, 'Lead not found', 404, 'NOT_FOUND');

    if (action === 'regenerate_report') {
      if (!lead.reportId) return errorResponse(res, 'No report linked to this lead', 400, 'NO_REPORT');

      // Fetch the full report with its assessment so we can re-run generation
      const report = await prisma.careerReport.findUnique({
        where: { id: lead.reportId },
        include: {
          assessment: { include: { questions: true, answers: true } },
        },
      });
      if (!report?.assessment) {
        return errorResponse(res, 'Assessment data missing for this report', 400, 'MISSING_DATA');
      }

      const profile = await prisma.studentProfile.findUnique({
        where: { userId: report.userId },
        include: { parentDetail: true },
      });

      // Determine target plan type: use lead.planType for paid leads, else keep existing
      const PAID_LEAD_STATUSES = ['payment_pending', 'paid', 'premium_report_generating', 'premium_report_ready', 'counselling_interested', 'closed'];
      const leadIsPaid = PAID_LEAD_STATUSES.includes(lead.status);
      const targetAccessLevel = leadIsPaid ? 'PAID' : report.accessLevel;
      const targetReportType = (leadIsPaid && report.reportType === 'free') ? (lead.planType || 'standard') : (report.reportType || 'standard');

      await prisma.careerReport.update({
        where: { id: lead.reportId },
        data: { status: 'GENERATING', accessLevel: targetAccessLevel, reportType: targetReportType },
      });
      await prisma.leadEvent.create({
        data: { id: crypto.randomUUID(), leadId: lead.id, event: 'admin_regenerate_report', metadata: { adminId: req.user.id } },
      });

      // Fire-and-forget — never throws
      generateReportAsync(report.assessment, profile, lead.reportId, targetReportType);

      return successResponse(res, null, 'Report regeneration queued');
    }

    if (action === 'resend_report_link') {
      await triggerAutomation('premium_report_ready', { leadId: lead.id, reportId: lead.reportId });

      // Also re-send email (fire-and-forget).
      // NOTE: CareerReport has no 'user' Prisma relation — fetch user separately via report.userId.
      if (lead.reportId) {
        (async () => {
          try {
            const rpt = await prisma.careerReport.findUnique({ where: { id: lead.reportId } });
            if (!rpt) return;
            const rptUser = await prisma.user.findUnique({
              where: { id: rpt.userId },
              select: {
                email: true,
                studentProfile: {
                  select: { fullName: true, parentDetail: { select: { email: true, parentName: true } } },
                },
              },
            });
            if (!rptUser?.email) return;
            const sName = rptUser.studentProfile?.fullName || rptUser.email.split('@')[0];
            const args  = { reportId: lead.reportId, accessLevel: rpt.accessLevel, reportType: rpt.reportType };
            sendReportReadyEmail({ to: rptUser.email, name: sName, ...args })
              .catch((e) => logger.warn('[Admin] resend email failed', { error: e.message }));
            const pEmail = rptUser.studentProfile?.parentDetail?.email;
            const pName  = rptUser.studentProfile?.parentDetail?.parentName;
            if (pEmail && rpt.accessLevel === 'PAID') {
              sendReportReadyEmail({ to: pEmail, name: pName || `Parent of ${sName}`, isParent: true, studentName: sName, ...args })
                .catch((e) => logger.warn('[Admin] resend parent email failed', { error: e.message }));
            }
          } catch (err) {
            logger.warn('[Admin] resend email block failed', { error: err.message });
          }
        })();
      }

      await prisma.leadEvent.create({
        data: { id: crypto.randomUUID(), leadId: lead.id, event: 'admin_resend_report_link', metadata: { adminId: req.user.id } },
      });
      return successResponse(res, null, 'Report link resent via WhatsApp and email');
    }

    if (action === 'mark_counselling') {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { counsellingInterested: true, status: 'counselling_interested' },
      });
      await prisma.leadEvent.create({
        data: { id: crypto.randomUUID(), leadId: lead.id, event: 'admin_mark_counselling', metadata: { adminId: req.user.id } },
      });
      return successResponse(res, null, 'Lead marked as counselling interested');
    }

    if (action === 'send_counselling_report') {
      // Admin manually triggers final counselling-report-ready email after session completion
      if (!lead.userId) return errorResponse(res, 'Lead has no linked user', 400, 'NO_USER');

      const leadUser = await prisma.user.findUnique({
        where: { id: lead.userId },
        select: {
          email: true,
          studentProfile: {
            select: { fullName: true, parentDetail: { select: { email: true, parentName: true } } },
          },
        },
      });

      if (!leadUser?.email) return errorResponse(res, 'User email not found', 400, 'NO_EMAIL');

      const sName = leadUser.studentProfile?.fullName || leadUser.email.split('@')[0];
      const pEmail = leadUser.studentProfile?.parentDetail?.email;
      const pName  = leadUser.studentProfile?.parentDetail?.parentName;

      const booking = await prisma.consultationBooking.findFirst({ where: { userId: lead.userId } });

      // Fire-and-forget
      sendCounsellingReportEmail({
        to: leadUser.email, name: sName, reportId: lead.reportId, bookingId: booking?.id,
      }).catch((e) => logger.warn('[Admin] send_counselling_report email failed', { error: e.message }));

      if (pEmail) {
        sendCounsellingReportEmail({
          to: pEmail, name: pName || `Parent of ${sName}`, reportId: lead.reportId,
          bookingId: booking?.id, isParent: true, studentName: sName,
        }).catch((e) => logger.warn('[Admin] send_counselling_report parent email failed', { error: e.message }));
      }

      await prisma.leadEvent.create({
        data: { id: crypto.randomUUID(), leadId: lead.id, event: 'admin_send_counselling_report', metadata: { adminId: req.user.id } },
      });

      return successResponse(res, null, 'Counselling report email sent to student' + (pEmail ? ' and parent' : ''));
    }

    return errorResponse(res, `Unknown action: ${action}`, 400, 'INVALID_ACTION');
  } catch (err) {
    logger.error('[Admin] triggerAdminAction error', { error: err.message });
    throw err;
  }
};

module.exports = {
  // ── Auth ───────────────────────────────────────────────────────────────────
  loginAdmin,
  logoutAdmin,
  getAdminProfile,

  // ── Users ──────────────────────────────────────────────────────────────────
  listUsers,
  getAllUsers: listUsers,   // spec alias
  toggleUserStatus,
  deleteUser,

  // ── Analytics ──────────────────────────────────────────────────────────────
  getAnalytics,

  // ── Payments ───────────────────────────────────────────────────────────────
  listPayments,

  // ── Reports ────────────────────────────────────────────────────────────────
  listReports,
  getAllReports: listReports, // spec alias

  // ── AI ─────────────────────────────────────────────────────────────────────
  getAIUsage,

  // ── Exports ────────────────────────────────────────────────────────────────
  exportLeads,
  exportPayments,

  // ── Leads / CRM ────────────────────────────────────────────────────────────
  listLeads,
  getAllLeads: listLeads,   // spec alias
  getLeadDetail,
  getFunnelMetrics,
  updateLeadAdmin,
  triggerAdminAction,
  assignLead,

  // ── Staff Management ───────────────────────────────────────────────────────
  listStaff,
  createStaff,
  updateStaffRole,
  toggleStaffStatus,
  deleteStaff,
};

// ─────────────────────────────────────────────────────────────────────────────
// STAFF MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

const STAFF_ROLES = new Set(['CAREER_COUNSELLOR_LEAD', 'CAREER_COUNSELLOR']);

/**
 * GET /api/v1/admin/staff
 * Lists active CC and CCL users (deletedAt = null).
 * ?showDeleted=true — list only soft-deleted staff (history view).
 */
async function listStaff(req, res) {
  try {
    const showDeleted = req.query.showDeleted === 'true';
    const where = {
      role: { in: ['CAREER_COUNSELLOR_LEAD', 'CAREER_COUNSELLOR'] },
      deletedAt: showDeleted ? { not: null } : null,
    };
    const staff = await prisma.user.findMany({
      where,
      select: {
        id: true, name: true, email: true, role: true, isActive: true,
        deletedAt: true, createdAt: true, approvedAt: true, isApproved: true,
      },
      orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
    });
    return successResponse(res, { staff, total: staff.length });
  } catch (err) {
    logger.error('[Admin] listStaff error', { error: err.message });
    throw err;
  }
}

/**
 * DELETE /api/v1/admin/staff/:id
 * Soft-delete a CC or CCL staff member:
 *   - Sets deletedAt + isActive=false so they cannot log in.
 *   - Revokes all refresh tokens (immediate session termination).
 *   - Preserves the record for audit history.
 * Prevents deletion of ADMIN accounts or non-staff users.
 */
async function deleteStaff(req, res) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return errorResponse(res, 'Staff user not found', 404, 'NOT_FOUND');
    if (!STAFF_ROLES.has(user.role)) {
      return errorResponse(res, 'Target user is not a CC/CCL staff member', 422, 'INVALID_TARGET');
    }
    if (user.deletedAt) {
      return errorResponse(res, 'Staff user is already deleted', 409, 'ALREADY_DELETED');
    }

    // Soft delete + revoke all sessions atomically
    await prisma.$transaction([
      prisma.user.update({
        where: { id: req.params.id },
        data: { deletedAt: new Date(), isActive: false },
      }),
      prisma.refreshToken.deleteMany({ where: { userId: req.params.id } }),
    ]);

    logger.info('[Admin] Staff user soft-deleted', { targetId: req.params.id, adminId: req.user.id });
    return successResponse(res, null, 'Staff user deleted. Session revoked and access removed.');
  } catch (err) {
    logger.error('[Admin] deleteStaff error', { error: err.message });
    throw err;
  }
}

/**
 * POST /api/v1/admin/staff
 * Creates a new CC or CCL user.
 * Body: { name, email, password, role }
 */
async function createStaff(req, res) {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return errorResponse(res, 'name, email, password and role are required', 400, 'VALIDATION_ERROR');
    }
    if (!STAFF_ROLES.has(role)) {
      return errorResponse(res, 'role must be CAREER_COUNSELLOR or CAREER_COUNSELLOR_LEAD', 422, 'INVALID_ROLE');
    }
    if (password.length < 8) {
      return errorResponse(res, 'Password must be at least 8 characters', 400, 'VALIDATION_ERROR');
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return errorResponse(res, 'A user with this email already exists', 409, 'CONFLICT');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const staff = await prisma.user.create({
      data: { name, email, passwordHash, role, isActive: true, isApproved: true, approvedAt: new Date() },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });

    logger.info('[Admin] Staff user created', { newUserId: staff.id, role: staff.role, adminId: req.user.id });
    return successResponse(res, staff, 'Staff user created successfully', 201);
  } catch (err) {
    logger.error('[Admin] createStaff error', { error: err.message });
    throw err;
  }
}

/**
 * PATCH /api/v1/admin/staff/:id/role
 * Promotes or demotes a staff user between CC and CCL.
 * Body: { role }
 */
async function updateStaffRole(req, res) {
  try {
    const { role } = req.body;
    if (!STAFF_ROLES.has(role)) {
      return errorResponse(res, 'role must be CAREER_COUNSELLOR or CAREER_COUNSELLOR_LEAD', 422, 'INVALID_ROLE');
    }

    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return errorResponse(res, 'Staff user not found', 404, 'NOT_FOUND');
    if (!STAFF_ROLES.has(user.role)) {
      return errorResponse(res, 'Target user is not a staff member', 422, 'INVALID_TARGET');
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { role },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    logger.info('[Admin] Staff role updated', { targetId: req.params.id, newRole: role, adminId: req.user.id });
    return successResponse(res, updated, 'Staff role updated');
  } catch (err) {
    logger.error('[Admin] updateStaffRole error', { error: err.message });
    throw err;
  }
}

/**
 * PATCH /api/v1/admin/staff/:id/status
 * Activates or deactivates a staff user.
 */
async function toggleStaffStatus(req, res) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return errorResponse(res, 'Staff user not found', 404, 'NOT_FOUND');
    if (!STAFF_ROLES.has(user.role)) {
      return errorResponse(res, 'Target user is not a staff member', 422, 'INVALID_TARGET');
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: !user.isActive },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    const action = updated.isActive ? 'activated' : 'deactivated';
    logger.info(`[Admin] Staff user ${action}`, { targetId: req.params.id, adminId: req.user.id });
    return successResponse(res, updated, `Staff user ${action}`);
  } catch (err) {
    logger.error('[Admin] toggleStaffStatus error', { error: err.message });
    throw err;
  }
}
