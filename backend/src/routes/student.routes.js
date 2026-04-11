'use strict';
const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const studentController = require('../controllers/student.controller');
const studentValidator = require('../validators/student.validator');

router.use(authenticate);

router.get('/me', studentController.getMyProfile);
router.put('/me', validate(studentValidator.updateProfile), studentController.updateProfile);
router.post('/me/onboarding', validate(studentValidator.onboarding), studentController.completeOnboarding);

module.exports = router;
