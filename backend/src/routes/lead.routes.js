'use strict';
const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth');
const leadController  = require('../controllers/lead.controller');

// Public — create/upsert a lead (can be called before auth)
// Optional auth: if user is logged in, link lead to their account automatically
router.post('/', (req, res, next) => {
  // Attempt to authenticate but don't block on failure
  authenticate(req, res, (err) => {
    if (err) { req.user = null; }
    next();
  });
}, leadController.createOrUpdateLead);

// Authenticated routes
router.get('/me',           authenticate, leadController.getMyLead);
router.patch('/me',         authenticate, leadController.updateMyLead);
router.post('/me/events',   authenticate, leadController.appendLeadEvent);
router.post('/me/link-user', authenticate, leadController.linkUserToLead);

module.exports = router;
