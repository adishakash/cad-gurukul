'use strict';
const prisma = require('../config/database');
const { successResponse, errorResponse } = require('../utils/helpers');
const logger = require('../utils/logger');

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
    const [
      totalUsers, totalAssessments, totalCompletedReports,
      totalPayments, totalRevenuePaise, recentSignups,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.assessment.count(),
      prisma.careerReport.count({ where: { status: 'COMPLETED' } }),
      prisma.payment.count({ where: { status: 'CAPTURED' } }),
      prisma.payment.aggregate({ where: { status: 'CAPTURED' }, _sum: { amountPaise: true } }),
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
 * GET /admin/export/leads – CSV export
 */
const exportLeads = async (req, res) => {
  try {
    const profiles = await prisma.studentProfile.findMany({
      include: { user: { select: { email: true, createdAt: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const csvRows = [
      'Name,Email,Class,Board,City,State,Mobile,Created At',
      ...profiles.map((p) =>
        `"${p.fullName}","${p.user.email}","${p.classStandard || ''}","${p.board || ''}","${p.city || ''}","${p.state || ''}","${p.mobileNumber || ''}","${p.user.createdAt.toISOString()}"`
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

module.exports = { listUsers, getAnalytics, listPayments, listReports, getAIUsage, exportLeads, toggleUserStatus };
