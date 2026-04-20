'use strict';
const express = require('express');
const router = express.Router();

const { authenticate, requirePortalRole } = require('../middleware/auth');
const reportController = require('../controllers/report.controller');

// User portal: only STUDENT and PARENT may access these routes.
router.use(authenticate, requirePortalRole('STUDENT', 'PARENT'));

router.get('/my', reportController.getMyReports);
router.get('/:id/status', reportController.getReportStatus);
router.get('/:id', reportController.getReport);
router.get('/:id/pdf', reportController.downloadReportPdf);

module.exports = router;
