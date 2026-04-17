'use strict';
/**
 * CCL Admin Controller
 * ─────────────────────────────────────────────────────────────────
 * Admin oversight for the entire CCL business layer:
 *   - All joining links across all CCLs
 *   - All attributed sales and commissions
 *   - Payout batch generation and status management
 *   - Training content CRUD (with file upload support)
 *   - Discount policy CRUD (Phase 6)
 *
 * All routes behind authenticateAdmin + ADMIN role.
 */

const path   = require('path');
const prisma = require('../config/database');
const { successResponse, errorResponse } = require('../utils/helpers');
const logger = require('../utils/logger');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNextThursday() {
  const now = new Date();
  const day = now.getDay();
  const daysUntil = day === 4 ? 7 : (4 - day + 7) % 7;
  const next = new Date(now);
  next.setDate(now.getDate() + daysUntil);
  next.setHours(0, 0, 0, 0);
  return next;
}

// ─── CCL Joining Links (admin view) ───────────────────────────────────────────

/**
 * GET /api/v1/admin/ccl/joining-links
 * List all joining links across all CCLs, newest first, with pagination.
 */
const listAllJoiningLinks = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10)  || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip  = (page - 1) * limit;

    const where = {};
    if (req.query.cclUserId) where.cclUserId = req.query.cclUserId;
    if (req.query.isUsed !== undefined) where.isUsed = req.query.isUsed === 'true';

    const [links, total] = await Promise.all([
      prisma.cclJoiningLink.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          cclUser:       { select: { name: true, email: true } },
          attributedSale: { select: { id: true, status: true, grossAmountPaise: true, commissionPaise: true } },
        },
      }),
      prisma.cclJoiningLink.count({ where }),
    ]);

    const frontendUrl = (process.env.FRONTEND_URL || 'https://cadgurukul.com').replace(/\/$/, '');
    const enriched = links.map((l) => ({
      ...l,
      isExpired: l.expiresAt ? new Date() > new Date(l.expiresAt) : false,
      joinUrl: `${frontendUrl}/join?ref=${l.code}`,
    }));

    return successResponse(res, {
      links: enriched,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    logger.error('[Admin.CCL] listAllJoiningLinks error', { error: err.message });
    return errorResponse(res, 'Failed to load joining links', 500);
  }
};

// ─── CCL Sales (admin view) ───────────────────────────────────────────────────

/**
 * GET /api/v1/admin/ccl/sales
 * List all attributed sales with commission info, paginated.
 */
const listAllSales = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10)  || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip  = (page - 1) * limit;

    const where = {};
    if (req.query.cclUserId) where.cclUserId = req.query.cclUserId;
    if (req.query.status)    where.status    = req.query.status;

    const [sales, total] = await Promise.all([
      prisma.cclAttributedSale.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          cclUser:    { select: { name: true, email: true } },
          commission: { select: { amountPaise: true, status: true, payoutId: true } },
          joiningLink: { select: { code: true, candidateName: true, candidateEmail: true } },
        },
      }),
      prisma.cclAttributedSale.count({ where }),
    ]);

    return successResponse(res, {
      sales,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    logger.error('[Admin.CCL] listAllSales error', { error: err.message });
    return errorResponse(res, 'Failed to load sales', 500);
  }
};

// ─── CCL Commissions (admin view) ─────────────────────────────────────────────

/**
 * GET /api/v1/admin/ccl/commissions
 * List all commission records, paginated.
 */
const listAllCommissions = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10)  || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip  = (page - 1) * limit;

    const where = {};
    if (req.query.cclUserId) where.cclUserId = req.query.cclUserId;
    if (req.query.status)    where.status    = req.query.status;
    if (req.query.payoutId)  where.payoutId  = req.query.payoutId;

    const [commissions, total] = await Promise.all([
      prisma.cclCommission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          cclUser: { select: { name: true, email: true } },
          attributedSale: { select: { grossAmountPaise: true, netAmountPaise: true, paymentId: true } },
        },
      }),
      prisma.cclCommission.count({ where }),
    ]);

    return successResponse(res, {
      commissions,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    logger.error('[Admin.CCL] listAllCommissions error', { error: err.message });
    return errorResponse(res, 'Failed to load commissions', 500);
  }
};

// ─── Payout Management ────────────────────────────────────────────────────────

/**
 * GET /api/v1/admin/ccl/payouts
 * List all payout batches with commission count.
 */
