'use strict';

const crypto = require('crypto');
const prisma = require('../config/database');

const buildCode = () => `CC${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

async function generateCcReferralCode() {
  for (let i = 0; i < 10; i += 1) {
    const code = buildCode();
    const existing = await prisma.user.findFirst({ where: { ccReferralCode: code } });
    if (!existing) return code;
  }
  throw new Error('Failed to generate unique referral code');
}

module.exports = { generateCcReferralCode };
