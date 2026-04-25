'use strict';
/**
 * Partner Admin Controller
 * Admin oversight of CC and CCL partner lifecycle:
 *  - List all partners (any role, filter by role/status)
 *  - View partner detail (profile, bank account, commissions summary)
 *  - Approve, reject, suspend partners
 *  - Verify bank accounts
 *  - Commission adjustments (manual credit/debit)
 */

const prisma  = require('../config/database');
const { successResponse, errorResponse } = require('../utils/helpers');
const { notifyPartner } = require('../services/notification/partnerNotificationService');
const logger  = require('../utils/logger');

// ─── List Partners ────────────────────────────────────────────────────────────

const listPartners = async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const skip   = (page - 1) * limit;
    const { role, status, search } = req.query;

    const where = {
      role: role
        ? { equals: role }
        : { in: ['CAREER_COUNSELLOR', 'CAREER_COUNSELLOR_LEAD'] },
    };

    if (search) {
      where.OR = [
        { email:               { contains: search, mode: 'insensitive' } },
        { name:                { contains: search, mode: 'insensitive' } },
        { partnerApplication:  { fullName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (status === 'approved')   where.isApproved = true;
    if (status === 'pending')    { where.isApproved = false; where.suspendedAt = null; }
    if (status === 'suspended')  where.suspendedAt = { not: null };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true, email: true, name: true, role: true,
          isApproved: true, approvedAt: true, suspendedAt: true,
          isConsultationAuthorized: true,
          createdAt: true,
          partnerApplication: {
            select: { fullName: true, phone: true, city: true, status: true, createdAt: true },
          },
          bankAccount: { select: { isVerified: true, bankName: true, accountNumberLast4: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return successResponse(res, { partners: users, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    logger.error('[PartnerAdmin] listPartners error', { error: err.message });
    return errorResponse(res, 'Failed to list partners', 500);
  }
};

// ─── Get Partner Detail ───────────────────────────────────────────────────────

const getPartner = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, name: true, role: true,
        isApproved: true, approvedAt: true, suspendedAt: true, createdAt: true,
        partnerApplication: true,
        bankAccount: {
          select: {
            id: true, accountHolder: true, accountNumberLast4: true,
            ifscCode: true, bankName: true, accountType: true,
            isVerified: true, verifiedAt: true,
          },
        },
      },
    });

    if (!user || !['CAREER_COUNSELLOR', 'CAREER_COUNSELLOR_LEAD'].includes(user.role)) {
      return errorResponse(res, 'Partner not found', 404, 'NOT_FOUND');
    }

    // Commission summary
    let commissionSummary = {};
    if (user.role === 'CAREER_COUNSELLOR') {
      const [sales, comms] = await Promise.all([
        prisma.ccAttributedSale.aggregate({ where: { ccUserId: userId, status: 'confirmed' }, _sum: { netAmountPaise: true, grossAmountPaise: true }, _count: true }),
        prisma.ccCommission.groupBy({ by: ['status'], where: { ccUserId: userId }, _sum: { amountPaise: true } }),
      ]);
      commissionSummary = { sales, commissions: comms };
    } else {
      const [sales, comms] = await Promise.all([
        prisma.cclAttributedSale.aggregate({ where: { cclUserId: userId, status: 'confirmed' }, _sum: { netAmountPaise: true, grossAmountPaise: true }, _count: true }),
        prisma.cclCommission.groupBy({ by: ['status'], where: { cclUserId: userId }, _sum: { amountPaise: true } }),
      ]);
      commissionSummary = { sales, commissions: comms };
    }

    const adjustments = await prisma.commissionAdjustment.findMany({
      where: { partnerId: userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return successResponse(res, { partner: user, commissionSummary, adjustments });
  } catch (err) {
    logger.error('[PartnerAdmin] getPartner error', { error: err.message });
    return errorResponse(res, 'Failed to load partner', 500);
  }
};

// ─── Approve ──────────────────────────────────────────────────────────────────

const approvePartner = async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId    = req.admin.id;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return errorResponse(res, 'Partner not found', 404, 'NOT_FOUND');
    if (user.isApproved) return errorResponse(res, 'Partner already approved', 409, 'CONFLICT');

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data:  { isApproved: true, approvedAt: new Date(), suspendedAt: null },
      }),
      prisma.partnerApplication.update({
        where: { userId },
        data:  { status: 'approved', reviewedBy: adminId, reviewedAt: new Date() },
      }),
    ]);

    logger.info('[PartnerAdmin] Partner approved', { userId, adminId });
    notifyPartner(userId, 'partner_approved', { name: user.name || user.email }).catch(() => {});

    return successResponse(res, null, 'Partner approved successfully');
  } catch (err) {
    logger.error('[PartnerAdmin] approvePartner error', { error: err.message });
    return errorResponse(res, 'Failed to approve partner', 500);
  }
};

