'use strict';
const prisma = require('../config/database');
const { successResponse, errorResponse } = require('../utils/helpers');
const logger = require('../utils/logger');
const aiOrchestrator = require('../services/ai/aiOrchestrator');
const { triggerAutomation } = require('../services/automation/automationService');
const analytics = require('../services/analytics/analyticsService');
const { safeLeadUpdateForUser, safeLeadUpdateByReportId } = require('../utils/leadStatusHelper');

// Max questions per plan
const QUESTION_LIMITS = { FREE: 10, PAID: 30 };

const extractTopCareerNames = (topCareers) => {
  if (!Array.isArray(topCareers)) return [];

  return topCareers
    .map((career) => {
      if (typeof career === 'string') return career;
      if (career && typeof career === 'object') return career.name || career.title || null;
      return null;
    })
    .filter(Boolean);
};

/**
 * POST /assessments/start
 * Starts a new assessment session for the authenticated student.
 */
const startAssessment = async (req, res) => {
  try {
    const { accessLevel = 'FREE' } = req.body;

    // Verify student has a profile (onboarding completion is preferred but not mandatory)
    const profile = await prisma.studentProfile.findUnique({ where: { userId: req.user.id } });
    if (!profile) {
      return errorResponse(res, 'Please complete your profile before starting assessment', 400, 'INCOMPLETE_PROFILE');
    }
    // Soft warning if onboarding not complete — assessment can still proceed with partial data
    if (!profile.isOnboardingComplete) {
      logger.info('[Assessment] Starting with incomplete profile', { userId: req.user.id });
    }

    // Prevent multiple active assessments
    const existing = await prisma.assessment.findFirst({
      where: { userId: req.user.id, status: 'IN_PROGRESS' },
    });
    if (existing) {
      return successResponse(res, existing, 'Resume your existing assessment');
    }

    // If PAID, verify the user has a captured payment
    if (accessLevel === 'PAID') {
      const paidPayment = await prisma.payment.findFirst({
        where: { userId: req.user.id, status: 'CAPTURED' },
      });
      if (!paidPayment) {
        return errorResponse(res, 'Please complete payment to access full assessment', 402, 'PAYMENT_REQUIRED');
      }
    }

    const assessment = await prisma.assessment.create({
      data: {
        userId: req.user.id,
        accessLevel,
        totalQuestions: QUESTION_LIMITS[accessLevel] || 10,
        status: 'IN_PROGRESS',
      },
    });

    logger.info('[Assessment] Started', { userId: req.user.id, assessmentId: assessment.id, accessLevel });

    // Analytics + automation
    analytics.track('assessment_started', req, { userId: req.user.id, accessLevel });
    const lead = await prisma.lead.findFirst({ where: { userId: req.user.id } });
    if (lead && !existing) {
      await triggerAutomation('assessment_started', { leadId: lead.id, assessmentId: assessment.id });
      await prisma.lead.update({ where: { id: lead.id }, data: { assessmentId: assessment.id } });
    }

    return successResponse(res, assessment, 'Assessment started', 201);
  } catch (err) {
    logger.error('[Assessment] startAssessment error', { error: err.message });
    throw err;
  }
};

/**
 * GET /assessments/:id
 * Returns assessment details with completed question count.
 */
const getAssessment = async (req, res) => {
  try {
    const assessment = await prisma.assessment.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: {
        questions: { orderBy: { sequence: 'asc' } },
        answers: true,
      },
    });

    if (!assessment) {
      return errorResponse(res, 'Assessment not found', 404, 'NOT_FOUND');
    }

    return successResponse(res, {
      ...assessment,
      answeredCount: assessment.answers.length,
      remainingQuestions: assessment.totalQuestions - assessment.answers.length,
      progressPercent: Math.round((assessment.answers.length / assessment.totalQuestions) * 100),
    });
  } catch (err) {
    logger.error('[Assessment] getAssessment error', { error: err.message });
    throw err;
  }
};

