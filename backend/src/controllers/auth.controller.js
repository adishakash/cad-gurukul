'use strict';
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../config/database');
const config = require('../config');
const { successResponse, errorResponse } = require('../utils/helpers');
const logger = require('../utils/logger');

// ─── Token Helpers ────────────────────────────────────────────────────────────

const signAccessToken = (userId, role) =>
  jwt.sign({ userId, role }, config.jwt.secret, { expiresIn: config.jwt.accessExpiresIn });

const signRefreshToken = () => uuidv4();

const saveRefreshToken = async (userId, token) => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days
  await prisma.refreshToken.create({ data: { userId, token, expiresAt } });
};

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
        studentProfile: role !== 'PARENT' ? { create: { fullName } } : undefined,
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

    if (!user) {
      return errorResponse(res, 'Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    if (!user.isActive) {
      return errorResponse(res, 'Account has been deactivated', 401, 'ACCOUNT_DISABLED');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return errorResponse(res, 'Invalid email or password', 401, 'INVALID_CREDENTIALS');
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

module.exports = { register, login, refresh, logout, adminLogin };
