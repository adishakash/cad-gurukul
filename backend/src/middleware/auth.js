'use strict';
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const config = require('../config');
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

module.exports = { authenticate, authenticateAdmin, requireRole, requireSuperAdmin };
