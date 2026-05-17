'use strict';
/**
 * CC Admin Controller
 * ─────────────────────────────────────────────────────────────────
 * Admin oversight for the entire CC business layer:
 *   - All attributed sales and commissions
 *   - Payout batch generation and status management
 *   - Training content CRUD (shared CclTrainingContent table with targetRole, file upload support)
 *
 * All routes behind authenticateAdmin + ADMIN role.
 */

const prisma = require('../config/database');
const { successResponse, errorResponse } = require('../utils/helpers');
const logger = require('../utils/logger');
const {
  isSpacesEnabled,
  uploadTrainingFileFromDisk,
  toSpacesStoragePath,
  deleteLocalFileQuietly,
} = require('../utils/spaces');

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

// ─── CC Sales (admin view) ────────────────────────────────────────────────────

/**
 * GET /api/v1/admin/cc/sales
 * List all attributed sales with commission info, paginated.
 */
const listAllSales = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10)  || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip  = (page - 1) * limit;

    const where = {};
    if (req.query.ccUserId) where.ccUserId = req.query.ccUserId;
    if (req.query.status)   where.status   = req.query.status;

    const [sales, total] = await Promise.all([
      prisma.ccAttributedSale.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          ccUser:    { select: { name: true, email: true } },
          commission: { select: { amountPaise: true, status: true, payoutId: true } },
        },
      }),
      prisma.ccAttributedSale.count({ where }),
    ]);

    return successResponse(res, {
      sales,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    logger.error('[Admin.CC] listAllSales error', { error: err.message });
    return errorResponse(res, 'Failed to load sales', 500);
  }
};

// ─── CC Commissions (admin view) ──────────────────────────────────────────────

/**
 * GET /api/v1/admin/cc/commissions
 * List all commission records, paginated.
 */
const listAllCommissions = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10)  || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip  = (page - 1) * limit;

    const where = {};
    if (req.query.ccUserId)  where.ccUserId  = req.query.ccUserId;
    if (req.query.status)    where.status    = req.query.status;
    if (req.query.payoutId)  where.payoutId  = req.query.payoutId;

    const [commissions, total] = await Promise.all([
      prisma.ccCommission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          ccUser: { select: { name: true, email: true } },
          attributedSale: { select: { grossAmountPaise: true, netAmountPaise: true, paymentId: true } },
        },
      }),
      prisma.ccCommission.count({ where }),
    ]);

    return successResponse(res, {
      commissions,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    logger.error('[Admin.CC] listAllCommissions error', { error: err.message });
    return errorResponse(res, 'Failed to load commissions', 500);
  }
};

// ─── Payout Management ────────────────────────────────────────────────────────

/**
 * GET /api/v1/admin/cc/payouts
 * List all payout batches with commission count.
 */
const listAllPayouts = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10)  || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip  = (page - 1) * limit;

    const where = {};
    if (req.query.ccUserId) where.ccUserId = req.query.ccUserId;
    if (req.query.status)   where.status   = req.query.status;

    const [payouts, total] = await Promise.all([
      prisma.ccPayout.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          ccUser: { select: { name: true, email: true } },
          _count:  { select: { commissions: true } },
        },
      }),
      prisma.ccPayout.count({ where }),
    ]);

    return successResponse(res, {
      payouts,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    logger.error('[Admin.CC] listAllPayouts error', { error: err.message });
    return errorResponse(res, 'Failed to load payouts', 500);
  }
};

/**
 * POST /api/v1/admin/cc/payouts/generate
 *
 * Groups all pending CC commissions (status="pending", payoutId=null)
 * into per-CC payout batches scheduled for next Thursday.
 * Safe to call multiple times — commissions already in a payout are skipped.
 * 
 * SKIPS CCs with ccPaymentsPaused=true (manual payouts only for those).
 */
