'use strict';

const crypto = require('crypto');
const prisma = require('../config/database');

const RESERVED_SLUGS = new Set([
  'about',
  'how-it-works',
  'contact',
  'plans',
  'login',
  'register',
  'verify-email',
  'dashboard',
  'onboarding',
  'assessment',
  'payment',
  'reports',
  'join',
  'consultation',
  'testlink',
  'admin',
  'partner',
  'staff',
  'counsellor',
  'privacy',
  'terms',
  'refund',
  'healthz',
  'api',
]);

const buildCode = () => `CC${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

const slugify = (value) => (value || '')
  .toString()
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const trimSlug = (value, maxLen) => {
  if (!value) return '';
  let trimmed = value.slice(0, maxLen);
  trimmed = trimmed.replace(/-+$/g, '');
  return trimmed;
};

async function generateCcReferralCode(preferredName) {
  const baseRaw = slugify(preferredName);
  let base = baseRaw;

  if (base && RESERVED_SLUGS.has(base)) {
    base = `${base}-cc`;
  }

  if (base) {
    const baseTrimmed = trimSlug(base, 45);
    for (let i = 0; i < 20; i += 1) {
      const suffix = i === 0 ? '' : `-${i + 1}`;
      const candidate = trimSlug(`${baseTrimmed}${suffix}`, 50);
      const code = candidate.toUpperCase();
      const existing = await prisma.user.findFirst({ where: { ccReferralCode: code } });
      if (!existing) return code;
    }
  }

  for (let i = 0; i < 10; i += 1) {
    const code = buildCode();
    const existing = await prisma.user.findFirst({ where: { ccReferralCode: code } });
    if (!existing) return code;
  }

  throw new Error('Failed to generate unique referral code');
}

module.exports = { generateCcReferralCode };
