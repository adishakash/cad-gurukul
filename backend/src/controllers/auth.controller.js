'use strict';
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const config = require('../config');
const { successResponse, errorResponse } = require('../utils/helpers');
const {
  signAccessToken,
  signRefreshToken,
  saveRefreshToken,
  generateVerificationToken,
  hashVerificationToken,
  saveVerificationToken,
  generatePasswordResetToken,
  hashPasswordResetToken,
  savePasswordResetToken,
} = require('../utils/token');
const logger = require('../utils/logger');
const { sendWelcomeEmail, sendVerificationEmail, sendPasswordResetEmail } = require('../services/email/emailService');
const { purgeUserData } = require('../utils/accountDeletion');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const buildInitialStudentProfile = (fullName) => ({
  fullName,
  preferredSubjects: [],
  hobbies: [],
  interests: [],
  locationPreference: [],
});

/** Issue tokens and return the full success payload after login / email verify. */
const issueAuthPayload = async (user) => {
  const accessToken = signAccessToken(user.id, user.role);
  const refreshToken = signRefreshToken();
  await saveRefreshToken(user.id, refreshToken);
  return { user: { id: user.id, email: user.email, role: user.role }, accessToken, refreshToken };
};

const EMAIL_RESEND_GENERIC_MESSAGE = 'If that account exists and is unverified, a new verification link will arrive shortly.';
const PASSWORD_RESET_GENERIC_MESSAGE = 'If that account exists, a password reset link will arrive shortly.';
const fallbackVerificationName = (email, fullName) => {
  if (fullName && typeof fullName === 'string' && fullName.trim()) return fullName.trim();
  if (email && typeof email === 'string' && email.includes('@')) return email.split('@')[0];
  return 'there';
};

const resolvePortalFromRole = (role) => {
  if (role === 'ADMIN') return 'admin';
  if (role === 'CAREER_COUNSELLOR' || role === 'CAREER_COUNSELLOR_LEAD' || role === 'COUNSELLOR') return 'staff';
  return 'student';
};

// ─── Controllers ─────────────────────────────────────────────────────────────