const generatePayoutBatch = async (req, res) => {
  try {
    const pendingCommissions = await prisma.ccCommission.findMany({
      where:   { status: 'pending', payoutId: null },
      include: { ccUser: { select: { id: true, name: true, ccPaymentsPaused: true } } },
    });

    if (pendingCommissions.length === 0) {
      return successResponse(res, { payoutsCreated: 0, message: 'No pending commissions to batch' });
    }

    // Group by CC, excluding paused ones
    const grouped = {};
    const skippedCCs = [];
    for (const comm of pendingCommissions) {
      // Skip paused CCs — they require manual payout processing
      if (comm.ccUser.ccPaymentsPaused) {
        if (!skippedCCs.includes(comm.ccUserId)) {
          skippedCCs.push(comm.ccUserId);
        }
        continue;
      }

      if (!grouped[comm.ccUserId]) {
        grouped[comm.ccUserId] = { userId: comm.ccUserId, name: comm.ccUser.name, commissions: [], totalPaise: 0 };
      }
      grouped[comm.ccUserId].commissions.push(comm);
      grouped[comm.ccUserId].totalPaise += comm.amountPaise;
    }

    if (Object.keys(grouped).length === 0) {
      return successResponse(res, {
        payoutsCreated: 0,
        skippedCCs: skippedCCs.length,
        message: `No commissions to batch. ${skippedCCs.length} CC(s) have paused automatic payments.`,
      });
    }

    const scheduledFor = getNextThursday();
    const payoutsCreated = [];

    await prisma.$transaction(async (tx) => {
      for (const ccData of Object.values(grouped)) {
        const payout = await tx.ccPayout.create({
          data: {
            ccUserId:    ccData.userId,
            amountPaise: ccData.totalPaise,
            status:      'pending',
            scheduledFor,
          },
        });

        // Link commissions to this payout and mark as in_payout
        await tx.ccCommission.updateMany({
          where: { id: { in: ccData.commissions.map((c) => c.id) } },
          data:  { payoutId: payout.id, status: 'in_payout' },
        });

        payoutsCreated.push({
          payoutId:    payout.id,
          ccName:      ccData.name,
          ccUserId:    ccData.userId,
          amountPaise: ccData.totalPaise,
          count:       ccData.commissions.length,
        });
      }
    });

    logger.info('[Admin.CC] Payout batch generated', { count: payoutsCreated.length, skipped: skippedCCs.length, scheduledFor });

    return successResponse(res, {
      payoutsCreated: payoutsCreated.length,
      skippedCCs: skippedCCs.length,
      scheduledFor,
      payouts: payoutsCreated,
    }, `Payout batch generated: ${payoutsCreated.length} CC(s). ${skippedCCs.length} CC(s) paused.`);
  } catch (err) {
    logger.error('[Admin.CC] generatePayoutBatch error', { error: err.message });
    return errorResponse(res, 'Failed to generate payout batch', 500);
  }
};

/**
 * GET /api/v1/admin/cc/payouts/:id
 * Payout detail with all linked commissions.
 */
const getPayoutDetail = async (req, res) => {
  try {
    const payout = await prisma.ccPayout.findUnique({
      where: { id: req.params.id },
      include: {
        ccUser: { select: { name: true, email: true } },
        commissions: {
          include: {
            attributedSale: true,
          },
        },
      },
    });

    if (!payout) return errorResponse(res, 'Payout not found', 404, 'NOT_FOUND');
    return successResponse(res, payout);
  } catch (err) {
    logger.error('[Admin.CC] getPayoutDetail error', { error: err.message });
    return errorResponse(res, 'Failed to load payout', 500);
  }
};

