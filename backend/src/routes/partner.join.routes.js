'use strict';
const express = require('express');
const router = express.Router();
const { partnerUpload } = require('../middleware/partnerUpload');
const partnerJoinController = require('../controllers/partner.join.controller');

// Quote (coupon validation)
router.post('/quote', partnerJoinController.getQuote);

// Create order with multipart form data
router.post(
  '/create-order',
  partnerUpload.fields([
    { name: 'graduationCertificate', maxCount: 1 },
    { name: 'idProof', maxCount: 1 },
  ]),
  partnerJoinController.createOrder
);

// Verify payment
router.post('/verify', partnerJoinController.verifyPayment);

module.exports = router;
