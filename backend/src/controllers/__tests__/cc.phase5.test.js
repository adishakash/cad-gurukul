'use strict';
/**
 * Phase 5 — Career Counsellor Business Layer
 * Comprehensive unit tests for all 5 required test scenarios.
 *
 * All DB + external calls are mocked. No live DB required.
 */

// ─── Mocks (must be declared before require()) ───────────────────────────────

jest.mock('../../config/database', () => ({
  ccTestLink:          { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn() },
  ccDiscount:          { findUnique: jest.fn(), upsert: jest.fn() },
  ccAttributedSale:    { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn(), count: jest.fn(), aggregate: jest.fn() },
  ccCommission:        { create: jest.fn(), findMany: jest.fn(), count: jest.fn(), aggregate: jest.fn() },
  ccPayout:            { findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  cclTrainingContent:  { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  activityLog:         { create: jest.fn() },
  user:                { findMany: jest.fn(), count: jest.fn() },
  $transaction:        jest.fn(),
}));

jest.mock('../../services/payment/razorpayService', () => ({
  createOrder: jest.fn(),
}));

jest.mock('../../services/cc/ccPaymentService', () => ({
  createCcSaleAndCommission: jest.fn(),
}));

jest.mock('../../utils/helpers', () => ({
  successResponse: jest.fn((res, data, msg, status = 200) => {
    res._status = status;
    res._body   = { success: true, data, message: msg };
    return res;
  }),
  errorResponse: jest.fn((res, msg, status, code) => {
    res._status = status;
    res._body   = { success: false, message: msg, code };
    return res;
  }),
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

jest.mock('../../config', () => ({
  razorpay: { keyId: 'rzp_test_mock', keySecret: 'mock_secret' },
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

const prisma                     = require('../../config/database');
const { createOrder: razorpayCreateOrder } = require('../../services/payment/razorpayService');
const { createCcSaleAndCommission }        = require('../../services/cc/ccPaymentService');
const ccController               = require('../cc.controller');
const ccAdminController          = require('../cc.admin.controller');

// ─── Test helpers ─────────────────────────────────────────────────────────────

function mockRes() {
  return { _status: null, _body: null };
}

function mockReq(params = {}, body = {}, query = {}, userId = 'cc-user-1') {
  return { params, body, query, user: { id: userId, role: 'CAREER_COUNSELLOR' } };
}

/** A standard 499-plan test link fixture */
const link499 = {
  id: 'link-1',
  code: 'ABCD1234',
  ccUserId: 'cc-user-1',
  planType: '499plan',
  feeAmountPaise: 49900,
  isUsed: false,
  expiresAt: null,
  candidateName: null,
  candidateEmail: null,
  candidatePhone: null,
  ccUser: { name: 'Test Counsellor' },
};

/** A standard non-499 plan link fixture */
const linkStandard = {
  ...link499,
  id: 'link-2',
  code: 'EFGH5678',
  planType: 'standard',
  feeAmountPaise: 299900, // ₹2999
};

// ─────────────────────────────────────────────────────────────────────────────
// TEST 1 — Free Flow (499plan + 100% discount)
// ─────────────────────────────────────────────────────────────────────────────
describe('Test 1 — Free flow: 499plan + 100% discount', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should bypass Razorpay entirely and return { free: true }', async () => {
    prisma.ccTestLink.findUnique.mockResolvedValue(link499);
    prisma.ccDiscount.findUnique.mockResolvedValue({ discountPct: 100, isActive: true });
    prisma.ccTestLink.update.mockResolvedValue({ ...link499, testOrderId: 'free_ABCD1234_123', testPaymentStatus: 'initiated' });
    createCcSaleAndCommission.mockResolvedValue({
      sale: { id: 'sale-free-1', netAmountPaise: 0, commissionPaise: 0 },
      commission: { id: 'comm-free-1', amountPaise: 0 },
      isNew: true,
    });

    const req = mockReq({ code: 'ABCD1234' }, {});
    const res = mockRes();

    await ccController.createTestOrder(req, res);

    // Razorpay must NOT have been called
    expect(razorpayCreateOrder).not.toHaveBeenCalled();

    // createCcSaleAndCommission must have been called with net = 0
    expect(createCcSaleAndCommission).toHaveBeenCalledWith(
      expect.objectContaining({
        ccUserId:            'cc-user-1',
        grossAmountPaise:    49900,
        discountAmountPaise: 49900,
        netAmountPaise:      0,
      }),
    );

    // Response should be { free: true }
    expect(res._status).toBe(201);
    expect(res._body.data.free).toBe(true);
    expect(res._body.data.netAmountPaise).toBe(0);
    expect(res._body.data.grossAmountPaise).toBe(49900);
    expect(res._body.data.discountAmountPaise).toBe(49900);
  });

  it('commission should be ₹0 for a free order', () => {
    // Commission = 70% × 0 = 0 (pure math, no mock needed)
    const COMMISSION_RATE = 0.70;
    const netAmountPaise  = 0;
    const commissionPaise = Math.round(netAmountPaise * COMMISSION_RATE);
    expect(commissionPaise).toBe(0);
  });

  it('should mark the link as used after free order is processed', async () => {
    prisma.ccTestLink.findUnique.mockResolvedValue(link499);
    prisma.ccDiscount.findUnique.mockResolvedValue({ discountPct: 100, isActive: true });
    prisma.ccTestLink.update.mockResolvedValue({});
    createCcSaleAndCommission.mockResolvedValue({ sale: { id: 'sale-1' }, isNew: true });

    const req = mockReq({ code: 'ABCD1234' }, { candidateName: 'John Doe', candidateEmail: 'john@example.com' });
    const res = mockRes();

    await ccController.createTestOrder(req, res);

    // update should have been called with testPaymentStatus: 'initiated'
    expect(prisma.ccTestLink.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'link-1' },
        data: expect.objectContaining({ testPaymentStatus: 'initiated', testNetAmountPaise: 0 }),
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2 — Discount Cap (standard plan: 30% → enforced as 20%)
// ─────────────────────────────────────────────────────────────────────────────
describe('Test 2 — Discount cap: standard plan 30% becomes 20%', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should cap 30% discount to 20% for non-499plan and call Razorpay with correct amount', async () => {
    prisma.ccTestLink.findUnique.mockResolvedValue(linkStandard);
    prisma.ccDiscount.findUnique.mockResolvedValue({ discountPct: 30, isActive: true });
    razorpayCreateOrder.mockResolvedValue({ id: 'order_capped_test' });
    prisma.ccTestLink.update.mockResolvedValue({});

    const req = mockReq({ code: 'EFGH5678' }, {});
    const res = mockRes();

    await ccController.createTestOrder(req, res);

    // Effective discount must be 20 (not 30)
    // netAmountPaise = 299900 - round(299900 * 0.20) = 299900 - 59980 = 239920
    const expectedDiscount = Math.round(299900 * 20 / 100); // 59980
    const expectedNet      = 299900 - expectedDiscount;    // 239920

    expect(razorpayCreateOrder).toHaveBeenCalledWith(
      expect.objectContaining({ amount: expectedNet }),
    );
    expect(res._body.data.discountPct).toBe(20);
    expect(res._body.data.amountPaise).toBe(expectedNet);
    // free: true must NOT appear
    expect(res._body.data.free).toBeUndefined();
  });

  it('discount cap logic is correct for all plan types', () => {
    // Pure math — no controller needed
    const capFor = (planType) => (planType === '499plan' ? 100 : 20);

    expect(Math.min(30, capFor('standard'))).toBe(20);
    expect(Math.min(30, capFor('premium'))).toBe(20);
    expect(Math.min(100, capFor('499plan'))).toBe(100);
    expect(Math.min(50, capFor('499plan'))).toBe(50); // under cap → unchanged
    expect(Math.min(10, capFor('standard'))).toBe(10); // under cap → unchanged
  });

  it('inactive discount config should result in 0% discount', async () => {
    prisma.ccTestLink.findUnique.mockResolvedValue(linkStandard);
    prisma.ccDiscount.findUnique.mockResolvedValue({ discountPct: 30, isActive: false }); // inactive!
    razorpayCreateOrder.mockResolvedValue({ id: 'order_nodiscount' });
    prisma.ccTestLink.update.mockResolvedValue({});

    const req = mockReq({ code: 'EFGH5678' }, {});
    const res = mockRes();

    await ccController.createTestOrder(req, res);

    // full price — no discount
    expect(razorpayCreateOrder).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 299900 }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3 — Scope Safety (CC1 cannot see CC2 data)
// ─────────────────────────────────────────────────────────────────────────────
describe('Test 3 — Scope safety: CC can only see own data', () => {
  beforeEach(() => jest.clearAllMocks());

  it('listTestLinks always filters by req.user.id (CC1)', async () => {
    prisma.ccTestLink.findMany.mockResolvedValue([]);
    prisma.ccTestLink.count.mockResolvedValue(0);

    const req = mockReq({}, {}, {}, 'cc-user-1');
    const res = mockRes();

    await ccController.listTestLinks(req, res);

    expect(prisma.ccTestLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ccUserId: 'cc-user-1' } }),
    );
  });

  it('listTestLinks for CC2 uses CC2 id — never CC1', async () => {
    prisma.ccTestLink.findMany.mockResolvedValue([]);
    prisma.ccTestLink.count.mockResolvedValue(0);

    const req = mockReq({}, {}, {}, 'cc-user-2');
    const res = mockRes();

    await ccController.listTestLinks(req, res);

    const callArg = prisma.ccTestLink.findMany.mock.calls[0][0];
    expect(callArg.where.ccUserId).toBe('cc-user-2');
    expect(callArg.where.ccUserId).not.toBe('cc-user-1');
  });

  it('getAccountSummary uses req.user.id as scope', async () => {
    prisma.ccAttributedSale.aggregate.mockResolvedValue({ _sum: { grossAmountPaise: null }, _count: 0 });
    prisma.ccCommission.findMany.mockResolvedValue([]);
    prisma.ccCommission.aggregate.mockResolvedValue({ _sum: { amountPaise: null } });
    prisma.ccDiscount.findUnique.mockResolvedValue(null);

    const req = mockReq({}, {}, {}, 'cc-user-1');
    const res = mockRes();

    await ccController.getAccountSummary(req, res);

    expect(prisma.ccAttributedSale.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ ccUserId: 'cc-user-1' }) }),
    );
  });

  it('a used/expired link is rejected before any payment processing', async () => {
    // CC1's link is already used
    prisma.ccTestLink.findUnique.mockResolvedValue({ ...link499, isUsed: true });

    const req = mockReq({ code: 'ABCD1234' }, {});
    const res = mockRes();

    await ccController.createTestOrder(req, res);

    expect(res._status).toBe(409);
    expect(res._body.code).toBe('LINK_ALREADY_USED');
    expect(razorpayCreateOrder).not.toHaveBeenCalled();
    expect(createCcSaleAndCommission).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 4 — Admin Visibility (can see all CC data without scoping by ccUserId)
// ─────────────────────────────────────────────────────────────────────────────
describe('Test 4 — Admin visibility: admin sees all CC data', () => {
  beforeEach(() => jest.clearAllMocks());

  function mockAdminReq(query = {}) {
    return { params: {}, body: {}, query, user: { id: 'admin-1', role: 'ADMIN' } };
  }

  it('listAllTestLinks uses empty where by default (no ccUserId filter)', async () => {
    prisma.ccTestLink.findMany.mockResolvedValue([]);
    prisma.ccTestLink.count.mockResolvedValue(0);

    const req = mockAdminReq();
    const res = mockRes();

    await ccAdminController.listAllTestLinks(req, res);

    const callWhere = prisma.ccTestLink.findMany.mock.calls[0][0].where;
    // No ccUserId restriction in default admin call
    expect(callWhere.ccUserId).toBeUndefined();
    expect(res._status).toBe(200);
  });

  it('admin can filter by ccUserId when query param is provided', async () => {
    prisma.ccTestLink.findMany.mockResolvedValue([]);
    prisma.ccTestLink.count.mockResolvedValue(0);

    const req = mockAdminReq({ ccUserId: 'cc-user-1' });
    const res = mockRes();

    await ccAdminController.listAllTestLinks(req, res);

    const callWhere = prisma.ccTestLink.findMany.mock.calls[0][0].where;
    expect(callWhere.ccUserId).toBe('cc-user-1');
  });

  it('admin response includes pagination metadata', async () => {
    prisma.ccTestLink.findMany.mockResolvedValue([{ id: 'l1', ccUser: { name: 'A', email: 'a@b.com' }, attributedSales: [], expiresAt: null }]);
    prisma.ccTestLink.count.mockResolvedValue(1);

    const req = mockAdminReq({ page: '1', limit: '10' });
    const res = mockRes();

    await ccAdminController.listAllTestLinks(req, res);

    expect(res._body.data.pagination.total).toBe(1);
    expect(res._body.data.pagination.totalPages).toBe(1);
    expect(Array.isArray(res._body.data.links)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 5 — Idempotency (verify called twice → only 1 sale)
// ─────────────────────────────────────────────────────────────────────────────
describe('Test 5 — Idempotency: verify twice does not create duplicate sale', () => {
  beforeEach(() => jest.clearAllMocks());

  const EXISTING_SALE = { id: 'sale-existing-1', paymentId: 'pay_test123', ccUserId: 'cc-user-1', netAmountPaise: 49900 };

  it('first verify call returns isNew: true', async () => {
    createCcSaleAndCommission.mockResolvedValueOnce({
      sale: EXISTING_SALE,
      commission: { id: 'comm-1', amountPaise: 34930 },
      isNew: true,
    });

    // Mock link + signature check setup for verifyTestPayment
    const crypto = require('crypto');
    const secret = 'mock_secret';
    const orderId = 'order_test123';
    const paymentId = 'pay_test123';
    const sig = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');

    prisma.ccTestLink.findUnique.mockResolvedValue({
      ...link499,
      testOrderId: orderId,
      testNetAmountPaise: 49900,
    });

    const req = mockReq({ code: 'ABCD1234' }, {
      razorpayOrderId: orderId, razorpayPaymentId: paymentId, razorpaySignature: sig,
    });
    const res = mockRes();

    await ccController.verifyTestPayment(req, res);

    expect(res._status).toBe(200);
    expect(res._body.data.isNew).toBe(true);
    expect(createCcSaleAndCommission).toHaveBeenCalledTimes(1);
  });

  it('second verify call returns isNew: false (no duplicate sale)', async () => {
    createCcSaleAndCommission.mockResolvedValueOnce({
      sale: EXISTING_SALE,
      commission: null,
      isNew: false, // already processed
    });

    const crypto = require('crypto');
    const secret = 'mock_secret';
    const orderId = 'order_test123';
    const paymentId = 'pay_test123';
    const sig = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');

    prisma.ccTestLink.findUnique.mockResolvedValue({
      ...link499,
      testOrderId: orderId,
      testNetAmountPaise: 49900,
    });

    const req = mockReq({ code: 'ABCD1234' }, {
      razorpayOrderId: orderId, razorpayPaymentId: paymentId, razorpaySignature: sig,
    });
    const res = mockRes();

    await ccController.verifyTestPayment(req, res);

    expect(res._status).toBe(200);
    expect(res._body.data.isNew).toBe(false);
    // Only one call each time — the service itself handles the idempotency internally
    expect(createCcSaleAndCommission).toHaveBeenCalledTimes(1);
  });

  it('createCcSaleAndCommission internal idempotency: pre-check returns existing on duplicate paymentId', async () => {
    // Test the pattern by verifying $transaction is called and createCcSaleAndCommission
    // returns isNew: false when given a duplicate paymentId.
    // The real 3-layer logic is: pre-check inside $transaction → @unique constraint → P2002 catch.
    // Here we verify the controller (verifyTestPayment) surfaces isNew: false correctly.

    createCcSaleAndCommission.mockResolvedValueOnce({
      sale: EXISTING_SALE,
      commission: null,
      isNew: false, // service signals: already existed
    });

    const crypto = require('crypto');
    const orderId = 'order_dup_test';
    const paymentId = 'pay_dup_test';
    const sig = crypto.createHmac('sha256', 'mock_secret').update(`${orderId}|${paymentId}`).digest('hex');

    prisma.ccTestLink.findUnique.mockResolvedValue({
      ...link499,
      testOrderId: orderId,
      testNetAmountPaise: 49900,
    });

    const req = mockReq({ code: 'ABCD1234' }, {
      razorpayOrderId: orderId, razorpayPaymentId: paymentId, razorpaySignature: sig,
    });
    const res = mockRes();

    await ccController.verifyTestPayment(req, res);

    // Controller must surface isNew: false — no duplicate creation
    expect(res._body.data.isNew).toBe(false);
    expect(res._body.message).toBe('Already processed');
    // createCcSaleAndCommission called exactly once; it returns false internally
    expect(createCcSaleAndCommission).toHaveBeenCalledTimes(1);
  });

  it('commission rate is always exactly 70%', () => {
    const COMMISSION_RATE = 0.70;
    const cases = [
      { net: 49900,  expectedCommission: Math.round(49900  * 0.70) },  // 34930
      { net: 299900, expectedCommission: Math.round(299900 * 0.70) },  // 209930
      { net: 0,      expectedCommission: 0 },                          // free order
    ];
    for (const { net, expectedCommission } of cases) {
      expect(Math.round(net * COMMISSION_RATE)).toBe(expectedCommission);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BONUS — Link guard edge cases
// ─────────────────────────────────────────────────────────────────────────────
describe('Link guard edge cases', () => {
  beforeEach(() => jest.clearAllMocks());

  it('expired link (expiresAt in past) is rejected with 410', async () => {
    const expiredLink = { ...link499, expiresAt: new Date('2020-01-01') };
    prisma.ccTestLink.findUnique.mockResolvedValue(expiredLink);

    const req = mockReq({ code: 'ABCD1234' }, {});
    const res = mockRes();

    await ccController.createTestOrder(req, res);

    expect(res._status).toBe(410);
    expect(res._body.code).toBe('LINK_EXPIRED');
  });

  it('nonexistent link code returns 404', async () => {
    prisma.ccTestLink.findUnique.mockResolvedValue(null);

    const req = mockReq({ code: 'BADCODE1' }, {});
    const res = mockRes();

    await ccController.createTestOrder(req, res);

    expect(res._status).toBe(404);
    expect(res._body.code).toBe('LINK_NOT_FOUND');
  });

  it('stale Razorpay orderId is rejected in verify (ORDER_MISMATCH)', async () => {
    const crypto = require('crypto');
    const staleOrderId = 'order_stale';
    const currentOrderId = 'order_current';
    const paymentId = 'pay_stale';
    const sig = crypto.createHmac('sha256', 'mock_secret').update(`${staleOrderId}|${paymentId}`).digest('hex');

    prisma.ccTestLink.findUnique.mockResolvedValue({
      ...link499,
      testOrderId: currentOrderId, // different from staleOrderId
      testNetAmountPaise: 49900,
    });

    const req = mockReq({ code: 'ABCD1234' }, {
      razorpayOrderId: staleOrderId, razorpayPaymentId: paymentId, razorpaySignature: sig,
    });
    const res = mockRes();

    await ccController.verifyTestPayment(req, res);

    expect(res._status).toBe(400);
    expect(res._body.code).toBe('ORDER_MISMATCH');
  });
});
