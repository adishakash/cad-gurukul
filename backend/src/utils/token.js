'use strict';
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../config/database');
const config = require('../config');

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

module.exports = { signAccessToken, signRefreshToken, saveRefreshToken };