/**
 * PATCH /api/v1/admin/cc/payouts/:id
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

    const payout = await prisma.ccPayout.findUnique({ where: { id } });
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
      await prisma.ccCommission.updateMany({
        where: { payoutId: id },
        data:  { status: 'paid' },
      });
    }

    if (status === 'failed') {
      // Revert commissions so they can be re-batched in next Thursday's run
      await prisma.ccCommission.updateMany({
        where: { payoutId: id, status: 'in_payout' },
        data:  { status: 'pending', payoutId: null },
      });
    }

    const updated = await prisma.ccPayout.update({ where: { id }, data: updateData });

    logger.info('[Admin.CC] Payout status updated', { payoutId: id, from: payout.status, to: status });

    return successResponse(res, updated);
  } catch (err) {
    logger.error('[Admin.CC] updatePayoutStatus error', { error: err.message });
    return errorResponse(res, 'Failed to update payout status', 500);
  }
};

// ─── Training Content CRUD (shared CclTrainingContent table) ─────────────────

/**
 * GET /api/v1/admin/cc/training
 * List all training items (active and inactive) — shows all targetRole values.
 */
const listAllTraining = async (req, res) => {
  try {
    const content = await prisma.cclTrainingContent.findMany({
      where: { deletedAt: null },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return successResponse(res, content);
  } catch (err) {
    logger.error('[Admin.CC] listAllTraining error', { error: err.message });
    return errorResponse(res, 'Failed to load training content', 500);
  }
};

/**
 * POST /api/v1/admin/cc/training
 * Create a new training content item targeted at CC.
 * Supports multipart/form-data (file upload) or JSON (URL-based).
 * Body: { title, type, url?, description?, isActive?, displayOrder?, targetRole?, isDownloadable? }
 */
const createTrainingContent = async (req, res) => {
  try {
    const { title, type, description, isActive = true, displayOrder = 0, targetRole = 'CC', isDownloadable = false } = req.body;
    let { url } = req.body;

    if (!title || !type) {
      return errorResponse(res, 'title and type are required', 400, 'MISSING_FIELDS');
    }
    const validTypes = ['video', 'book', 'document'];
    if (!validTypes.includes(type)) {
      return errorResponse(res, `type must be one of: ${validTypes.join(', ')}`, 400, 'INVALID_TYPE');
    }
    const validRoles = ['CCL', 'CC', 'ALL'];
    if (!validRoles.includes(targetRole)) {
      return errorResponse(res, `targetRole must be one of: ${validRoles.join(', ')}`, 400, 'INVALID_TARGET_ROLE');
    }

    let originalFilename = null;
    let storagePath      = null;
    let mimeType         = null;

    if (req.file) {
      const relativePath = `/uploads/training/${req.file.filename}`;
      url                = relativePath;
      originalFilename   = req.file.originalname;
      storagePath        = req.file.path;
      mimeType           = req.file.mimetype || null;

      if (isSpacesEnabled()) {
        try {
          const key = await uploadTrainingFileFromDisk({
            localPath: req.file.path,
            filename: req.file.filename,
            contentType: mimeType,
          });
          storagePath = toSpacesStoragePath(key);
          url = null;
          await deleteLocalFileQuietly(req.file.path);
        } catch (err) {
          await deleteLocalFileQuietly(req.file.path);
          logger.error('[Admin.CC] uploadTrainingFileToSpaces error', { error: err.message });
          return errorResponse(res, 'Failed to upload training file', 500);
        }
      }
    }

    const item = await prisma.cclTrainingContent.create({
      data: {
        title,
        type,
        url:              url || null,
        description:      description || null,
        isActive:         isActive === 'true' || isActive === true,
        displayOrder:     Number(displayOrder) || 0,
        targetRole,
        isDownloadable:   isDownloadable === 'true' || isDownloadable === true,
        originalFilename,
        storagePath,
        mimeType,
      },
    });

    logger.info('[Admin.CC] Training content created', { id: item.id, title, targetRole });
    return successResponse(res, item, 'Training content created', 201);
  } catch (err) {
    logger.error('[Admin.CC] createTrainingContent error', { error: err.message });
    return errorResponse(res, 'Failed to create training content', 500);
  }
};

/**
 * PATCH /api/v1/admin/cc/training/:id
 * Update a training content item. All fields optional.
 */
const updateTrainingContent = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, type, url, description, isActive, displayOrder, targetRole, isDownloadable } = req.body;

    const existing = await prisma.cclTrainingContent.findUnique({ where: { id } });
    if (!existing) return errorResponse(res, 'Training content not found', 404, 'NOT_FOUND');

    if (type) {
      const validTypes = ['video', 'book', 'document'];
      if (!validTypes.includes(type)) {
        return errorResponse(res, `type must be one of: ${validTypes.join(', ')}`, 400, 'INVALID_TYPE');
      }
    }
    if (targetRole) {
      const validRoles = ['CCL', 'CC', 'ALL'];
      if (!validRoles.includes(targetRole)) {
        return errorResponse(res, `targetRole must be one of: ${validRoles.join(', ')}`, 400, 'INVALID_TARGET_ROLE');
      }
    }

    const updateData = {};
    if (title          !== undefined) updateData.title          = title;
    if (type           !== undefined) updateData.type           = type;
    if (url            !== undefined) updateData.url            = url || null;
    if (description    !== undefined) updateData.description    = description || null;
    if (isActive       !== undefined) updateData.isActive       = Boolean(isActive);
    if (displayOrder   !== undefined) updateData.displayOrder   = Number(displayOrder);
    if (targetRole     !== undefined) updateData.targetRole     = targetRole;
    if (isDownloadable !== undefined) updateData.isDownloadable = Boolean(isDownloadable);

    const updated = await prisma.cclTrainingContent.update({ where: { id }, data: updateData });
    return successResponse(res, updated);
  } catch (err) {
    logger.error('[Admin.CC] updateTrainingContent error', { error: err.message });
    return errorResponse(res, 'Failed to update training content', 500);
  }
};

