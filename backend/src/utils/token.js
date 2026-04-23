'use strict';
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../config/database');
const config = require('../config');

const assertEmailVerificationStoreAvailable = () => {
  if (prisma.emailVerificationToken
    && typeof prisma.emailVerificationToken.deleteMany === 'function'
    && typeof prisma.emailVerificationToken.create === 'function') {
    return;
  }

  const err = new Error(
    'Email verification storage is unavailable. Run Prisma generate/migrations so EmailVerificationToken exists.'
  );
  err.code = 'EMAIL_VERIFICATION_STORE_UNAVAILABLE';
  err.statusCode = 503;
  throw err;
};

/**
 * Sign a short-lived JWT access token.
 * Payload: { userId, role } — decoded by `authenticate` middleware.
 */
const signAccessToken = (userId, role) =>
  jwt.sign({ userId, role }, config.jwt.secret, { expiresIn: config.jwt.accessExpiresIn });

/**
 * Generate an opaque refresh token (UUID v4).
 * Stored in the `refresh_tokens` table, NOT embedded in the JWT.
 */
const signRefreshToken = () => uuidv4();

/**
 * Persist a refresh token to the database with a 7-day expiry.
 * Always call this immediately after signRefreshToken().
 */
const saveRefreshToken = async (userId, token) => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  await prisma.refreshToken.create({ data: { userId, token, expiresAt } });
};

/**
 * Generate a cryptographically secure email verification token (64-char hex).
 * The raw token is sent in the email link; only its SHA-256 hash is stored in DB.
 */
const generateVerificationToken = () => crypto.randomBytes(32).toString('hex');

/**
 * Hash a raw verification token with SHA-256 before DB storage/lookup.
 * This way a DB breach does NOT expose usable verification tokens.
 */
const hashVerificationToken = (rawToken) =>
  crypto.createHash('sha256').update(rawToken).digest('hex');

/**
 * Persist an email verification token with a 24-hour expiry.
 * Stores only the SHA-256 hash of the raw token — never the raw value.
 * Deletes any existing tokens for the user before creating a new one.
 */
const saveVerificationToken = async (userId, rawToken) => {
  assertEmailVerificationStoreAvailable();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);
  // Invalidate any previous unverified tokens for this user
  await prisma.emailVerificationToken.deleteMany({ where: { userId } });
  const hashedToken = hashVerificationToken(rawToken);
  return prisma.emailVerificationToken.create({ data: { userId, token: hashedToken, expiresAt } });
};

module.exports = {
  signAccessToken,
  signRefreshToken,
  saveRefreshToken,
  generateVerificationToken,
  hashVerificationToken,
  saveVerificationToken,
};
