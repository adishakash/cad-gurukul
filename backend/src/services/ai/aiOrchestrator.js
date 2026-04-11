'use strict';
const prisma = require('../../config/database');
const config = require('../../config');
const logger = require('../../utils/logger');
const { withRetry } = require('../../utils/helpers');
const { callOpenAI } = require('./openaiService');
const { callGemini } = require('./geminiService');
const prompts = require('./promptTemplates');

/**
 * Provider routing strategy:
 * 
 * "auto" mode (default):
 *  - Question generation: Gemini (cheaper, fast, good for structured JSON)
 *  - Evaluation: Gemini (structured scoring)
 *  - Free report: Gemini (cost-optimized)
 *  - Paid report: OpenAI GPT-4o (higher quality, deeper reasoning)
 * 
 * "openai": always use OpenAI
 * "gemini": always use Gemini
 */

const PROVIDER_STRATEGY = {
  questionGeneration: { auto: 'gemini' },
  evaluation: { auto: 'gemini' },
  freeReport: { auto: 'gemini' },
  paidReport: { auto: 'openai' }, // Premium quality for paid users
};

/**
 * Log AI session to DB
 */
const logAISession = async ({ userId, assessmentId, provider, model, purpose, usage, latencyMs, success, errorMessage, requestId }) => {
  try {
    await prisma.aISession.create({
      data: {
        userId,
        assessmentId,
        provider: provider.toUpperCase(),
        model,
        purpose,
        promptTokens: usage?.promptTokens || 0,
        completionTokens: usage?.completionTokens || 0,
        totalTokens: usage?.totalTokens || 0,
        latencyMs,
        success,
        errorMessage,
        requestId,
      },
    });
  } catch (err) {
    // Non-critical — don't crash if logging fails
    logger.warn('[AIOrchestrator] Failed to log AI session', { error: err.message });
  }
};

/**
 * Core AI call function with retry and fallback logic
 */
const callAI = async ({ provider, systemPrompt, userPrompt, options = {}, userId, assessmentId, purpose }) => {
  const effectiveProvider =
    config.ai.defaultProvider === 'auto'
      ? (PROVIDER_STRATEGY[purpose]?.auto || 'openai')
      : config.ai.defaultProvider;

  const start = Date.now();
  let lastError;

  // Primary attempt
  const providers = effectiveProvider === 'openai'
    ? ['openai', 'gemini']   // fallback to Gemini if OpenAI fails
    : ['gemini', 'openai'];  // fallback to OpenAI if Gemini fails

  for (const p of providers) {
    try {
      const callFn = p === 'openai' ? callOpenAI : callGemini;
      const response = await withRetry(() => callFn(systemPrompt, userPrompt, options), 2, 1000);

      const latencyMs = Date.now() - start;

      await logAISession({
        userId,
        assessmentId,
        provider: p,
        model: response.model,
        purpose,
        usage: response.usage,
        latencyMs,
        success: true,
        requestId: response.requestId,
      });

      logger.info('[AIOrchestrator] AI call successful', {
        provider: p,
        purpose,
        tokens: response.usage?.totalTokens,
        latencyMs,
      });

      return { result: response.result, providerUsed: p.toUpperCase() };
    } catch (err) {
      lastError = err;
      logger.warn('[AIOrchestrator] AI provider failed, trying fallback', {
        provider: p,
        purpose,
        error: err.message,
      });

      await logAISession({
        userId,
        assessmentId,
        provider: p,
        model: p === 'openai' ? config.openai.model : config.gemini.model,
        purpose,
        usage: null,
        latencyMs: Date.now() - start,
        success: false,
        errorMessage: err.message,
      });
    }
  }

  // Both providers failed
  logger.error('[AIOrchestrator] All AI providers failed', { purpose, error: lastError?.message });
  throw new Error(`AI service unavailable: ${lastError?.message}`);
};

/**
 * Generate the next adaptive question for an assessment
 */
const generateNextQuestion = async ({ profile, previousQA, questionNumber, totalQuestions, accessLevel, userId, assessmentId }) => {
  const systemPrompt = prompts.QUESTION_GENERATION_SYSTEM;
  const userPrompt = prompts.buildQuestionGenerationPrompt({ profile, previousQA, questionNumber, totalQuestions, accessLevel });

  const { result, providerUsed } = await callAI({
    provider: 'auto',
    systemPrompt,
    userPrompt,
    options: { temperature: 0.8 },
    userId,
    assessmentId,
    purpose: 'questionGeneration',
  });

  // Validate and sanitize response
  if (!result.questionText || !result.questionType || !result.category) {
    throw new Error('AI returned invalid question format');
  }

  return {
    questionText: result.questionText,
    questionType: result.questionType,
    category: result.category,
    options: result.options || null,
    providerUsed,
  };
};

/**
 * Evaluate all answers and generate scores
 */
const evaluateAssessment = async ({ profile, questionsAndAnswers, userId, assessmentId }) => {
  const systemPrompt = prompts.EVALUATION_SYSTEM;
  const userPrompt = prompts.buildEvaluationPrompt({ profile, questionsAndAnswers });

  const { result, providerUsed } = await callAI({
    provider: 'auto',
    systemPrompt,
    userPrompt,
    options: { temperature: 0.3 },
    userId,
    assessmentId,
    purpose: 'evaluation',
  });

  return { ...result, providerUsed };
};

/**
 * Generate FREE career report
 */
const generateFreeReport = async ({ profile, scores, personalityType, strengthAreas, userId }) => {
  const systemPrompt = prompts.FREE_REPORT_SYSTEM;
  const userPrompt = prompts.buildFreeReportPrompt({ profile, scores, personalityType, strengthAreas });

  const { result } = await callAI({
    provider: 'auto',
    systemPrompt,
    userPrompt,
    options: { temperature: 0.5 },
    userId,
    purpose: 'freeReport',
  });

  return result;
};

/**
 * Generate comprehensive PAID career report
 */
const generatePaidReport = async ({ profile, scores, personalityType, learningStyle, strengthAreas, improvementAreas, userId }) => {
  const systemPrompt = prompts.PAID_REPORT_SYSTEM;
  const userPrompt = prompts.buildPaidReportPrompt({ profile, scores, personalityType, learningStyle, strengthAreas, improvementAreas });

  const { result } = await callAI({
    provider: 'openai', // Always use GPT-4o for paid reports
    systemPrompt,
    userPrompt,
    options: { temperature: 0.6, maxTokens: 6000 },
    userId,
    purpose: 'paidReport',
  });

  return result;
};

module.exports = { generateNextQuestion, evaluateAssessment, generateFreeReport, generatePaidReport };
