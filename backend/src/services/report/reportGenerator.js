'use strict';
const aiOrchestrator = require('../ai/aiOrchestrator');
const logger = require('../../utils/logger');

/**
 * Main report generation pipeline.
 *
 * Steps:
 * 1. Prepare Q&A pairs from assessment data
 * 2. Evaluate responses through AI (scoring + personality)
 * 3. Generate appropriate report based on access level
 */
const generateReport = async ({ assessment, profile, accessLevel, reportType = 'standard' }) => {
  logger.info('[ReportGenerator] Starting report generation', {
    assessmentId: assessment.id,
    accessLevel,
    reportType,
  });

  // Step 1: Prepare context
  const questionsAndAnswers = assessment.questions.map((q) => {
    const answer = assessment.answers.find((a) => a.questionId === q.id);
    return {
      question: q.questionText,
      category: q.category,
      questionType: q.questionType,
      answer: answer?.answerText || (answer?.answerValue ? JSON.stringify(answer.answerValue) : null),
    };
  });

  // Step 2: Evaluate responses
  logger.info('[ReportGenerator] Evaluating assessment responses...');
  const evaluation = await aiOrchestrator.evaluateAssessment({
    profile,
    questionsAndAnswers,
    userId: profile.userId,
    assessmentId: assessment.id,
  });

  const { scores, personalityType, learningStyle, strengthAreas, improvementAreas, confidenceScore } = evaluation;

  // Step 3: Generate report based on plan
  let reportContent;

  if (accessLevel === 'FREE') {
    logger.info('[ReportGenerator] Generating FREE report...');
    reportContent = await aiOrchestrator.generateFreeReport({
      profile,
      scores,
      personalityType,
      strengthAreas: strengthAreas || [],
      userId: profile.userId,
    });
  } else if (reportType === 'premium') {
    logger.info('[ReportGenerator] Generating PREMIUM AI report with deep analysis...');
    reportContent = await aiOrchestrator.generatePremiumReport({
      profile,
      scores,
      personalityType,
      learningStyle,
      strengthAreas: strengthAreas || [],
      improvementAreas: improvementAreas || [],
      userId: profile.userId,
    });
  } else {
    logger.info('[ReportGenerator] Generating PAID (standard) report with GPT-4o...');
    reportContent = await aiOrchestrator.generatePaidReport({
      profile,
      scores,
      personalityType,
      learningStyle,
      strengthAreas: strengthAreas || [],
      improvementAreas: improvementAreas || [],
      userId: profile.userId,
    });
  }

  // Merge evaluation scores into report
  const finalReport = {
    ...reportContent,
    scores,
    personalityType,
    learningStyle,
    strengthAreas,
    improvementAreas,
    confidenceScore: reportContent.confidenceScore || confidenceScore,
    accessLevel,
    generatedBy: 'CAD Gurukul AI',
    generatedAt: new Date().toISOString(),
  };

  logger.info('[ReportGenerator] Report generated successfully', { assessmentId: assessment.id });

  return finalReport;
};

module.exports = { generateReport };