/**
 * DELETE /api/v1/admin/cc/training/:id
 * Soft-delete: records deletedAt + deletedBy for audit history, sets isActive=false.
 */
const deleteTrainingContent = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.cclTrainingContent.findUnique({ where: { id } });
    if (!existing) return errorResponse(res, 'Training content not found', 404, 'NOT_FOUND');
    if (existing.deletedAt) return errorResponse(res, 'Training content is already deleted', 409, 'ALREADY_DELETED');

    await prisma.cclTrainingContent.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date(), deletedBy: req.user?.id || null },
    });
    logger.info('[Admin.CC] Training content soft-deleted', { id, adminId: req.user?.id });
    return successResponse(res, null, 'Training content deleted and preserved in history');
  } catch (err) {
    logger.error('[Admin.CC] deleteTrainingContent error', { error: err.message });
    return errorResponse(res, 'Failed to delete training content', 500);
  }
};

/**
 * GET /api/v1/admin/cc/training/history
 * List all soft-deleted training items for audit / history view.
 */
const listTrainingHistory = async (req, res) => {
  try {
    const content = await prisma.cclTrainingContent.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
    });
    return successResponse(res, content);
  } catch (err) {
    logger.error('[Admin.CC] listTrainingHistory error', { error: err.message });
    return errorResponse(res, 'Failed to load training history', 500);
  }
};

// ─── Payment Control (SUPER_ADMIN only) ───────────────────────────────────────

/**
 * PUT /api/v1/admin/cc/users/:id/pause-payments
 * 
 * Toggle automatic payment pause for a CC.
 * When paused, generatePayoutBatch skips this CC — admin must manually add payouts.
 * 
 * Body: { paused: boolean, reason?: string }
 * Only SUPER_ADMIN can use this endpoint.
 */
