'use strict';
const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validate');
const assessmentController = require('../controllers/assessment.controller');
const { startAssessmentSchema, submitAnswerSchema } = require('../validators/assessment.validator');

router.use(authenticate);

router.post('/start', validate(startAssessmentSchema), assessmentController.startAssessment);
router.get('/:id', assessmentController.getAssessment);
router.post('/:id/questions/next', aiLimiter, assessmentController.getNextQuestion);
router.post('/:id/answers', validate(submitAnswerSchema), assessmentController.submitAnswer);
router.post('/:id/complete', assessmentController.completeAssessment);

module.exports = router;
