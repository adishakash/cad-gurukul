'use strict';
const express = require('express');
const Joi = require('joi');
const router = express.Router();
const prisma = require('../config/database');
const { validate } = require('../middleware/validate');
const { getDatabaseReadinessSnapshot } = require('../utils/databaseReadiness');
const { successResponse } = require('../utils/helpers');

const authRoutes = require('./auth.routes');
const studentRoutes = require('./student.routes');
const assessmentRoutes = require('./assessment.routes');
const reportRoutes = require('./report.routes');
const paymentRoutes = require('./payment.routes');
const adminRoutes = require('./admin.routes');
const leadRoutes  = require('./lead.routes');
const staffRoutes = require('./staff.routes');

// Health check
router.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return successResponse(res, {
      status: 'ok',
      db: 'connected',
      ...getDatabaseReadinessSnapshot(),
      timestamp: new Date().toISOString(),
    });
  } catch {
    return res.status(503).json({ success: false, error: { code: 'DB_ERROR', message: 'Database unavailable' } });
  }
});

// Contact form
const contactSchema = Joi.object({
  name: Joi.string().min(2).max(100).trim().required(),
  email: Joi.string().email().lowercase().trim().required(),
  phone: Joi.string().pattern(/^[6-9]\d{9}$/).optional(),
  subject: Joi.string().max(200).trim().optional(),
  message: Joi.string().min(10).max(2000).trim().required(),
});

router.post('/contact', validate(contactSchema), async (req, res) => {
  const query = await prisma.contactQuery.create({ data: req.body });
  return successResponse(res, { id: query.id }, 'Message received. We will get back to you soon.', 201);
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/students', studentRoutes);
router.use('/assessments', assessmentRoutes);
router.use('/reports', reportRoutes);
router.use('/payments', paymentRoutes);
router.use('/admin', adminRoutes);
router.use('/leads', leadRoutes);
router.use('/staff', staffRoutes);

module.exports = router;