/**
 * POST /assessments/:id/questions/next
 * Uses AI to generate the next adaptive question.
 */
const getNextQuestion = async (req, res) => {
  try {
    const assessment = await prisma.assessment.findFirst({
      where: { id: req.params.id, userId: req.user.id, status: 'IN_PROGRESS' },
      include: { questions: true, answers: true },
    });

    if (!assessment) {
      return errorResponse(res, 'Assessment not found or not active', 404, 'NOT_FOUND');
    }

    if (assessment.answers.length >= assessment.totalQuestions) {
      return errorResponse(res, 'All questions answered. Please complete the assessment.', 400, 'ASSESSMENT_COMPLETE');
    }

    // Gather context for AI
    const profile = await prisma.studentProfile.findUnique({ where: { userId: req.user.id } });
    const previousQA = assessment.questions.map((q) => {
      const answer = assessment.answers.find((a) => a.questionId === q.id);
      return { question: q.questionText, category: q.category, answer: answer?.answerText || null };
    });

    const question = await aiOrchestrator.generateNextQuestion({
      profile,
      previousQA,
      questionNumber: assessment.answers.length + 1,
      totalQuestions: assessment.totalQuestions,
      accessLevel: assessment.accessLevel,
    });

    // Save generated question to DB
    const savedQuestion = await prisma.assessmentQuestion.create({
      data: {
        assessmentId: assessment.id,
        sequence: assessment.answers.length + 1,
        questionText: question.questionText,
        questionType: question.questionType,
        category: question.category,
        options: question.options || null,
        aiProvider: question.providerUsed,
      },
    });

    // Update assessment step
    await prisma.assessment.update({
      where: { id: assessment.id },
      data: { currentStep: assessment.answers.length + 1 },
    });

    return successResponse(res, savedQuestion);
  } catch (err) {
    logger.error('[Assessment] getNextQuestion error', { error: err.message });
    throw err;
  }
};

/**
 * POST /assessments/:id/answers
 * Saves student's answer to a question.
 */
const submitAnswer = async (req, res) => {
  try {
    const { questionId, answerText, answerValue, timeSpentSec } = req.body;

    const assessment = await prisma.assessment.findFirst({
      where: { id: req.params.id, userId: req.user.id, status: 'IN_PROGRESS' },
    });

    if (!assessment) {
      return errorResponse(res, 'Assessment not found or not active', 404, 'NOT_FOUND');
    }

    const question = await prisma.assessmentQuestion.findFirst({
      where: { id: questionId, assessmentId: assessment.id },
    });

    if (!question) {
      return errorResponse(res, 'Question not found in this assessment', 404, 'NOT_FOUND');
    }

    const existingAnswer = await prisma.assessmentAnswer.findUnique({ where: { questionId } });
    if (existingAnswer) {
      return errorResponse(res, 'Question already answered', 409, 'CONFLICT');
    }

    const answer = await prisma.assessmentAnswer.create({
      data: {
        assessmentId: assessment.id,
        questionId,
        answerText,
        answerValue,
        timeSpentSec,
      },
    });

    logger.info('[Assessment] Answer submitted', { assessmentId: assessment.id, questionId });

    return successResponse(res, answer, 'Answer saved');
  } catch (err) {
    logger.error('[Assessment] submitAnswer error', { error: err.message });
    throw err;
  }
};

/**
 * POST /assessments/:id/complete
 * Marks assessment done and triggers report generation.
 */
