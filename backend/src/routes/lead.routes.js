'use strict';
const express = require('express');
const router  = express.Router();
const { authenticate, optionalAuthenticate, requirePortalRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const leadController  = require('../controllers/lead.controller');
const { createLeadSchema, updateLeadSchema, appendEventSchema } = require('../validators/lead.validator');

// Public — create/upsert a lead (can be called before auth)
// If user is logged in, link lead to their account automatically
router.post('/', optionalAuthenticate, validate(createLeadSchema), leadController.createOrUpdateLead);

// Authenticated routes — user portal only (STUDENT / PARENT).
// Staff and admin have dedicated lead endpoints under /staff/* and /admin/*.
router.get('/me',            authenticate, requirePortalRole('STUDENT', 'PARENT'), leadController.getMyLead);
router.patch('/me',          authenticate, requirePortalRole('STUDENT', 'PARENT'), validate(updateLeadSchema), leadController.updateMyLead);
router.post('/me/events',    authenticate, requirePortalRole('STUDENT', 'PARENT'), validate(appendEventSchema), leadController.appendLeadEvent);
router.post('/me/link-user', authenticate, requirePortalRole('STUDENT', 'PARENT'), leadController.linkUserToLead);

module.exports = router;
