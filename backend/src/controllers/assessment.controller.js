'use strict';
const prisma = require('../config/database');
const { successResponse, errorResponse } = require('../utils/helpers');
const logger = require('../utils/logger');
const aiOrchestrator = require('../services/ai/aiOrchestrator');

// Max questions per plan
const QUESTION_LIMITS = { FREE: 10, PAID: 30 };

/**
 * POST /assessments/start
 * Starts a new assessment session for the authenticated student.
 */
const startAssessment = async (req, res) => {
  try {
    const { accessLevel = 'FREE' } = req.body;

    // Verify student has completed onboarding
    const profile = await prisma.studentProfile.findUnique({ where: { userId: req.user.id } });
    if (!profile || !profile.isOnboardingComplete) {
      return errorResponse(res, 'Please complete your profile before starting assessment', 400, 'INCOMPLETE_PROFILE');
    }

    // Prevent multiple active assessments
    const existing = await prisma.assessment.findFirst({
      where: { userId: req.user.id, status: 'IN_PROGRESS' },
    });
    if (existing) {
      return successResponse(res, existing, 'Resume your existing assessment');
    }

    // If PAID, verify payment
    if (accessLevel === 'PAID') {
      const paidReport = await prisma.careerReport.findFirst({
        where: { userId: req.user.id, accessLevel: 'PAID' },
      });
      if (!paidReport) {
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
 */
const generateReportAsync = async (assessment, profile, reportId) => {
  try {
    const reportService = require('../services/report/reportGenerator');
    const reportData = await reportService.generateReport({
      assessment,
      profile,
      accessLevel: assessment.accessLevel,
    });

    await prisma.careerReport.update({
      where: { id: reportId },
      data: {
        reportData,
        status: 'COMPLETED',
        topCareers: reportData.topCareers || [],
        recommendedStream: reportData.recommendedStream || null,
        recommendedSubjects: reportData.recommendedSubjects || [],
        confidenceScore: reportData.confidenceScore || null,
        stemScore: reportData.scores?.stem || null,
        creativeScore: reportData.scores?.creative || null,
        socialScore: reportData.scores?.social || null,
        generatedAt: new Date(),
      },
    });

    logger.info('[Assessment] Report generated successfully', { reportId });
  } catch (err) {
    logger.error('[Assessment] Report generation failed', { reportId, error: err.message });
    await prisma.careerReport.update({
      where: { id: reportId },
      data: { status: 'FAILED' },
    });
  }
};

module.exports = { startAssessment, getAssessment, getNextQuestion, submitAnswer, completeAssessment };
