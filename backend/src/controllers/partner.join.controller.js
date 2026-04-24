'use strict';
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const path = require('path');
const prisma = require('../config/database');
const razorpayService = require('../services/payment/razorpayService');
const { successResponse, errorResponse, rupeesToPaise } = require('../utils/helpers');
const { splitGstFromInclusive, addGstToExclusive } = require('../utils/gst');
const { notifyPartner } = require('../services/notification/partnerNotificationService');
const logger = require('../utils/logger');
const config = require('../config');

const JOIN_FEE_RUPEES = Number(config.counsellorJoin?.feeRupees || 49999);
const JOIN_FEE_PAISE = rupeesToPaise(JOIN_FEE_RUPEES);

const normalizeCouponCode = (code) => (code || '').trim().toUpperCase();

const buildTotals = (discountPct = 0) => {
  const pct = Math.max(0, Math.min(Number(discountPct) || 0, 100));
  const discountPaise = Math.round(JOIN_FEE_PAISE * pct / 100);
  const subtotalPaise = Math.max(0, JOIN_FEE_PAISE - discountPaise);
  const gstRate = config.gst?.rate || 0;

  if (config.gst?.included === false) {
    const { totalPaise, gstPaise } = addGstToExclusive(subtotalPaise, gstRate);
    return {
      baseAmountPaise: JOIN_FEE_PAISE,
      discountPct: pct,
      discountPaise,
      taxableAmountPaise: subtotalPaise,
      gstAmountPaise: gstPaise,
      gstRate,
      gstIncluded: false,
      totalAmountPaise: totalPaise,
    };
  }

  const { basePaise, gstPaise } = splitGstFromInclusive(subtotalPaise, gstRate);
  return {
    baseAmountPaise: JOIN_FEE_PAISE,
    discountPct: pct,
    discountPaise,
    taxableAmountPaise: basePaise,
    gstAmountPaise: gstPaise,
    gstRate,
    gstIncluded: true,
    totalAmountPaise: subtotalPaise,
  };
};

const resolveCoupon = async (rawCode) => {
  const code = normalizeCouponCode(rawCode);
  if (!code) return { code: null, discountPct: 0, coupon: null };

  const coupon = await prisma.counsellorCoupon.findUnique({ where: { code } });
  if (!coupon || !coupon.isActive) {
    return { code, discountPct: null, coupon: null, error: 'Invalid or inactive coupon.' };
  }

  const now = new Date();
  if (coupon.startsAt && now < coupon.startsAt) {
    return { code, discountPct: null, coupon: null, error: 'Coupon is not active yet.' };
  }
  if (coupon.expiresAt && now > coupon.expiresAt) {
    return { code, discountPct: null, coupon: null, error: 'Coupon has expired.' };
  }
  if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
    return { code, discountPct: null, coupon: null, error: 'Coupon usage limit reached.' };
  }

  return { code, discountPct: coupon.discountPct || 0, coupon };
};

const generatePassword = () => {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
  const bytes = crypto.randomBytes(12);
  let password = '';
  for (let i = 0; i < bytes.length; i += 1) {
    password += charset[bytes[i] % charset.length];
  }
  return password;
};

const validateRequired = (value) => typeof value === 'string' && value.trim().length > 0;

const getQuote = async (req, res) => {
  try {
    const { couponCode } = req.body || {};
    const couponResult = await resolveCoupon(couponCode);
    if (couponResult.error) {
      return errorResponse(res, couponResult.error, 400, 'INVALID_COUPON');
    }

    const totals = buildTotals(couponResult.discountPct || 0);
    return successResponse(res, {
      couponCode: couponResult.code || null,
      discountPct: totals.discountPct,
      discountPaise: totals.discountPaise,
      gstRate: totals.gstRate,
      gstIncluded: totals.gstIncluded,
      gstAmountPaise: totals.gstAmountPaise,
      taxableAmountPaise: totals.taxableAmountPaise,
      totalAmountPaise: totals.totalAmountPaise,
      baseAmountPaise: totals.baseAmountPaise,
    });
  } catch (err) {
    logger.error('[PartnerJoin] getQuote error', { error: err.message });
    return errorResponse(res, 'Failed to calculate quote', 500);
  }
};

