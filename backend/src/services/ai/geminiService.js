'use strict';
const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../../config');
const logger = require('../../utils/logger');

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

/**
 * Call Google Gemini and return parsed JSON.
 *
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {object} options
 * @returns {Promise<{result: object, usage: object}>}
 */
const callGemini = async (systemPrompt, userPrompt, options = {}) => {
  const modelName = options.model || config.gemini.model;

  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: options.temperature || 0.7,
      maxOutputTokens: options.maxTokens || 4096,
    },
  });

  const result = await model.generateContent(userPrompt);
  const rawContent = result.response.text();

  if (!rawContent) {
    throw new Error('Gemini returned empty response');
  }

  let parsed;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    logger.warn('[Gemini] Failed to parse JSON response', { rawContent: rawContent.slice(0, 200) });
    throw new Error('Gemini response was not valid JSON');
  }

  const usage = result.response.usageMetadata;
  return {
    result: parsed,
    usage: {
      promptTokens: usage?.promptTokenCount || 0,
      completionTokens: usage?.candidatesTokenCount || 0,
      totalTokens: usage?.totalTokenCount || 0,
    },
    model: modelName,
    requestId: null,
  };
};

module.exports = { callGemini };
