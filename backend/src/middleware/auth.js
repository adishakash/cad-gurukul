'use strict';
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const config = require('../config');
const { getRoleLevel } = require('../config/roles');
const { errorResponse } = require('../utils/helpers');
const logger = require('../utils/logger');

/**
 * Authenticate student/user JWT access token
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'Authentication required', 401, 'UNAUTHORIZED');
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return errorResponse(res, 'Token expired', 401, 'TOKEN_EXPIRED');
      }
      return errorResponse(res, 'Invalid token', 401, 'INVALID_TOKEN');
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return errorResponse(res, 'Account not found or deactivated', 401, 'UNAUTHORIZED');
    }

    req.user = user;
    next();
  } catch (err) {
    logger.error('[Auth] authenticate error', { error: err.message });
    return errorResponse(res, 'Authentication failed', 500);
  }
};

/**
 * Authenticate admin JWT access token
 */
const authenticateAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'Admin authentication required', 401, 'UNAUTHORIZED');
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch {
      return errorResponse(res, 'Invalid or expired admin token', 401, 'INVALID_TOKEN');
    }

    if (decoded.type !== 'admin') {
      return errorResponse(res, 'Admin access required', 403, 'FORBIDDEN');
    }

    const admin = await prisma.adminUser.findUnique({
      where: { id: decoded.adminId },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!admin || !admin.isActive) {
      return errorResponse(res, 'Admin account not found', 401, 'UNAUTHORIZED');
    }

    req.admin = admin;
    next();
  } catch (err) {
    logger.error('[Auth] authenticateAdmin error', { error: err.message });

    return errorResponse(res, 'Admin authentication failed', 500);
  }
};

/**
 * Optional authenticate — sets req.user if a valid bearer token is present,
 * sets req.user = null (and continues) if the token is missing or invalid.
 * Never sends a 401. Use this for public endpoints that benefit from auth context.
 */
const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch {
      req.user = null;
      return next();
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true, isActive: true },
    });

    req.user = (user && user.isActive) ? user : null;
    next();
  } catch (err) {
    logger.error('[Auth] optionalAuthenticate error', { error: err.message });
    req.user = null;
    next();
  }
};

/**
 * Require a specific user role
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return errorResponse(res, 'Insufficient permissions', 403, 'FORBIDDEN');
  }
  next();
};

/**
 * Require super admin role
 */
const requireSuperAdmin = (req, res, next) => {
  if (!req.admin || req.admin.role !== 'SUPER_ADMIN') {
    return errorResponse(res, 'Super admin access required', 403, 'FORBIDDEN');
  }
  next();
};

/**
 * Hierarchy-aware role authorization middleware.
 *
 * Usage:
 *   authorizeRoles('ADMIN')                  → only ADMIN
 *   authorizeRoles('CAREER_COUNSELLOR_LEAD') → CCL and ADMIN
 *   authorizeRoles('CAREER_COUNSELLOR')       → CC, CCL, and ADMIN
 *
 * Rule: user passes if their role level is >= the MINIMUM level
 * among the specified allowedRoles.  Higher-level roles auto-pass lower routes.
 * Must be used AFTER `authenticate` (requires req.user to be set).
 */
const authorizeRoles = (...allowedRoles) => {
  if (!allowedRoles.length) {
    throw new Error('authorizeRoles() requires at least one role argument');
  }

  // Validate at definition time — catch typos before any request is made.
  const { ROLE_HIERARCHY } = require('../config/roles');
  for (const role of allowedRoles) {
    if (!(role in ROLE_HIERARCHY)) {
      throw new Error(`authorizeRoles(): unknown role "${role}". Valid roles: ${Object.keys(ROLE_HIERARCHY).join(', ')}`);
    }
  }

  const minRequiredLevel = Math.min(...allowedRoles.map(getRoleLevel));

  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 'Authentication required', 401, 'UNAUTHORIZED');
    }

    const userLevel = getRoleLevel(req.user.role);
    if (userLevel < minRequiredLevel) {
      return errorResponse(res, 'You do not have permission to access this resource', 403, 'FORBIDDEN');
    }

    next();
  };
};

module.exports = { authenticate, authenticateAdmin, optionalAuthenticate, requireRole, requireSuperAdmin, authorizeRoles };