const createOrder = async (req, res) => {
  try {
    const {
      fullName,
      education,
      address,
      pincode,
      email,
      phone,
      couponCode,
    } = req.body || {};

    if (!validateRequired(fullName)) return errorResponse(res, 'Full name is required', 400, 'VALIDATION_ERROR');
    if (!validateRequired(education)) return errorResponse(res, 'Education is required', 400, 'VALIDATION_ERROR');
    if (!validateRequired(address)) return errorResponse(res, 'Address is required', 400, 'VALIDATION_ERROR');
    if (!validateRequired(pincode) || !/^\d{6}$/.test(pincode)) {
      return errorResponse(res, 'Valid 6-digit pin code is required', 400, 'VALIDATION_ERROR');
    }
    if (!validateRequired(email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return errorResponse(res, 'Valid email is required', 400, 'VALIDATION_ERROR');
    }
    if (!validateRequired(phone) || !/^[6-9]\d{9}$/.test(phone)) {
      return errorResponse(res, 'Valid 10-digit phone is required', 400, 'VALIDATION_ERROR');
    }

    const graduationFile = req.files?.graduationCertificate?.[0];
    const idFile = req.files?.idProof?.[0];
    if (!graduationFile || !idFile) {
      return errorResponse(res, 'Graduation certificate and ID proof are required', 400, 'MISSING_FILES');
    }

    const couponResult = await resolveCoupon(couponCode);
    if (couponResult.error) {
      return errorResponse(res, couponResult.error, 400, 'INVALID_COUPON');
    }

    const totals = buildTotals(couponResult.discountPct || 0);

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { partnerApplication: true },
    });

    const order = await razorpayService.createOrder({
      amount: totals.totalAmountPaise,
      currency: 'INR',
      receipt: `cj_${Date.now()}`,
      notes: { email: normalizedEmail, role: 'CAREER_COUNSELLOR' },
    });

    if (existing) {
      if (existing.role !== 'CAREER_COUNSELLOR') {
        return errorResponse(res, 'This email is already linked to another role', 409, 'CONFLICT');
      }
      if (!existing.partnerApplication) {
        return errorResponse(res, 'Partner application not found for this account', 409, 'CONFLICT');
      }
      if (existing.partnerApplication.paymentStatus === 'captured') {
        return errorResponse(res, 'Payment already completed for this account', 409, 'CONFLICT');
      }

      await prisma.$transaction([
        prisma.user.update({
          where: { id: existing.id },
          data: { name: fullName.trim() },
        }),
        prisma.partnerApplication.update({
          where: { id: existing.partnerApplication.id },
          data: {
            fullName: fullName.trim(),
            phone: phone.trim(),
            qualification: education.trim(),
            addressLine: address.trim(),
            pincode: pincode.trim(),
            graduationDocPath: path.basename(graduationFile.path),
            graduationDocName: graduationFile.originalname,
            graduationDocMime: graduationFile.mimetype,
            graduationDocSize: graduationFile.size,
            idDocPath: path.basename(idFile.path),
            idDocName: idFile.originalname,
            idDocMime: idFile.mimetype,
            idDocSize: idFile.size,
            paymentStatus: 'created',
            razorpayOrderId: order.id,
            paymentAmountPaise: totals.totalAmountPaise,
            discountPct: totals.discountPct,
            couponCode: couponResult.code || null,
            gstRate: totals.gstRate,
            gstAmountPaise: totals.gstAmountPaise,
            taxableAmountPaise: totals.taxableAmountPaise,
            totalAmountPaise: totals.totalAmountPaise,
          },
        }),
      ]);

      logger.info('[PartnerJoin] Order refreshed', { userId: existing.id, orderId: order.id });

      return successResponse(res, {
        orderId: order.id,
        amountPaise: totals.totalAmountPaise,
        currency: 'INR',
        keyId: config.razorpay.keyId,
        gstRate: totals.gstRate,
        gstIncluded: totals.gstIncluded,
        gstAmountPaise: totals.gstAmountPaise,
        taxableAmountPaise: totals.taxableAmountPaise,
        discountPaise: totals.discountPaise,
        discountPct: totals.discountPct,
        baseAmountPaise: totals.baseAmountPaise,
      }, 'Order created', 201);
    }

    const tempPassword = crypto.randomBytes(12).toString('base64url');
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const created = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        role: 'CAREER_COUNSELLOR',
        name: fullName.trim(),
        isApproved: false,
        partnerApplication: {
          create: {
            role: 'CAREER_COUNSELLOR',
            status: 'pending',
            fullName: fullName.trim(),
            phone: phone.trim(),
            city: null,
            qualification: education.trim(),
            experience: null,
            addressLine: address.trim(),
            pincode: pincode.trim(),
            graduationDocPath: path.basename(graduationFile.path),
            graduationDocName: graduationFile.originalname,
            graduationDocMime: graduationFile.mimetype,
            graduationDocSize: graduationFile.size,
            idDocPath: path.basename(idFile.path),
            idDocName: idFile.originalname,
            idDocMime: idFile.mimetype,
            idDocSize: idFile.size,
            paymentStatus: 'created',
            razorpayOrderId: order.id,
            paymentAmountPaise: totals.totalAmountPaise,
            discountPct: totals.discountPct,
            couponCode: couponResult.code || null,
            gstRate: totals.gstRate,
            gstAmountPaise: totals.gstAmountPaise,
            taxableAmountPaise: totals.taxableAmountPaise,
            totalAmountPaise: totals.totalAmountPaise,
          },
        },
      },
      select: { id: true },
    });

    logger.info('[PartnerJoin] Order created', { userId: created.id, orderId: order.id });

    return successResponse(res, {
      orderId: order.id,
      amountPaise: totals.totalAmountPaise,
      currency: 'INR',
      keyId: config.razorpay.keyId,
      gstRate: totals.gstRate,
      gstIncluded: totals.gstIncluded,
      gstAmountPaise: totals.gstAmountPaise,
      taxableAmountPaise: totals.taxableAmountPaise,
      discountPaise: totals.discountPaise,
      discountPct: totals.discountPct,
      baseAmountPaise: totals.baseAmountPaise,
    }, 'Order created', 201);
  } catch (err) {
    logger.error('[PartnerJoin] createOrder error', { error: err.message });
    return errorResponse(res, err.message || 'Failed to create payment order', 500);
  }
};

