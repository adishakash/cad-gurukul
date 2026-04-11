'use strict';
const express = require('express');
const Joi = require('joi');
const router = express.Router();

const { authenticate } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validate');
const assessmentController = require('../controllers/assessment.controller');

const startSchema = Joi.object({ accessLevel: Joi.string().valid('FREE', 'PAID').default('FREE') });
const answerSchema = Joi.object({
  questionId: Joi.string().required(),
  answerText: Joi.string().max(2000).allow('').optional(),
  answerValue: Joi.any().optional(),
  timeSpentSec: Joi.number().integer().min(0).max(600).optional(),
});

router.use(authenticate);

router.post('/start', validate(startSchema), assessmentController.startAssessment);
router.get('/:id', assessmentController.getAssessment);
router.post('/:id/questions/next', aiLimiter, assessmentController.getNextQuestion);
router.post('/:id/answers', validate(answerSchema), assessmentController.submitAnswer);
router.post('/:id/complete', assessmentController.completeAssessment);

module.exports = router;
