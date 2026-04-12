'use strict';
const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/auth');
const reportController = require('../controllers/report.controller');

router.use(authenticate);

router.get('/my', reportController.getMyReports);
router.get('/:id/status', reportController.getReportStatus);
router.get('/:id', reportController.getReport);
router.get('/:id/pdf', reportController.downloadReportPdf);

module.exports = router;
