'use strict';
const crypto = require('crypto');
const prisma = require('../config/database');
const { successResponse, errorResponse } = require('../utils/helpers');
const logger = require('../utils/logger');
const { triggerAutomation } = require('../services/automation/automationService');
const { generateReportAsync } = require('./assessment.controller');

/**
 * GET /admin/users
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

    logger.info('[Admin] Lead updated', { leadId: req.params.id, adminId: req.admin.id });
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

      await prisma.careerReport.update({
        where: { id: lead.reportId },
        data: { status: 'GENERATING' },
      });
      await prisma.leadEvent.create({
        data: { id: crypto.randomUUID(), leadId: lead.id, event: 'admin_regenerate_report', metadata: { adminId: req.admin.id } },
      });

      // Fire-and-forget — never throws
      generateReportAsync(report.assessment, profile, lead.reportId, report.reportType);

      return successResponse(res, null, 'Report regeneration queued');
    }

    if (action === 'resend_report_link') {
      await triggerAutomation('premium_report_ready', { leadId: lead.id, reportId: lead.reportId });
      await prisma.leadEvent.create({
        data: { id: crypto.randomUUID(), leadId: lead.id, event: 'admin_resend_report_link', metadata: { adminId: req.admin.id } },
      });
      return successResponse(res, null, 'Report link resent via WhatsApp');
    }

    if (action === 'mark_counselling') {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { counsellingInterested: true, status: 'counselling_interested' },
      });
      await prisma.leadEvent.create({
        data: { id: crypto.randomUUID(), leadId: lead.id, event: 'admin_mark_counselling', metadata: { adminId: req.admin.id } },
      });
      return successResponse(res, null, 'Lead marked as counselling interested');
    }

    return errorResponse(res, `Unknown action: ${action}`, 400, 'INVALID_ACTION');
  } catch (err) {
    logger.error('[Admin] triggerAdminAction error', { error: err.message });
    throw err;
  }
};

module.exports = {
  listUsers,
  getAnalytics,
  listPayments,
  listReports,
  getAIUsage,
  exportLeads,
  exportPayments,
  toggleUserStatus,
  listLeads,
  getLeadDetail,
  getFunnelMetrics,
  updateLeadAdmin,
  triggerAdminAction,
};