const register = async (req, res) => {
  try {
    const { email, password, fullName, role } = req.body;

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, isEmailVerified: true, isActive: true, deletedAt: true },
    });

    if (existing) {
      // Hard-deleted / anonymised account — block reuse
      if (existing.deletedAt) {
        logger.warn('[Auth] Signup blocked — email belongs to deleted account', { email });
        return errorResponse(res, 'An account with this email already exists', 409, 'CONFLICT');
      }

      // Verified account already exists
      if (existing.isEmailVerified) {
        logger.warn('[Auth] Signup blocked — email already verified', { userId: existing.id });
        return errorResponse(res, 'An account with this email already exists', 409, 'CONFLICT');
      }

      // Unverified account exists — check per-email resend cooldown before re-sending
      const existingToken = await prisma.emailVerificationToken.findFirst({
        where: { userId: existing.id },
        select: { createdAt: true },
        orderBy: { createdAt: 'desc' },
      });
      if (existingToken) {
        const ageMs = Date.now() - new Date(existingToken.createdAt).getTime();
        if (ageMs < 60_000) {
          // Keep response generic to avoid account enumeration.
          return successResponse(
            res,
            { emailSent: false, email, alreadyExists: true },
            EMAIL_RESEND_GENERIC_MESSAGE,
            200
          );
        }
      }

      const newToken = generateVerificationToken();
      await saveVerificationToken(existing.id, newToken);
      let emailSent = false;
      try {
        await sendVerificationEmail({
          to: email,
          name: fallbackVerificationName(email, fullName),
          token: newToken,
        });
        emailSent = true;
        logger.info('[Auth] Re-sent verification email (existing unverified)', { userId: existing.id });
      } catch (e) {
        logger.warn('[Auth] Verification re-send failed', { userId: existing.id, error: e.message });
      }

      return successResponse(
        res,
        { emailSent, email, alreadyExists: true },
        EMAIL_RESEND_GENERIC_MESSAGE,
        200
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: role || 'STUDENT',
        isEmailVerified: false,
        studentProfile: role !== 'PARENT' ? { create: buildInitialStudentProfile(fullName) } : undefined,
      },
      select: { id: true, email: true, role: true, createdAt: true },
    });

    const verifyToken = generateVerificationToken();
    await saveVerificationToken(user.id, verifyToken);

    logger.info('[Auth] User registered (awaiting verification)', { userId: user.id, email: user.email });

    // Verification email is blocking — this is the whole point of the feature
    let emailSent = false;
    try {
      await sendVerificationEmail({ to: user.email, name: fullName, token: verifyToken });
      emailSent = true;
      logger.info('[Auth] Verification email sent', { userId: user.id });
    } catch (emailErr) {
      // Email failed but the user record exists — users can retry via resend endpoint.
      logger.error('[Auth] Verification email failed', { userId: user.id, error: emailErr.message });
    }

    return successResponse(
      res,
      { emailSent, email: user.email },
      emailSent
        ? 'Account created! Please check your email to verify your address.'
        : 'Account created, but we could not send the verification email right now. Please use "Resend verification email" in a minute.',
      201
    );
  } catch (err) {
    logger.error('[Auth] register error', { error: err.message });
    throw err;
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;

    // Hash the raw token before looking it up — DB only stores the hash
    const hashedToken = hashVerificationToken(token);

    const record = await prisma.emailVerificationToken.findUnique({
      where: { token: hashedToken },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
            isEmailVerified: true,
            name: true,
            studentProfile: { select: { fullName: true } },
          },
        },
      },
    });

    if (!record) {
      return errorResponse(res, 'Invalid or already used verification link.', 400, 'INVALID_TOKEN');
    }

    if (record.expiresAt < new Date()) {
      // Clean up expired token so the user can request a fresh one
      await prisma.emailVerificationToken.delete({ where: { id: record.id } });
      logger.warn('[Auth] Verification token expired', { userId: record.user.id });
      return errorResponse(res, 'This verification link has expired. Please request a new one.', 400, 'TOKEN_EXPIRED');
    }

    if (!record.user.isActive) {
      return errorResponse(res, 'Account has been deactivated.', 401, 'ACCOUNT_DISABLED');
    }

    // Already verified — idempotent: just log in
    if (record.user.isEmailVerified) {
      await prisma.emailVerificationToken.deleteMany({ where: { userId: record.user.id } });
      const payload = await issueAuthPayload(record.user);
      const displayName = record.user.studentProfile?.fullName || record.user.name || record.user.email;

      // Send welcome email (fire-and-forget)
      sendWelcomeEmail({ to: record.user.email, name: displayName })
        .catch(() => {});

      return successResponse(res, payload, 'Email already verified. You are now logged in.');
    }

    // Mark verified and delete token atomically-ish
    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id: record.user.id },
        data: { isEmailVerified: true },
        select: { id: true, email: true, role: true },
      }),
      prisma.emailVerificationToken.deleteMany({ where: { userId: record.user.id } }),
    ]);

    logger.info('[Auth] Email verified', { userId: updatedUser.id });

    const payload = await issueAuthPayload(updatedUser);
    const displayName = record.user.studentProfile?.fullName || record.user.name || updatedUser.email;

    // Send welcome email after successful verification (fire-and-forget)
    sendWelcomeEmail({ to: updatedUser.email, name: displayName })
      .then(() => logger.info('[Auth] Welcome email sent', { userId: updatedUser.id }))
      .catch((e) => logger.warn('[Auth] Welcome email failed', { userId: updatedUser.id, error: e.message }));

    return successResponse(res, payload, 'Email verified successfully! Welcome to CAD Gurukul.');
  } catch (err) {
    logger.error('[Auth] verifyEmail error', { error: err.message });
    throw err;
  }
};

