'use strict';
const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const leadController  = require('../controllers/lead.controller');
const { createLeadSchema, updateLeadSchema, appendEventSchema } = require('../validators/lead.validator');

// Public — create/upsert a lead (can be called before auth)
// Optional auth: if user is logged in, link lead to their account automatically
router.post('/', (req, res, next) => {
  // Attempt to authenticate but don't block on failure
  authenticate(req, res, (err) => {
    if (err) { req.user = null; }
    next();
  });
}, validate(createLeadSchema), leadController.createOrUpdateLead);

// Authenticated routes
router.get('/me',           authenticate, leadController.getMyLead);
router.patch('/me',         authenticate, validate(updateLeadSchema), leadController.updateMyLead);
router.post('/me/events',   authenticate, validate(appendEventSchema), leadController.appendLeadEvent);
router.post('/me/link-user', authenticate, leadController.linkUserToLead);

module.exports = router;
