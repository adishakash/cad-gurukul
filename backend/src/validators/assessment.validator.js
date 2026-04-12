'use strict';
const Joi = require('joi');

const startAssessmentSchema = Joi.object({
  accessLevel: Joi.string().valid('FREE','PAID').default('FREE'),
});

const submitAnswerSchema = Joi.object({
  questionId:   Joi.string().trim().required(),
  answerText:   Joi.string().trim().max(2000).optional().allow('', null),
  answerValue:  Joi.alternatives().try(Joi.object(), Joi.array()).optional(),
  timeSpentSec: Joi.number().integer().min(0).max(600).optional(),
});

const saveSectionProgressSchema = Joi.object({
  sectionKey: Joi.string().trim().max(50).required(),
  data:       Joi.object().required(),
});

module.exports = { startAssessmentSchema, submitAnswerSchema, saveSectionProgressSchema };
