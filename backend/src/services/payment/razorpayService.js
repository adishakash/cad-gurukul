'use strict';
const Razorpay = require('razorpay');
const config = require('../../config');
const logger = require('../../utils/logger');

const razorpay = new Razorpay({
  key_id: config.razorpay.keyId,
  key_secret: config.razorpay.keySecret,
});

/**
 * Create a Razorpay order
 * @param {object} params - { amount (paise), currency, receipt, notes }
 */
const createOrder = async ({ amount, currency = 'INR', receipt, notes = {} }) => {
  try {
    const order = await razorpay.orders.create({
      amount,
      currency,
      receipt,
      notes,
      payment_capture: 1, // Auto-capture
    });

    logger.info('[Razorpay] Order created', { orderId: order.id, amount });
    return order;
  } catch (err) {
    logger.error('[Razorpay] Failed to create order', { error: err.message });
    throw new Error(`Payment order creation failed: ${err.error?.description || err.message}`);
  }
};

/**
 * Fetch a Razorpay payment by ID
 */
const fetchPayment = async (paymentId) => {
  try {
    return await razorpay.payments.fetch(paymentId);
  } catch (err) {
    logger.error('[Razorpay] Failed to fetch payment', { paymentId, error: err.message });
    throw err;
  }
};

/**
 * Fetch a Razorpay order by ID
 */
const fetchOrder = async (orderId) => {
  try {
    return await razorpay.orders.fetch(orderId);
  } catch (err) {
    logger.error('[Razorpay] Failed to fetch order', { orderId, error: err.message });
    throw err;
  }
};

module.exports = { createOrder, fetchPayment, fetchOrder };
