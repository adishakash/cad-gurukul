'use strict';
/**
 * Payout Execution Service
 *
 * Abstracts the actual bank transfer behind a strategy pattern controlled by
 * the PAYOUT_MODE environment variable:
 *
 *   manual   — creates the payout record, logs the transfer details, marks the
 *               payout as "processing" and waits for admin to manually transfer
 *               then mark as "paid". Safe default for go-live.
 *   mock     — always succeeds; used in development/tests.
 *   razorpay — (future) calls Razorpay Payouts API.
 *
 * Returns: { success, transferRef?, error? }
 */

const logger = require('../../utils/logger');

const PAYOUT_MODE = process.env.PAYOUT_MODE || 'manual';

/**
 * Execute a payout to a partner's bank account.
 *
 * @param {{
 *   id: string,
 *   amountPaise: number,
 * }} payout  — CcPayout or CclPayout record
 * @param {{
 *   accountHolder: string,
 *   accountNumberEnc: string,  // already decrypted by caller
 *   ifscCode: string,
 *   bankName: string,
 *   accountType: string,
 * }} bankAccount  — decrypted bank account details
 * @param {'CC'|'CCL'} role
 * @returns {Promise<{ success: boolean, transferRef?: string, error?: string }>}
 */
const executePayout = async (payout, bankAccount, role) => {
  const amountRupees = (payout.amountPaise / 100).toFixed(2);

  logger.info(`[PayoutExecution] mode=${PAYOUT_MODE} role=${role} payoutId=${payout.id} amount=₹${amountRupees}`);

  if (PAYOUT_MODE === 'mock') {
    const ref = `MOCK-${Date.now()}-${payout.id.slice(-6).toUpperCase()}`;
    logger.info('[PayoutExecution] Mock transfer successful', { ref });
    return { success: true, transferRef: ref };
  }

  if (PAYOUT_MODE === 'razorpay') {
    return executeRazorpayPayout(payout, bankAccount, role);
  }

  // Default: manual mode
  // Log the payout intent for operations team to action manually.
  logger.info('[PayoutExecution] Manual mode — payout queued for manual transfer', {
    payoutId:    payout.id,
    role,
    amountRupees,
    accountHolder: bankAccount.accountHolder,
    ifscCode:      bankAccount.ifscCode,
    bankName:      bankAccount.bankName,
    accountType:   bankAccount.accountType,
    // NOTE: account number is NOT logged — must be retrieved from DB when transferring
  });

  // In manual mode we return a pseudoref so the payout can be tracked until
  // the admin manually enters the real bank ref.
  const ref = `MANUAL-PENDING-${payout.id.slice(-8).toUpperCase()}`;
  return { success: true, transferRef: ref };
};

/**
 * Razorpay Payouts API integration (Phase 2).
 * Requires RAZORPAY_PAYOUT_KEY_ID and RAZORPAY_PAYOUT_KEY_SECRET env vars.
 */
const executeRazorpayPayout = async (payout, bankAccount, role) => {
  try {
    const Razorpay = require('razorpay');
    const rzp = new Razorpay({
      key_id:     process.env.RAZORPAY_PAYOUT_KEY_ID,
      key_secret: process.env.RAZORPAY_PAYOUT_KEY_SECRET,
    });

    // Create fund account
    const fundAccount = await rzp.fundAccount.create({
      contact_id: `cg_${role.toLowerCase()}_${payout.id.slice(-8)}`,
      account_type: 'bank_account',
      bank_account: {
        name:           bankAccount.accountHolder,
        ifsc:           bankAccount.ifscCode,
        account_number: bankAccount.accountNumberEnc, // already decrypted
      },
    });

    // Create payout
    const rzpPayout = await rzp.payout.create({
      account_number: process.env.RAZORPAY_PAYOUT_ACCOUNT_NUMBER,
      fund_account_id: fundAccount.id,
      amount:          payout.amountPaise,
      currency:        'INR',
      mode:            'IMPS',
      purpose:         'payout',
      queue_if_low_balance: true,
      reference_id: `CG-${role}-${payout.id.slice(-10).toUpperCase()}`,
      narration: `CAD Gurukul ${role} Commission`,
    });

    logger.info('[PayoutExecution] Razorpay payout initiated', { rzpPayoutId: rzpPayout.id });
    return { success: true, transferRef: rzpPayout.id };
  } catch (err) {
    logger.error('[PayoutExecution] Razorpay payout failed', { error: err.message });
    return { success: false, error: err.message };
  }
};

module.exports = { executePayout };
