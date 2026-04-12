'use strict';
const express = require('express');
const router  = express.Router();
const { authenticate, optionalAuthenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const leadController  = require('../controllers/lead.controller');
const { createLeadSchema, updateLeadSchema, appendEventSchema } = require('../validators/lead.validator');

// Public — create/upsert a lead (can be called before auth)
// If user is logged in, link lead to their account automatically
router.post('/', optionalAuthenticate, validate(createLeadSchema), leadController.createOrUpdateLead);

// Authenticated routes
router.get('/me',           authenticate, leadController.getMyLead);
router.patch('/me',         authenticate, validate(updateLeadSchema), leadController.updateMyLead);
router.post('/me/events',   authenticate, validate(appendEventSchema), leadController.appendLeadEvent);
router.post('/me/link-user', authenticate, leadController.linkUserToLead);

module.exports = router;
