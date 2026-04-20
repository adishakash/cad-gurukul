'use strict';
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const config = require('../config');
const { successResponse, errorResponse } = require('../utils/helpers');
const { signAccessToken, signRefreshToken, saveRefreshToken } = require('../utils/token');
const logger = require('../utils/logger');

/**
 * Roles that belong to the user portal.
 * Only these roles may log in via POST /auth/login.
 */
const USER_PORTAL_ROLES = new Set(['STUDENT', 'PARENT']);

/**
 * Structurally valid bcrypt hash used as a timing-safe dummy target
 * when no real user is found (prevents timing-based user enumeration).
 */
const DUMMY_HASH = '$2a$12$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const buildInitialStudentProfile = (fullName) => ({
  fullName,
  preferredSubjects: [],
  hobbies: [],
  interests: [],
  locationPreference: [],
});

// ─── Controllers ─────────────────────────────────────────────────────────────

const register = async (req, res) => {
  try {
    const { email, password, fullName, role } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return errorResponse(res, 'An account with this email already exists', 409, 'CONFLICT');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: role || 'STUDENT',
        studentProfile: role !== 'PARENT' ? { create: buildInitialStudentProfile(fullName) } : undefined,
      },
      select: { id: true, email: true, role: true, createdAt: true },
    });

    const accessToken = signAccessToken(user.id, user.role);
    const refreshToken = signRefreshToken();
    await saveRefreshToken(user.id, refreshToken);

    logger.info('[Auth] User registered', { userId: user.id, email: user.email });

    return successResponse(
      res,
      { user, accessToken, refreshToken },
      'Account created successfully',
      201
    );
  } catch (err) {
    logger.error('[Auth] register error', { error: err.message });
    throw err;
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, passwordHash: true, role: true, isActive: true },
    });

    // Determine the hash to compare against.
    // We always run bcrypt — prevents timing-based user enumeration.
    const hashToCompare = (user && user.isActive) ? user.passwordHash : DUMMY_HASH;
    const isPasswordValid = await bcrypt.compare(password, hashToCompare);

    // Generic check for: not found | inactive | wrong password.
    if (!user || !user.isActive || !isPasswordValid) {
      return errorResponse(res, 'Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    // Portal membership check — only STUDENT / PARENT may use this endpoint.
    // Staff (CCL, CC) must use /staff/login. Admins must use /admin/login.
    if (!USER_PORTAL_ROLES.has(user.role)) {
      return errorResponse(
        res,
        'This account does not have access to the student portal. ' +
          'If you are a staff member, please use the Staff Portal. ' +
          'If you are an administrator, please use the Admin Panel.',
        403,
        'WRONG_PORTAL'
      );
    }

    const accessToken = signAccessToken(user.id, user.role);
    const refreshToken = signRefreshToken();
    await saveRefreshToken(user.id, refreshToken);

    logger.info('[Auth] User logged in', { userId: user.id });

    return successResponse(res, {
      user: { id: user.id, email: user.email, role: user.role },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    logger.error('[Auth] login error', { error: err.message });
    throw err;
  }
};

const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    const stored = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: { select: { id: true, role: true, isActive: true } } },
    });

    if (!stored || stored.expiresAt < new Date()) {
      return errorResponse(res, 'Invalid or expired refresh token', 401, 'INVALID_TOKEN');
    }

    if (!stored.user.isActive) {
      return errorResponse(res, 'Account deactivated', 401, 'ACCOUNT_DISABLED');
    }

    // Rotate refresh token
    await prisma.refreshToken.delete({ where: { id: stored.id } });
    const newRefreshToken = signRefreshToken();
    await saveRefreshToken(stored.user.id, newRefreshToken);

    const accessToken = signAccessToken(stored.user.id, stored.user.role);

    return successResponse(res, { accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    logger.error('[Auth] refresh error', { error: err.message });
    throw err;
  }
};

const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    }
    return successResponse(res, null, 'Logged out successfully');
  } catch (err) {
    logger.error('[Auth] logout error', { error: err.message });
    throw err;
  }
};

/**
 * DELETE /api/v1/auth/account
 * Soft-deletes the authenticated user's account.
 * Requires the current password as confirmation.
 * Steps:
 *  1. Validate password
 *  2. Set isActive=false, deletedAt=now(), anonymise email
 *  3. Revoke all refresh tokens
 *  4. Return 200
 */
const deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password || typeof password !== 'string') {
      return errorResponse(res, 'Password confirmation is required', 400, 'VALIDATION_ERROR');
    }

    // Load full user record including passwordHash
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, passwordHash: true, isActive: true, deletedAt: true },
    });

    if (!user || user.deletedAt) {
      return errorResponse(res, 'Account not found', 404, 'NOT_FOUND');
    }

    if (!user.isActive) {
      return errorResponse(res, 'Account is already deactivated', 400, 'ALREADY_INACTIVE');
    }

    // Verify password before deletion — never skip this check
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return errorResponse(res, 'Incorrect password. Account was not deleted.', 401, 'INVALID_CREDENTIALS');
    }

    // Anonymise email so the address can be reused on a new account
    const anonymisedEmail = `deleted_${user.id}@deleted.cadgurukul.internal`;

    // Soft delete: set isActive=false, deletedAt=now(), anonymise email
    await prisma.user.update({
      where: { id: user.id },
      data: {
        isActive:  false,
        deletedAt: new Date(),
        email:     anonymisedEmail,
      },
    });

    // Revoke all refresh tokens — forces immediate session termination
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });

    logger.info('[Auth] Account deleted (soft)', { userId: user.id, originalEmail: user.email });

    return successResponse(res, null, 'Your account has been deleted. We\'re sorry to see you go.');
  } catch (err) {
    logger.error('[Auth] deleteAccount error', { error: err.message });
    throw err;
  }
};

// Admin login
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await prisma.adminUser.findUnique({
      where: { email },
      select: { id: true, email: true, passwordHash: true, role: true, isActive: true, fullName: true },
    });

    if (!admin || !admin.isActive) {
      return errorResponse(res, 'Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    const isValid = await bcrypt.compare(password, admin.passwordHash);
    if (!isValid) {
      return errorResponse(res, 'Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    const accessToken = jwt.sign(
      { adminId: admin.id, role: admin.role, type: 'admin' },
      config.jwt.secret,
      { expiresIn: '8h' }
    );

    await prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });

    logger.info('[Auth] Admin logged in', { adminId: admin.id });

    return successResponse(res, {
      admin: { id: admin.id, email: admin.email, role: admin.role, fullName: admin.fullName },
      accessToken,
    });
  } catch (err) {
    logger.error('[Auth] adminLogin error', { error: err.message });
    throw err;
  }
};

module.exports = { register, login, refresh, logout, deleteAccount, adminLogin };