const completeAssessment = async (req, res) => {
  try {
    const assessment = await prisma.assessment.findFirst({
      where: { id: req.params.id, userId: req.user.id, status: 'IN_PROGRESS' },
      include: {
        questions: true,
        answers: true,
      },
    });

    if (!assessment) {
      return errorResponse(res, 'Assessment not found or already completed', 404, 'NOT_FOUND');
    }

    if (assessment.answers.length < Math.ceil(assessment.totalQuestions * 0.7)) {
      return errorResponse(
        res,
        `Please answer at least ${Math.ceil(assessment.totalQuestions * 0.7)} questions before completing`,
        400,
        'INSUFFICIENT_ANSWERS'
      );
    }

    // Mark assessment complete
    await prisma.assessment.update({
      where: { id: assessment.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    // Create pending report record
    const report = await prisma.careerReport.create({
      data: {
        assessmentId: assessment.id,
        userId: req.user.id,
        accessLevel: assessment.accessLevel,
        status: 'GENERATING',
      },
    });

    // Trigger async report generation (fire-and-forget with error handling)
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: req.user.id },
      include: { parentDetail: true },
    });

    generateReportAsync(assessment, profile, report.id);

    // Analytics + funnel hooks
    analytics.track('assessment_completed', req, {
      userId: req.user.id,
      assessmentId: assessment.id,
      accessLevel: assessment.accessLevel,
    });
    const lead = await prisma.lead.findFirst({ where: { userId: req.user.id } });
    if (lead) {
      await triggerAutomation('assessment_completed', {
        leadId: lead.id, assessmentId: assessment.id, reportId: report.id,
      });
      // Use safe update — paid users must not regress to 'assessment_completed'.
      await safeLeadUpdateForUser(req.user.id, {
        reportId: report.id,
        status: 'assessment_completed',
      });
    }

    logger.info('[Assessment] Completed', { assessmentId: assessment.id, reportId: report.id });

    return successResponse(res, {
      assessmentId: assessment.id,
      reportId: report.id,
      status: 'GENERATING',
      message: 'Your career report is being generated. Check back in 1-2 minutes.',
    });
  } catch (err) {
    logger.error('[Assessment] completeAssessment error', { error: err.message });
    throw err;
  }
};

/**
 * Async report generation — runs in background after assessment completion.
 * @param {object} assessment
 * @param {object} profile
 * @param {string} reportId
 * @param {string} [reportType]  "standard" | "premium" — defaults to assessment accessLevel
 */
const generateReportAsync = async (assessment, profile, reportId, reportType) => {
  // Resolve report type: explicit arg > paid = standard, free = free
  const resolvedType = reportType || (assessment.accessLevel === 'PAID' ? 'standard' : 'free');
  try {
    const reportService = require('../services/report/reportGenerator');
    const reportData = await reportService.generateReport({
      assessment,
      profile,
      accessLevel: assessment.accessLevel,
      reportType: resolvedType,
    });

    await prisma.careerReport.update({
      where: { id: reportId },
      data: {
        reportData,
        status: 'COMPLETED',
        reportType: resolvedType,
        topCareers: extractTopCareerNames(reportData.topCareers),
        recommendedStream: reportData.recommendedStream || reportData.streamRecommendation || null,
        recommendedSubjects: reportData.recommendedSubjects || [],
        confidenceScore: reportData.confidenceScore || null,
        stemScore: reportData.scores?.stem || null,
        creativeScore: reportData.scores?.creative || null,
        socialScore: reportData.scores?.social || null,
        generatedAt: new Date(),
      },
    });

    logger.info('[Assessment] Report generated successfully', { reportId });

    // Trigger post-report automation
    const completedReport = await prisma.careerReport.findUnique({ where: { id: reportId } });
    const eventName = completedReport?.accessLevel === 'PAID'
      ? 'premium_report_ready'
      : 'free_report_ready';
    const lead = await prisma.lead.findFirst({ where: { reportId } });
    if (lead) {
      await triggerAutomation(eventName, { leadId: lead.id, reportId });
      // Use safe update — do NOT overwrite a paid/premium_report_generating status with free_report_ready.
      await safeLeadUpdateByReportId(reportId, { status: eventName });
    }
  } catch (err) {
    logger.error('[Assessment] Report generation failed', { reportId, error: err.message });
    await prisma.careerReport.update({
      where: { id: reportId },
      data: { status: 'FAILED' },
    });
  }
};

module.exports = { startAssessment, getAssessment, getNextQuestion, submitAnswer, completeAssessment, generateReportAsync };