const listAllPayouts = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10)  || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip  = (page - 1) * limit;

    const where = {};
    if (req.query.cclUserId) where.cclUserId = req.query.cclUserId;
    if (req.query.status)    where.status    = req.query.status;

    const [payouts, total] = await Promise.all([
      prisma.cclPayout.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          cclUser: { select: { name: true, email: true } },
          _count:  { select: { commissions: true } },
        },
      }),
      prisma.cclPayout.count({ where }),
    ]);

    return successResponse(res, {
      payouts,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    logger.error('[Admin.CCL] listAllPayouts error', { error: err.message });
    return errorResponse(res, 'Failed to load payouts', 500);
  }
};

/**
 * POST /api/v1/admin/ccl/payouts/generate
 *
 * Groups all pending CCL commissions (status="pending", payoutId=null)
 * into per-CCL payout batches scheduled for next Thursday.
 * Safe to call multiple times — commissions already in a payout are skipped.
 */
const generatePayoutBatch = async (req, res) => {
  try {
    // Find all pending commissions not yet assigned to a payout
    const pendingCommissions = await prisma.cclCommission.findMany({
      where:   { status: 'pending', payoutId: null },
      include: { cclUser: { select: { id: true, name: true } } },
    });

    if (pendingCommissions.length === 0) {
      return successResponse(res, { payoutsCreated: 0, message: 'No pending commissions to batch' });
    }

    // Group by CCL
    const grouped = {};
    for (const comm of pendingCommissions) {
      if (!grouped[comm.cclUserId]) {
        grouped[comm.cclUserId] = { userId: comm.cclUserId, name: comm.cclUser.name, commissions: [], totalPaise: 0 };
      }
      grouped[comm.cclUserId].commissions.push(comm);
      grouped[comm.cclUserId].totalPaise += comm.amountPaise;
    }

    const scheduledFor = getNextThursday();
    const payoutsCreated = [];

    await prisma.$transaction(async (tx) => {
      for (const cclData of Object.values(grouped)) {
        const payout = await tx.cclPayout.create({
          data: {
            cclUserId:   cclData.userId,
            amountPaise: cclData.totalPaise,
            status:      'pending',
            scheduledFor,
          },
        });

        // Link commissions to this payout and mark as in_payout
        await tx.cclCommission.updateMany({
          where: { id: { in: cclData.commissions.map((c) => c.id) } },
          data:  { payoutId: payout.id, status: 'in_payout' },
        });

        payoutsCreated.push({
          payoutId:   payout.id,
          cclName:    cclData.name,
          cclUserId:  cclData.userId,
          amountPaise: cclData.totalPaise,
          count:      cclData.commissions.length,
        });
      }
    });

    logger.info('[Admin.CCL] Payout batch generated', { count: payoutsCreated.length, scheduledFor });

    return successResponse(res, {
      payoutsCreated: payoutsCreated.length,
      scheduledFor,
      payouts: payoutsCreated,
    }, `Payout batch generated: ${payoutsCreated.length} CCL(s)`);
  } catch (err) {
    logger.error('[Admin.CCL] generatePayoutBatch error', { error: err.message });
    return errorResponse(res, 'Failed to generate payout batch', 500);
  }
};

/**
 * GET /api/v1/admin/ccl/payouts/:id
 * Payout detail with all linked commissions.
 */
const getPayoutDetail = async (req, res) => {
  try {
    const payout = await prisma.cclPayout.findUnique({
      where: { id: req.params.id },
      include: {
        cclUser: { select: { name: true, email: true } },
        commissions: {
          include: {
            attributedSale: {
              include: {
                joiningLink: { select: { code: true, candidateName: true, candidateEmail: true } },
              },
            },
          },
        },
      },
    });

    if (!payout) return errorResponse(res, 'Payout not found', 404, 'NOT_FOUND');
    return successResponse(res, payout);
  } catch (err) {
    logger.error('[Admin.CCL] getPayoutDetail error', { error: err.message });
    return errorResponse(res, 'Failed to load payout', 500);
  }
};

/**
 * PATCH /api/v1/admin/ccl/payouts/:id
 *
 * Update payout status: pending → processing → paid | failed.
 * When marked "paid": all linked commissions become "paid".
 * When marked "failed": linked commissions revert to "pending" (re-batchable).
 *
 * Body: { status, reference?, notes? }
 */
const updatePayoutStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reference, notes } = req.body;

    const validStatuses = ['pending', 'processing', 'paid', 'failed'];
    if (!validStatuses.includes(status)) {
      return errorResponse(res, `Invalid status. Allowed: ${validStatuses.join(', ')}`, 400, 'INVALID_STATUS');
    }

    const payout = await prisma.cclPayout.findUnique({ where: { id } });
    if (!payout) return errorResponse(res, 'Payout not found', 404, 'NOT_FOUND');

    // Guard invalid transitions — prevent financial inconsistency
    const INVALID_TRANSITIONS = {
      paid:   ['pending', 'failed'], // once paid, cannot revert
      failed: ['paid'],              // failed → paid must go through re-batching
    };
    const blocked = INVALID_TRANSITIONS[payout.status] || [];
    if (blocked.includes(status)) {
      return errorResponse(
        res,
        `Cannot transition payout from "${payout.status}" to "${status}". Current status is terminal.`,
        409,
        'INVALID_TRANSITION',
      );
    }

    const updateData = {
      status,
      ...(reference ? { reference } : {}),
      ...(notes     ? { notes }     : {}),
    };

    if (status === 'paid') {
      updateData.processedAt = new Date();
      // Mark all commissions as paid
      await prisma.cclCommission.updateMany({
        where: { payoutId: id },
        data:  { status: 'paid' },
      });
    }

    if (status === 'failed') {
      // Revert commissions so they can be re-batched in next Thursday's run
      await prisma.cclCommission.updateMany({
        where: { payoutId: id, status: 'in_payout' },
        data:  { status: 'pending', payoutId: null },
      });
    }

    const updated = await prisma.cclPayout.update({ where: { id }, data: updateData });

    logger.info('[Admin.CCL] Payout status updated', { payoutId: id, from: payout.status, to: status });

    return successResponse(res, updated);
  } catch (err) {
    logger.error('[Admin.CCL] updatePayoutStatus error', { error: err.message });
    return errorResponse(res, 'Failed to update payout status', 500);
  }
};

// ─── Training Content CRUD ────────────────────────────────────────────────────

/**
 * GET /api/v1/admin/ccl/training
 * List all training items (active and inactive) for admin management.
 */
const listAllTraining = async (req, res) => {
  try {
    const content = await prisma.cclTrainingContent.findMany({
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return successResponse(res, content);
  } catch (err) {
    logger.error('[Admin.CCL] listAllTraining error', { error: err.message });
    return errorResponse(res, 'Failed to load training content', 500);
  }
};

/**
 * POST /api/v1/admin/ccl/training
 * Create a new training content item.
 * Supports multipart/form-data (file upload) or JSON (URL-based).
 * Body: { title, type, url?, description?, isActive?, displayOrder?, isDownloadable? }
 * File: uploaded as req.file (optional — handled by multer in route)
 */
const createTrainingContent = async (req, res) => {
  try {
    const { title, type, description, isActive = true, displayOrder = 0, isDownloadable = false, targetRole = 'ALL' } = req.body;
    let { url } = req.body;

    if (!title || !type) {
      return errorResponse(res, 'title and type are required', 400, 'MISSING_FIELDS');
    }
    const validTypes = ['video', 'book', 'document'];
    if (!validTypes.includes(type)) {
      return errorResponse(res, `type must be one of: ${validTypes.join(', ')}`, 400, 'INVALID_TYPE');
    }
    const validRoles = ['CCL', 'CC', 'ALL'];
    const resolvedRole = validRoles.includes(targetRole) ? targetRole : 'ALL';

    let originalFilename = null;
    let storagePath      = null;
    let mimeType         = null;

    if (req.file) {
      const relativePath  = `/uploads/training/${req.file.filename}`;
      url                 = relativePath;
      originalFilename    = req.file.originalname;
      storagePath         = req.file.path;
      mimeType            = req.file.mimetype || null;
    }

    const item = await prisma.cclTrainingContent.create({
      data: {
        title,
        type,
        targetRole:       resolvedRole,
        url:              url || null,
        description:      description || null,
        isActive:         isActive === 'true' || isActive === true,
        displayOrder:     Number(displayOrder) || 0,
        isDownloadable:   isDownloadable === 'true' || isDownloadable === true,
        originalFilename,
        storagePath,
        mimeType,
      },
    });

    logger.info('[Admin.CCL] Training content created', { id: item.id, title, targetRole: resolvedRole });
    return successResponse(res, item, 'Training content created', 201);
  } catch (err) {
    logger.error('[Admin.CCL] createTrainingContent error', { error: err.message });
    return errorResponse(res, 'Failed to create training content', 500);
  }
};

/**
 * PATCH /api/v1/admin/ccl/training/:id
 * Update a training content item. All fields optional.
 */
const updateTrainingContent = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, type, url, description, isActive, displayOrder, isDownloadable } = req.body;

    const existing = await prisma.cclTrainingContent.findUnique({ where: { id } });
    if (!existing) return errorResponse(res, 'Training content not found', 404, 'NOT_FOUND');

    if (type) {
      const validTypes = ['video', 'book', 'document'];
      if (!validTypes.includes(type)) {
        return errorResponse(res, `type must be one of: ${validTypes.join(', ')}`, 400, 'INVALID_TYPE');
      }
    }

    const updateData = {};
    if (title          !== undefined) updateData.title          = title;
    if (type           !== undefined) updateData.type           = type;
    if (url            !== undefined) updateData.url            = url || null;
    if (description    !== undefined) updateData.description    = description || null;
    if (isActive       !== undefined) updateData.isActive       = Boolean(isActive);
    if (displayOrder   !== undefined) updateData.displayOrder   = Number(displayOrder);
    if (isDownloadable !== undefined) updateData.isDownloadable = Boolean(isDownloadable);

    const updated = await prisma.cclTrainingContent.update({ where: { id }, data: updateData });
    return successResponse(res, updated);
  } catch (err) {
    logger.error('[Admin.CCL] updateTrainingContent error', { error: err.message });
    return errorResponse(res, 'Failed to update training content', 500);
  }
};

