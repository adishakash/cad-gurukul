'use strict';
/**
 * Bank Account Controller
 * Shared handler for CC and CCL bank account CRUD.
 * Account number is AES-256-GCM encrypted before storage; only last4 is stored in plain.
 */

const prisma  = require('../config/database');
const { encrypt, decrypt, lastN } = require('../utils/encryption');
const { successResponse, errorResponse } = require('../utils/helpers');
const logger  = require('../utils/logger');

// ─── Get Bank Account ─────────────────────────────────────────────────────────

const getBankAccount = async (req, res) => {
  try {
    const bank = await prisma.bankAccount.findUnique({
      where:  { userId: req.user.id },
      select: {
        id: true, accountHolder: true, accountNumberLast4: true,
        ifscCode: true, bankName: true, accountType: true,
        isVerified: true, verifiedAt: true, createdAt: true,
      },
    });

    if (!bank) return successResponse(res, null, 'No bank account on file');
    return successResponse(res, bank);
  } catch (err) {
    logger.error('[BankAccount] getBankAccount error', { error: err.message });
    return errorResponse(res, 'Failed to load bank account', 500);
  }
};

// ─── Save / Update Bank Account ───────────────────────────────────────────────

const saveBankAccount = async (req, res) => {
  try {
    const { accountHolder, accountNumber, ifscCode, bankName, accountType = 'savings' } = req.body;

    if (!/^\d{9,18}$/.test(accountNumber)) {
      return errorResponse(res, 'Account number must be 9–18 digits', 400, 'INVALID_ACCOUNT_NUMBER');
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode.toUpperCase())) {
      return errorResponse(res, 'Invalid IFSC code format', 400, 'INVALID_IFSC');
    }

    const accountNumberEnc   = encrypt(accountNumber);
    const accountNumberLast4 = lastN(accountNumber, 4);

    const bank = await prisma.bankAccount.upsert({
      where:  { userId: req.user.id },
      update: {
        accountHolder, accountNumberEnc, accountNumberLast4,
        ifscCode: ifscCode.toUpperCase(), bankName, accountType,
        isVerified: false, verifiedAt: null,  // reset verification on any update
      },
      create: {
        userId: req.user.id,
        accountHolder, accountNumberEnc, accountNumberLast4,
        ifscCode: ifscCode.toUpperCase(), bankName, accountType,
      },
      select: {
        id: true, accountHolder: true, accountNumberLast4: true,
        ifscCode: true, bankName: true, accountType: true, isVerified: true,
      },
    });

    logger.info('[BankAccount] Bank account saved', { userId: req.user.id });
    return successResponse(res, bank, 'Bank account saved. Pending admin verification before payouts.');
  } catch (err) {
    logger.error('[BankAccount] saveBankAccount error', { error: err.message });
    return errorResponse(res, 'Failed to save bank account', 500);
  }
};

module.exports = { getBankAccount, saveBankAccount };