// ─── Reject ───────────────────────────────────────────────────────────────────

const rejectPartner = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const adminId    = req.admin.id;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return errorResponse(res, 'Partner not found', 404, 'NOT_FOUND');

    await prisma.partnerApplication.update({
      where: { userId },
      data:  { status: 'rejected', adminNotes: reason, reviewedBy: adminId, reviewedAt: new Date() },
    });

    logger.info('[PartnerAdmin] Partner rejected', { userId, adminId, reason });
    notifyPartner(userId, 'partner_rejected', { name: user.name, reason }).catch(() => {});

    return successResponse(res, null, 'Partner rejected');
  } catch (err) {
    logger.error('[PartnerAdmin] rejectPartner error', { error: err.message });
    return errorResponse(res, 'Failed to reject partner', 500);
  }
};

// ─── Suspend ──────────────────────────────────────────────────────────────────

const suspendPartner = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const adminId    = req.admin.id;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data:  { isActive: false, suspendedAt: new Date() },
      }),
      prisma.partnerApplication.updateMany({
        where: { userId },
        data:  { status: 'suspended', adminNotes: reason, reviewedBy: adminId, reviewedAt: new Date() },
      }),
    ]);

    logger.info('[PartnerAdmin] Partner suspended', { userId, adminId });
    return successResponse(res, null, 'Partner suspended');
  } catch (err) {
    logger.error('[PartnerAdmin] suspendPartner error', { error: err.message });
    return errorResponse(res, 'Failed to suspend partner', 500);
  }
};

// ─── Verify Bank Account ──────────────────────────────────────────────────────

const verifyBankAccount = async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId    = req.admin.id;

    const bank = await prisma.bankAccount.findUnique({ where: { userId } });
    if (!bank) return errorResponse(res, 'No bank account found for this partner', 404, 'NOT_FOUND');

    await prisma.bankAccount.update({
      where: { userId },
      data:  { isVerified: true, verifiedAt: new Date(), verifiedBy: adminId },
    });

    logger.info('[PartnerAdmin] Bank account verified', { userId, adminId });
    notifyPartner(userId, 'bank_account_verified', {}).catch(() => {});

    return successResponse(res, null, 'Bank account verified');
  } catch (err) {
    logger.error('[PartnerAdmin] verifyBankAccount error', { error: err.message });
    return errorResponse(res, 'Failed to verify bank account', 500);
  }
};

// ─── Commission Adjustment ────────────────────────────────────────────────────

const createAdjustment = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role, type, amountPaise, reason } = req.body;
    const adminId = req.admin.id;

    if (!['CC', 'CCL'].includes(role)) return errorResponse(res, 'role must be CC or CCL', 400, 'INVALID_ROLE');

    const adj = await prisma.commissionAdjustment.create({
      data: { role, partnerId: userId, type, amountPaise, reason, createdBy: adminId },
    });

    logger.info('[PartnerAdmin] Commission adjustment created', { adjId: adj.id, userId, type, amountPaise });
    return successResponse(res, adj, 'Adjustment recorded', 201);
  } catch (err) {
    logger.error('[PartnerAdmin] createAdjustment error', { error: err.message });
    return errorResponse(res, 'Failed to create adjustment', 500);
  }
};

