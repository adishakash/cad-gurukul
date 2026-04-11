'use strict';
const OpenAI = require('openai');
const config = require('../../config');
const logger = require('../../utils/logger');

const client = new OpenAI({ apiKey: config.openai.apiKey });

/**
 * Call OpenAI chat completion and return parsed JSON.
 *
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {object} options
 * @returns {Promise<{result: object, usage: object}>}
 */
const callOpenAI = async (systemPrompt, userPrompt, options = {}) => {
  const model = options.model || config.openai.model;
  const maxTokens = options.maxTokens || config.openai.maxTokens;

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: maxTokens,
    temperature: options.temperature || 0.7,
    response_format: { type: 'json_object' },
  });

  const rawContent = response.choices[0]?.message?.content;
  if (!rawContent) {
    throw new Error('OpenAI returned empty response');
  }

  let parsed;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    logger.warn('[OpenAI] Failed to parse JSON response', { rawContent: rawContent.slice(0, 200) });
    throw new Error('OpenAI response was not valid JSON');
  }

  return {
    result: parsed,
    usage: {
      promptTokens: response.usage?.prompt_tokens || 0,
      completionTokens: response.usage?.completion_tokens || 0,
      totalTokens: response.usage?.total_tokens || 0,
    },
    model,
    requestId: response.id,
  };
};

module.exports = { callOpenAI };
