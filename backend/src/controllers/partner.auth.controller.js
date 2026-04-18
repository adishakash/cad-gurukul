'use strict';
/**
 * Partner Auth Controller
 * Handles self-serve registration and login for CAREER_COUNSELLOR and CAREER_COUNSELLOR_LEAD.
 *
 * Registration creates the user + PartnerApplication (status=pending).
 * Login checks isApproved before issuing tokens (returns 403 PENDING_APPROVAL if not yet approved).
 */

const bcrypt = require('bcryptjs');
const prisma  = require('../config/database');
const { signAccessToken, signRefreshToken, saveRefreshToken } = require('../utils/token');
const { successResponse, errorResponse } = require('../utils/helpers');
const { notifyPartner } = require('../services/notification/partnerNotificationService');
const logger = require('../utils/logger');

const ALLOWED_PARTNER_ROLES = ['CAREER_COUNSELLOR', 'CAREER_COUNSELLOR_LEAD'];

// ─── Register ─────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/partner/register
 * Body: { email, password, fullName, phone, role, city?, qualification?, experience?, referredBy? }
 */
const registerPartner = async (req, res) => {
  try {
    const { email, password, fullName, phone, role, city, qualification, experience, referredBy } = req.body;

    if (!ALLOWED_PARTNER_ROLES.includes(role)) {
      return errorResponse(res, 'Invalid partner role', 400, 'INVALID_ROLE');
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return errorResponse(res, 'An account with this email already exists', 409, 'CONFLICT');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: fullName,
        role,
        isApproved: false,
        partnerApplication: {
          create: {
            role,
            fullName,
            phone,
            city,
            qualification,
            experience,
            referredBy,
          },
        },
      },
    });

    logger.info('[PartnerAuth] Partner registered (pending approval)', { email, role });

    // Notify partner: application received
    notifyPartner(null, 'partner_application_received', { email, fullName, role }).catch(() => {});

    return successResponse(
      res,
      { message: 'Application submitted. You will be notified once approved.' },
      'Application submitted successfully.',
      201
    );
  } catch (err) {
    logger.error('[PartnerAuth] registerPartner error', { error: err.message });
    return errorResponse(res, 'Registration failed', 500);
  }
};

// ─── Login ────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/partner/login
 * Body: { email, password }
 */
const loginPartner = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where:  { email },
      select: { id: true, email: true, passwordHash: true, role: true, isActive: true, isApproved: true, name: true },
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return errorResponse(res, 'Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    if (!user.isActive) {
      return errorResponse(res, 'Account has been deactivated', 401, 'ACCOUNT_DISABLED');
    }

    if (!ALLOWED_PARTNER_ROLES.includes(user.role)) {
      return errorResponse(res, 'This login is for partners only', 403, 'WRONG_PORTAL');
    }

    if (!user.isApproved) {
      return errorResponse(
        res,
        'Your application is pending admin approval. You will be notified once approved.',
        403,
        'PENDING_APPROVAL'
      );
    }

    const accessToken  = signAccessToken(user.id, user.role);
    const refreshToken = signRefreshToken();
    await saveRefreshToken(user.id, refreshToken);

    const { passwordHash: _, ...safeUser } = user;

    logger.info('[PartnerAuth] Partner logged in', { userId: user.id, role: user.role });

    return successResponse(res, { user: safeUser, accessToken, refreshToken }, 'Login successful');
  } catch (err) {
    logger.error('[PartnerAuth] loginPartner error', { error: err.message });
    return errorResponse(res, 'Login failed', 500);
  }
};

module.exports = { registerPartner, loginPartner };
