'use strict';
const { errorResponse } = require('../utils/helpers');

/**
 * requireApproved — blocks partner access until admin has approved their application.
 * Must be used AFTER `authenticate` or `authorizeRoles` (requires req.user to be set).
 *
 * Returns 403 PENDING_APPROVAL if:
 *  - user.isApproved is false AND
 *  - user.role is CAREER_COUNSELLOR or CAREER_COUNSELLOR_LEAD
 *
 * ADMIN role always passes through unchanged.
 */
const PARTNER_ROLES = ['CAREER_COUNSELLOR', 'CAREER_COUNSELLOR_LEAD'];

const requireApproved = (req, res, next) => {
  if (!req.user) return errorResponse(res, 'Authentication required', 401, 'UNAUTHORIZED');

  if (PARTNER_ROLES.includes(req.user.role) && !req.user.isApproved) {
    return errorResponse(
      res,
      'Your application is pending admin approval. You will be notified once approved.',
      403,
      'PENDING_APPROVAL'
    );
  }

  next();
};

/**
 * requireAdminRole — restricts an admin route to specific AdminRole values.
 * Must be used AFTER `authenticateAdmin`.
 *
 * Usage:
 *   router.post('/dangerous', authenticateAdmin, requireAdminRole('SUPER_ADMIN'), handler)
 *   router.get('/view',       authenticateAdmin, requireAdminRole('SUPER_ADMIN', 'ADMIN'), handler)
 *
 * @param  {...string} roles  AdminRole enum values: 'SUPER_ADMIN' | 'ADMIN' | 'SUPPORT'
 */
const requireAdminRole = (...roles) => (req, res, next) => {
  if (!req.admin) return errorResponse(res, 'Admin authentication required', 401, 'UNAUTHORIZED');

  if (!roles.includes(req.admin.role)) {
    return errorResponse(res, 'Insufficient admin privileges', 403, 'FORBIDDEN');
  }

  next();
};

module.exports = { requireApproved, requireAdminRole };