// ─── List Adjustments ─────────────────────────────────────────────────────────

const listAdjustments = async (req, res) => {
  try {
    const { userId } = req.params;
    const adjustments = await prisma.commissionAdjustment.findMany({
      where:   { partnerId: userId },
      orderBy: { createdAt: 'desc' },
    });
    return successResponse(res, { adjustments });
  } catch (err) {
    logger.error('[PartnerAdmin] listAdjustments error', { error: err.message });
    return errorResponse(res, 'Failed to list adjustments', 500);
  }
};

// ─── Partner Performance ────────────────────────────────────────────────────

const listPartnerPerformance = async (req, res) => {
  try {
    const role = req.query.role;
    if (!['CAREER_COUNSELLOR', 'CAREER_COUNSELLOR_LEAD'].includes(role)) {
      return errorResponse(res, 'role must be CAREER_COUNSELLOR or CAREER_COUNSELLOR_LEAD', 400, 'INVALID_ROLE');
    }

    const partners = await prisma.user.findMany({
      where: { role, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        isApproved: true,
        suspendedAt: true,
        isConsultationAuthorized: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const isCC = role === 'CAREER_COUNSELLOR';
    const salesRows = isCC
      ? await prisma.ccAttributedSale.groupBy({
          by: ['ccUserId'],
          where: { status: 'confirmed' },
          _sum: { grossAmountPaise: true, netAmountPaise: true, commissionPaise: true },
          _count: { _all: true },
        })
      : await prisma.cclAttributedSale.groupBy({
          by: ['cclUserId'],
          where: { status: 'confirmed' },
          _sum: { grossAmountPaise: true, netAmountPaise: true, commissionPaise: true },
          _count: { _all: true },
        });

    const salesMap = new Map(
      salesRows.map((row) => [isCC ? row.ccUserId : row.cclUserId, row]),
    );

    const performance = partners.map((partner) => {
      const row = salesMap.get(partner.id);
      return {
        ...partner,
        totalSalesPaise: row?._sum?.grossAmountPaise || 0,
        totalNetPaise: row?._sum?.netAmountPaise || 0,
        totalCommissionPaise: row?._sum?.commissionPaise || 0,
        totalSalesCount: row?._count?._all || 0,
      };
    });

    return successResponse(res, { performance, role });
  } catch (err) {
    logger.error('[PartnerAdmin] listPartnerPerformance error', { error: err.message });
    return errorResponse(res, 'Failed to load performance data', 500);
  }
};

// ─── Consultation Authorization ─────────────────────────────────────────────

const toggleConsultationAuthorization = async (req, res) => {
  try {
    const { userId } = req.params;
    const { authorized } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== 'CAREER_COUNSELLOR') {
      return errorResponse(res, 'Counsellor not found', 404, 'NOT_FOUND');
    }

    const nextValue = authorized !== undefined ? Boolean(authorized) : !user.isConsultationAuthorized;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        isConsultationAuthorized: nextValue,
        consultationAuthorizedAt: nextValue ? new Date() : null,
      },
      select: { id: true, isConsultationAuthorized: true },
    });

    logger.info('[PartnerAdmin] Consultation authorization updated', { userId, authorized: nextValue });
    return successResponse(res, updated, 'Consultation authorization updated');
  } catch (err) {
    logger.error('[PartnerAdmin] toggleConsultationAuthorization error', { error: err.message });
    return errorResponse(res, 'Failed to update authorization', 500);
  }
};

module.exports = {
  listPartners,
  getPartner,
  approvePartner,
  rejectPartner,
  suspendPartner,
  verifyBankAccount,
  createAdjustment,
  listAdjustments,
  listPartnerPerformance,
  toggleConsultationAuthorization,
};