const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, isEmailVerified: true, isActive: true, deletedAt: true },
    });

    // Always return the same generic message to avoid user enumeration
    const genericMsg = EMAIL_RESEND_GENERIC_MESSAGE;

    if (!user || user.deletedAt || !user.isActive) {
      return successResponse(res, { emailSent: false }, genericMsg);
    }

    if (user.isEmailVerified) {
      return successResponse(res, { emailSent: false, alreadyVerified: true }, genericMsg);
    }

    // Per-email resend cooldown — prevent spam to a single address
    const existingToken = await prisma.emailVerificationToken.findFirst({
      where: { userId: user.id },
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    if (existingToken) {
      const ageMs = Date.now() - new Date(existingToken.createdAt).getTime();
      if (ageMs < 60_000) {
        // Return the same generic message — don't reveal the cooldown to clients
        return successResponse(res, { emailSent: false }, genericMsg);
      }
    }

    const newToken = generateVerificationToken();
    await saveVerificationToken(user.id, newToken);
    let emailSent = false;
    try {
      await sendVerificationEmail({
        to: user.email,
        name: fallbackVerificationName(user.email),
        token: newToken,
      });
      emailSent = true;
      logger.info('[Auth] Verification re-sent', { userId: user.id });
    } catch (e) {
      logger.warn('[Auth] Verification re-send failed', { userId: user.id, error: e.message });
    }

    return successResponse(res, { emailSent }, genericMsg);
  } catch (err) {
    logger.error('[Auth] resendVerification error', { error: err.message });
    throw err;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Password reset
// ─────────────────────────────────────────────────────────────────────────────

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        isActive: true,
        deletedAt: true,
        studentProfile: { select: { fullName: true } },
      },
    });

    if (!user || user.deletedAt || !user.isActive) {
      return successResponse(res, { emailSent: false }, PASSWORD_RESET_GENERIC_MESSAGE);
    }

    const existingToken = await prisma.passwordResetToken.findFirst({
      where: { userId: user.id },
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    if (existingToken) {
      const ageMs = Date.now() - new Date(existingToken.createdAt).getTime();
      if (ageMs < 60_000) {
        return successResponse(res, { emailSent: false }, PASSWORD_RESET_GENERIC_MESSAGE);
      }
    }

    const resetToken = generatePasswordResetToken();
    await savePasswordResetToken(user.id, resetToken);

    let emailSent = false;
    try {
      const displayName = user.studentProfile?.fullName || user.name || user.email;
      await sendPasswordResetEmail({
        to: user.email,
        name: displayName,
        token: resetToken,
        portal: resolvePortalFromRole(user.role),
      });
      emailSent = true;
      logger.info('[Auth] Password reset email sent', { userId: user.id });
    } catch (err) {
      logger.warn('[Auth] Password reset email failed', { userId: user.id, error: err.message });
    }

    return successResponse(res, { emailSent }, PASSWORD_RESET_GENERIC_MESSAGE);
  } catch (err) {
    logger.error('[Auth] forgotPassword error', { error: err.message });
    throw err;
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    const hashedToken = hashPasswordResetToken(token);
    const record = await prisma.passwordResetToken.findUnique({
      where: { token: hashedToken },
      select: { id: true, userId: true, expiresAt: true },
    });

    if (!record) {
      return errorResponse(res, 'Invalid or expired reset link.', 400, 'INVALID_TOKEN');
    }

    if (record.expiresAt < new Date()) {
      await prisma.passwordResetToken.delete({ where: { id: record.id } });
      return errorResponse(res, 'This reset link has expired. Please request a new one.', 400, 'TOKEN_EXPIRED');
    }

    const user = await prisma.user.findUnique({
      where: { id: record.userId },
      select: { id: true, isActive: true, deletedAt: true },
    });

    if (!user || user.deletedAt) {
      return errorResponse(res, 'Account not found', 404, 'NOT_FOUND');
    }

    if (!user.isActive) {
      return errorResponse(res, 'Account has been deactivated.', 401, 'ACCOUNT_DISABLED');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
      prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
    ]);

    logger.info('[Auth] Password reset completed', { userId: user.id });
    return successResponse(res, null, 'Password reset successful. You can now sign in.');
  } catch (err) {
    logger.error('[Auth] resetPassword error', { error: err.message });
    throw err;
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, passwordHash: true, role: true, isActive: true, isEmailVerified: true },
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

    // Block login for unverified accounts — must verify email first
    if (!user.isEmailVerified) {
      logger.warn('[Auth] Login blocked — email not verified', { userId: user.id });
      return errorResponse(
        res,
        'Please verify your email address before logging in. Check your inbox or request a new link.',
        403,
        'EMAIL_NOT_VERIFIED'
      );
    }

    const payload = await issueAuthPayload(user);
    logger.info('[Auth] User logged in', { userId: user.id });
    return successResponse(res, payload);
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

const deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password || typeof password !== 'string') {
      return errorResponse(res, 'Password confirmation is required', 400, 'VALIDATION_ERROR');
    }

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

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return errorResponse(res, 'Incorrect password. Account was not deleted.', 401, 'INVALID_CREDENTIALS');
    }

    const anonymisedEmail = `deleted_${user.id}@deleted.cadgurukul.internal`;

    await prisma.$transaction(async (tx) => {
      await purgeUserData(tx, { userId: user.id, email: user.email });
      await tx.user.update({
        where: { id: user.id },
        data: {
          isActive: false,
          deletedAt: new Date(),
          email: anonymisedEmail,
        },
      });
    });

    logger.info('[Auth] Account deleted (soft + data purged)', { userId: user.id, originalEmail: user.email });

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

module.exports = {
  register,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  login,
  refresh,
  logout,
  deleteAccount,
  adminLogin,
};