const toggleCCPaymentsPause = async (req, res) => {
  try {
    const { paused, reason } = req.body;

    if (typeof paused !== 'boolean') {
      return errorResponse(res, 'paused must be a boolean', 400, 'VALIDATION_ERROR');
    }

    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, email: true, role: true, ccPaymentsPaused: true },
    });

    if (!user) {
      return errorResponse(res, 'CC user not found', 404, 'NOT_FOUND');
    }

    if (user.role !== 'CAREER_COUNSELLOR') {
      return errorResponse(res, 'User is not a Career Counsellor', 422, 'INVALID_TARGET');
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ccPaymentsPaused: paused,
        paymentsPausedAt: paused ? new Date() : null,
        pausedBy: paused ? req.user.id : null,
      },
      select: { id: true, name: true, email: true, ccPaymentsPaused: true, paymentsPausedAt: true },
    });

    logger.info('[Admin.CC] CC payment pause toggled', {
      ccUserId: req.params.id,
      paused,
      reason: reason || '',
      adminId: req.user.id,
    });

    const msg = paused
      ? `Automatic payments paused for ${user.name}. Use manual payout endpoint.`
      : `Automatic payments resumed for ${user.name}. Will be included in next batch.`;

    return successResponse(res, updated, msg);
  } catch (err) {
    logger.error('[Admin.CC] toggleCCPaymentsPause error', { error: err.message });
    return errorResponse(res, 'Failed to toggle payment pause', 500);
  }
};

/**
 * POST /api/v1/admin/cc/payouts/manual-add
 * 
 * Manually create a payout for a CC (especially for paused CCs).
 * Super admin can directly add any amount without waiting for commissions to accumulate.
 * 
 * Body: {
 *   ccUserId: string,
 *   amountPaise: number,
 *   reason?: string,
 *   scheduledFor?: ISO date string (defaults to next Thursday)
 * }
 * 
 * Only SUPER_ADMIN can use this endpoint.
 */
const manuallyAddCCPayout = async (req, res) => {
  try {
    const { ccUserId, amountPaise, reason, scheduledFor } = req.body;

    // Validation
    if (!ccUserId || typeof ccUserId !== 'string') {
      return errorResponse(res, 'ccUserId is required and must be a string', 400, 'VALIDATION_ERROR');
    }

    if (!amountPaise || typeof amountPaise !== 'number' || amountPaise <= 0) {
      return errorResponse(res, 'amountPaise must be a positive number', 400, 'VALIDATION_ERROR');
    }

    // Verify CC user exists
    const ccUser = await prisma.user.findUnique({
      where: { id: ccUserId },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!ccUser) {
      return errorResponse(res, 'CC user not found', 404, 'NOT_FOUND');
    }

    if (ccUser.role !== 'CAREER_COUNSELLOR') {
      return errorResponse(res, 'User is not a Career Counsellor', 422, 'INVALID_TARGET');
    }

    // Determine scheduled date
    let payout_scheduledFor = scheduledFor ? new Date(scheduledFor) : getNextThursday();
    payout_scheduledFor.setHours(0, 0, 0, 0);

    // Create the payout directly
    const payout = await prisma.ccPayout.create({
      data: {
        ccUserId,
        amountPaise,
        status: 'pending',
        scheduledFor: payout_scheduledFor,
        notes: reason ? `Manual payout: ${reason}` : 'Manual payout by admin',
      },
      include: {
        ccUser: { select: { name: true, email: true } },
      },
    });

    logger.info('[Admin.CC] Manual payout created', {
      payoutId: payout.id,
      ccUserId,
      amountPaise,
      reason: reason || '',
      adminId: req.user.id,
    });

    return successResponse(res, {
      payoutId: payout.id,
      ccName: payout.ccUser.name,
      ccUserId: payout.ccUserId,
      amountPaise: payout.amountPaise,
      status: payout.status,
      scheduledFor: payout.scheduledFor,
    }, `Manual payout created for ${ccUser.name}: ₹${(amountPaise / 100).toFixed(2)}`);
  } catch (err) {
    logger.error('[Admin.CC] manuallyAddCCPayout error', { error: err.message });
    return errorResponse(res, 'Failed to create manual payout', 500);
  }
};

module.exports = {
  // Sales
  listAllSales,
  // Commissions
  listAllCommissions,
  // Payouts
  listAllPayouts,
  generatePayoutBatch,
  getPayoutDetail,
  updatePayoutStatus,
  manuallyAddCCPayout,
  // Payment control
  toggleCCPaymentsPause,
  // Training
  listAllTraining,
  createTrainingContent,
  updateTrainingContent,
  deleteTrainingContent,
  listTrainingHistory,
};
