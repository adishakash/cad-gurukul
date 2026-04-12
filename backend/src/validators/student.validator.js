'use strict';
const Joi = require('joi');

const onboarding = Joi.object({
  fullName: Joi.string().min(2).max(100).trim().required(),
  age: Joi.number().integer().min(13).max(20).required(),
  classStandard: Joi.string()
    .valid('CLASS_8', 'CLASS_9', 'CLASS_10', 'CLASS_11', 'CLASS_12')
    .required(),
  schoolName: Joi.string().max(200).trim().allow('').optional(),
  board: Joi.string()
    .valid('CBSE', 'ICSE', 'STATE_BOARD', 'IGCSE', 'IB', 'OTHER')
    .required(),
  city: Joi.string().max(100).trim().required(),
  state: Joi.string().max(100).trim().required(),
  pinCode: Joi.string()
    .pattern(/^\d{6}$/)
    .optional()
    .messages({ 'string.pattern.base': 'Pin code must be 6 digits' }),
  mobileNumber: Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .optional()
    .messages({ 'string.pattern.base': 'Enter a valid Indian mobile number' }),
  address: Joi.string().max(500).trim().allow('').optional(),
  languagePreference: Joi.string()
    .valid('English', 'Hindi', 'Tamil', 'Telugu', 'Marathi', 'Bengali', 'Gujarati', 'Kannada')
    .default('English'),
  academicScores: Joi.object().pattern(Joi.string(), Joi.number().min(0).max(100)).optional(),
  preferredSubjects: Joi.array().items(Joi.string().trim()).max(10).optional(),
  hobbies: Joi.array().items(Joi.string().trim()).max(15).optional(),
  interests: Joi.array().items(Joi.string().trim()).max(15).optional(),
  careerAspirations: Joi.string().max(500).trim().allow('').optional(),
  budgetPreference: Joi.string()
    .valid('under-5L', '5-10L', '10-20L', '20L+', 'not-sure')
    .optional(),
  locationPreference: Joi.array()
    .items(Joi.string().valid('local', 'state', 'national', 'abroad'))
    .optional(),
  specialNotes: Joi.string().max(1000).trim().allow('').optional(),

  // Parent details
  parentName: Joi.string().max(100).trim().allow('').optional(),
  parentContact: Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .optional()
    .messages({ 'string.pattern.base': 'Enter a valid Indian mobile number' }),
  parentEmail: Joi.string().email().lowercase().trim().allow('').optional(),
  parentOccupation: Joi.string().max(100).trim().allow('').optional(),
});

const updateProfile = Joi.object({
  fullName: Joi.string().min(2).max(100).trim(),
  age: Joi.number().integer().min(13).max(20),
  schoolName: Joi.string().max(200).trim().allow(''),
  city: Joi.string().max(100).trim(),
  state: Joi.string().max(100).trim(),
  hobbies: Joi.array().items(Joi.string().trim()).max(15),
  interests: Joi.array().items(Joi.string().trim()).max(15),
  careerAspirations: Joi.string().max(500).trim().allow(''),
  specialNotes: Joi.string().max(1000).trim().allow(''),
}).min(1);

module.exports = { onboarding, updateProfile };