/**
 * DELETE /api/v1/admin/ccl/training/:id
 * Soft-delete: sets isActive=false. CCLs stop seeing it immediately.
 */
const deleteTrainingContent = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.cclTrainingContent.findUnique({ where: { id } });
    if (!existing) return errorResponse(res, 'Training content not found', 404, 'NOT_FOUND');

    await prisma.cclTrainingContent.update({ where: { id }, data: { isActive: false } });
    logger.info('[Admin.CCL] Training content deactivated', { id });
    return successResponse(res, null, 'Training content deactivated');
  } catch (err) {
    logger.error('[Admin.CCL] deleteTrainingContent error', { error: err.message });
    return errorResponse(res, 'Failed to deactivate training content', 500);
  }
};

// ─── Discount Policies (Phase 6) ──────────────────────────────────────────────

/**
 * GET /api/v1/admin/discount-policies
 * List all discount policy records.
 */
const listPolicies = async (req, res) => {
  try {
    const policies = await prisma.discountPolicy.findMany({
      orderBy: [{ role: 'asc' }, { planType: 'asc' }],
    });
    return successResponse(res, policies);
  } catch (err) {
    logger.error('[Admin] listPolicies error', { error: err.message });
    return errorResponse(res, 'Failed to load discount policies', 500);
  }
};

/**
 * PUT /api/v1/admin/discount-policies
 * Upsert a discount policy for a given role+planType.
 * Body: { role, planType, minPct, maxPct, isActive }
 */
const upsertPolicy = async (req, res) => {
  try {
    const { role, planType, minPct = 0, maxPct = 20, isActive = true } = req.body;

    if (!role || !planType) {
      return errorResponse(res, 'role and planType are required', 400, 'MISSING_FIELDS');
    }
    const validRoles = ['CAREER_COUNSELLOR_LEAD', 'CAREER_COUNSELLOR'];
    if (!validRoles.includes(role)) {
      return errorResponse(res, `role must be one of: ${validRoles.join(', ')}`, 400, 'INVALID_ROLE');
    }
    if (Number(minPct) < 0 || Number(maxPct) > 100 || Number(minPct) > Number(maxPct)) {
      return errorResponse(res, 'minPct must be ≥0, maxPct must be ≤100, and minPct must be ≤maxPct', 400, 'INVALID_RANGE');
    }

    const policy = await prisma.discountPolicy.upsert({
      where:  { role_planType: { role, planType } },
      update: { minPct: Number(minPct), maxPct: Number(maxPct), isActive: Boolean(isActive) },
      create: { role, planType, minPct: Number(minPct), maxPct: Number(maxPct), isActive: Boolean(isActive) },
    });

    logger.info('[Admin] DiscountPolicy upserted', { role, planType, minPct, maxPct, isActive });
    return successResponse(res, policy, 'Discount policy saved');
  } catch (err) {
    logger.error('[Admin] upsertPolicy error', { error: err.message });
    return errorResponse(res, 'Failed to save discount policy', 500);
  }
};

module.exports = {
  // Joining links
  listAllJoiningLinks,
  // Sales
  listAllSales,
  // Commissions
  listAllCommissions,
  // Payouts
  listAllPayouts,
  generatePayoutBatch,
  getPayoutDetail,
  updatePayoutStatus,
  // Training
  listAllTraining,
  createTrainingContent,
  updateTrainingContent,
  deleteTrainingContent,
  // Discount policies (Phase 6)
  listPolicies,
  upsertPolicy,
};