const verifyPayment = async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body || {};
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return errorResponse(res, 'razorpayOrderId, razorpayPaymentId and razorpaySignature are required', 400, 'MISSING_FIELDS');
    }
    if (!config.razorpay.keySecret) {
      logger.error('[PartnerJoin] Razorpay keySecret not configured');
      return errorResponse(res, 'Payment verification unavailable', 503, 'CONFIG_ERROR');
    }

    const expectedSignature = crypto
      .createHmac('sha256', config.razorpay.keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (expectedSignature !== razorpaySignature) {
      logger.warn('[PartnerJoin] Signature mismatch', { razorpayOrderId });
      return errorResponse(res, 'Invalid payment signature', 400, 'INVALID_SIGNATURE');
    }

    const application = await prisma.partnerApplication.findFirst({
      where: { razorpayOrderId },
      include: { user: true },
    });

    if (!application) {
      return errorResponse(res, 'Application not found for this order', 404, 'NOT_FOUND');
    }

    if (application.paymentStatus === 'captured') {
      return successResponse(res, { alreadyProcessed: true }, 'Payment already processed');
    }

    const newPassword = generatePassword();
    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.$transaction(async (tx) => {
      await tx.partnerApplication.update({
        where: { id: application.id },
        data: {
          status: 'approved',
          paymentStatus: 'captured',
          razorpayPaymentId,
          razorpaySignature,
          paidAt: new Date(),
        },
      });

      await tx.user.update({
        where: { id: application.userId },
        data: {
          passwordHash,
          isApproved: true,
          approvedAt: new Date(),
          isActive: true,
        },
      });

      if (application.couponCode) {
        await tx.counsellorCoupon.updateMany({
          where: { code: application.couponCode },
          data: { usedCount: { increment: 1 } },
        });
      }
    });

    await notifyPartner(application.userId, 'partner_welcome_credentials', {
      email: application.user?.email,
      name: application.fullName,
      role: application.role,
      loginId: application.user?.email,
      password: newPassword,
      phone: application.phone,
    }).catch(() => {});

    logger.info('[PartnerJoin] Payment verified', { applicationId: application.id, orderId: razorpayOrderId });

    return successResponse(res, { status: 'captured' }, 'Payment verified. Credentials sent.');
  } catch (err) {
    logger.error('[PartnerJoin] verifyPayment error', { error: err.message });
    return errorResponse(res, 'Payment verification failed', 500);
  }
};

module.exports = { createOrder, verifyPayment, getQuote };
