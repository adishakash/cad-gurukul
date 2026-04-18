'use strict';
const prisma = require('../config/database');
const { successResponse, errorResponse } = require('../utils/helpers');
const logger = require('../utils/logger');
const pdfGenerator = require('../services/report/pdfGenerator');
const { triggerAutomation } = require('../services/automation/automationService');

const formatRoadmapLabel = (key) => key
  .replace(/([A-Z])/g, ' $1')
  .replace(/^./, (char) => char.toUpperCase())
  .trim();

// ─────────────────────────────────────────────────────────────────────────────
// Career affinity: maps keyword fragments → { dimensionName: weight }
// Weights sum to 1.0 per career. Dimensions correspond to the scores object
// produced by the evaluation step (stem, creative, social, logical, analytical,
// leadership, communication, technical, entrepreneurial, research).
// Used ONLY for legacy free reports whose topCareers were stored as string arrays
// with no fitScore. The resulting score is derived from real AI-computed scores.
// ─────────────────────────────────────────────────────────────────────────────
const CAREER_AFFINITY = [
  { keywords: ['actor', 'actress', 'performer'],            dims: { creative: 0.5, social: 0.3, communication: 0.2 } },
  { keywords: ['artist', 'painter', 'sculptor', 'illustrator'], dims: { creative: 0.7, analytical: 0.2, technical: 0.1 } },
  { keywords: ['architect'],                                dims: { technical: 0.3, creative: 0.3, stem: 0.2, analytical: 0.2 } },
  { keywords: ['blogger', 'content', 'influencer', 'youtuber'], dims: { creative: 0.4, communication: 0.4, social: 0.2 } },
  { keywords: ['chef', 'cook', 'culinary', 'baker'],        dims: { creative: 0.5, entrepreneurial: 0.3, social: 0.2 } },
  { keywords: ['coach', 'trainer', 'fitness'],              dims: { social: 0.4, leadership: 0.3, communication: 0.3 } },
  { keywords: ['counsellor', 'therapist', 'psychologist'],  dims: { social: 0.5, communication: 0.3, research: 0.2 } },
  { keywords: ['data', 'analyst', 'analytics'],             dims: { analytical: 0.4, technical: 0.3, stem: 0.2, research: 0.1 } },
  { keywords: ['designer', 'ux', 'ui', 'graphic', 'fashion', 'interior'], dims: { creative: 0.5, technical: 0.3, analytical: 0.2 } },
  { keywords: ['director', 'filmmaker', 'producer'],        dims: { creative: 0.4, leadership: 0.3, communication: 0.2, entrepreneurial: 0.1 } },
  { keywords: ['doctor', 'physician', 'surgeon', 'medicine', 'medical'], dims: { stem: 0.4, social: 0.3, research: 0.2, analytical: 0.1 } },
  { keywords: ['economist', 'economist'],                   dims: { analytical: 0.4, research: 0.3, logical: 0.3 } },
  { keywords: ['engineer', 'engineering'],                  dims: { stem: 0.4, technical: 0.3, analytical: 0.2, logical: 0.1 } },
  { keywords: ['entrepreneur', 'startup', 'founder'],       dims: { entrepreneurial: 0.4, leadership: 0.3, creative: 0.2, communication: 0.1 } },
  { keywords: ['event', 'organiser', 'organizer', 'coordinator'], dims: { social: 0.4, leadership: 0.3, communication: 0.3 } },
  { keywords: ['financial', 'finance', 'banker', 'ca', 'accountant'], dims: { analytical: 0.4, logical: 0.3, technical: 0.2, stem: 0.1 } },
  { keywords: ['historian', 'archivist'],                   dims: { research: 0.5, analytical: 0.3, communication: 0.2 } },
  { keywords: ['hotel', 'hospitality', 'tourism'],          dims: { social: 0.5, communication: 0.3, leadership: 0.2 } },
  { keywords: ['journalist', 'reporter', 'news'],           dims: { communication: 0.5, social: 0.3, research: 0.2 } },
  { keywords: ['judge', 'lawyer', 'advocate', 'attorney', 'legal'], dims: { logical: 0.4, communication: 0.3, research: 0.2, analytical: 0.1 } },
  { keywords: ['manager', 'management', 'mba'],             dims: { leadership: 0.4, communication: 0.3, analytical: 0.2, entrepreneurial: 0.1 } },
  { keywords: ['marketing', 'brand', 'advertising'],        dims: { creative: 0.3, communication: 0.3, entrepreneurial: 0.2, analytical: 0.2 } },
  { keywords: ['musician', 'singer', 'composer', 'musician'], dims: { creative: 0.6, communication: 0.2, social: 0.2 } },
  { keywords: ['nurse', 'nursing'],                         dims: { social: 0.5, stem: 0.3, communication: 0.2 } },
  { keywords: ['photographer', 'cinematographer'],          dims: { creative: 0.5, technical: 0.3, entrepreneurial: 0.2 } },
  { keywords: ['pilot', 'aviation'],                        dims: { technical: 0.4, stem: 0.3, logical: 0.2, analytical: 0.1 } },
  { keywords: ['politician', 'diplomat', 'policy'],         dims: { communication: 0.4, social: 0.3, leadership: 0.3 } },
  { keywords: ['researcher', 'scientist', 'professor', 'academic'], dims: { research: 0.4, analytical: 0.3, stem: 0.2, logical: 0.1 } },
  { keywords: ['social worker', 'ngo', 'nonprofit'],        dims: { social: 0.5, communication: 0.3, leadership: 0.2 } },
  { keywords: ['software', 'developer', 'programmer', 'coder', 'fullstack', 'backend', 'frontend'], dims: { technical: 0.4, stem: 0.3, logical: 0.2, analytical: 0.1 } },
  { keywords: ['sports', 'athlete'],                        dims: { social: 0.3, leadership: 0.3, communication: 0.2, entrepreneurial: 0.2 } },
  { keywords: ['teacher', 'educator', 'lecturer', 'tutor'], dims: { social: 0.4, communication: 0.4, research: 0.2 } },
  { keywords: ['vet', 'veterinary', 'animal'],              dims: { stem: 0.4, social: 0.3, research: 0.3 } },
  { keywords: ['writer', 'author', 'novelist', 'poet'],     dims: { creative: 0.5, communication: 0.3, research: 0.2 } },
];

/**
 * Compute a deterministic fit score for a career string from real AI evaluation scores.
 * Only used for legacy free reports stored as string arrays.
 * Returns null when scores are unavailable so that nothing is shown rather than a fake value.
 */
const computeLegacyFitScore = (careerName, scores, position, totalCareers) => {
  if (!scores || typeof scores !== 'object') return null;
  const lc = careerName.toLowerCase();

  // Find best matching affinity rule
  const match = CAREER_AFFINITY.find((rule) => rule.keywords.some((kw) => lc.includes(kw)));

  let rawScore;
  if (match) {
    // Weighted sum of real AI score dimensions
    rawScore = Object.entries(match.dims).reduce((sum, [dim, weight]) => {
      const dimScore = typeof scores[dim] === 'number' ? scores[dim] : 50; // 50 = neutral if dim missing
      return sum + dimScore * weight;
    }, 0);
  } else {
    // Unrecognised career: use average of all available score dimensions
    const values = Object.values(scores).filter((v) => typeof v === 'number');
    if (values.length === 0) return null;
    rawScore = values.reduce((a, b) => a + b, 0) / values.length;
  }

  // Apply a mild positional decay: first career ranked highest by AI is best match
  // decay: 0 → 0%, last position → −10% (linear), capped at 10 point spread across list
  const decayFactor = totalCareers > 1 ? (position / (totalCareers - 1)) * 0.10 : 0;
  const finalScore = Math.round(rawScore * (1 - decayFactor));
  return Math.min(99, Math.max(1, finalScore));
};

const normalizeCareerEntry = (career, index, scores, totalCareers) => {
  if (typeof career === 'string') {
    return {
      name: career,
      description: 'Suggested based on your assessment answers.',
      fitScore: computeLegacyFitScore(career, scores, index, totalCareers),
      stream: null,
      subjects: [],
    };
  }

  if (!career || typeof career !== 'object') return null;

  return {
    ...career,
    name: career.name || career.title || `Career Match ${index + 1}`,
    description: career.description || career.reason || career.indiaScope || 'Suggested based on your assessment answers.',
    fitScore: typeof career.fitScore === 'number' ? career.fitScore : null,
    stream: career.stream || null,
    subjects: Array.isArray(career.subjects) ? career.subjects : [],
  };
};

const normalizeTopCareers = (reportData) => {
  const rawTopCareers = Array.isArray(reportData?.topCareers)
    ? reportData.topCareers
    : Array.isArray(reportData?.careers)
      ? reportData.careers
      : [];
  const scores = reportData?.scores || null;

  return rawTopCareers
    .map((career, index) => normalizeCareerEntry(career, index, scores, rawTopCareers.length))
    .filter(Boolean);
};

const normalizeEvaluation = (reportData) => {
  const categoryScores = reportData?.evaluation?.categoryScores || reportData?.scores || null;

  if (!categoryScores && !reportData?.evaluation) return null;

  return {
    ...(reportData?.evaluation || {}),
    categoryScores: categoryScores || {},
    recommendedStream: reportData?.evaluation?.recommendedStream || reportData?.streamRecommendation || reportData?.recommendedStream || null,
  };
};

const normalizeRoadmaps = (reportData) => {
  if (Array.isArray(reportData?.roadmaps) && reportData.roadmaps.length > 0) {
    return reportData.roadmaps;
  }

  if (Array.isArray(reportData?.yearWiseRoadmap) && reportData.yearWiseRoadmap.length > 0) {
    return reportData.yearWiseRoadmap.map((entry, index) => ({
      career: entry.year || `Roadmap ${index + 1}`,
      steps: [
        ...(Array.isArray(entry.goals) ? entry.goals.map((item) => `Goal: ${item}`) : []),
        ...(Array.isArray(entry.actions) ? entry.actions.map((item) => `Action: ${item}`) : []),
        ...(Array.isArray(entry.milestones) ? entry.milestones.map((item) => `Milestone: ${item}`) : []),
      ],
    }));
  }

  const sections = [];

  if (reportData?.oneYearRoadmap && typeof reportData.oneYearRoadmap === 'object') {
    sections.push({
      career: '1-Year Action Plan',
      steps: Object.entries(reportData.oneYearRoadmap).map(([key, value]) => `${formatRoadmapLabel(key)}: ${value}`),
    });
  }

  if (reportData?.threeYearRoadmap && typeof reportData.threeYearRoadmap === 'object') {
    sections.push({
      career: '3-Year Career Roadmap',
      steps: Object.entries(reportData.threeYearRoadmap).map(([key, value]) => `${formatRoadmapLabel(key)}: ${value}`),
    });
  }

  return sections;
};

const normalizeReportData = (reportData) => ({
  ...(reportData || {}),
  topCareers: normalizeTopCareers(reportData),
  evaluation: normalizeEvaluation(reportData),
  roadmaps: normalizeRoadmaps(reportData),
});

/**
 * GET /reports/my
 * List all reports for the current student.
 */
const getMyReports = async (req, res) => {
  try {
    const reports = await prisma.careerReport.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        assessmentId: true,
        accessLevel: true,
        status: true,
        topCareers: true,
        recommendedStream: true,
        confidenceScore: true,
        generatedAt: true,
        createdAt: true,
      },
    });

    return successResponse(res, reports);
  } catch (err) {
    logger.error('[Report] getMyReports error', { error: err.message });
    throw err;
  }
};

/**
 * GET /reports/:id
 * Fetch the career report. Free reports get limited data; paid reports get full data.
 */
const getReport = async (req, res) => {
  try {
    const report = await prisma.careerReport.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!report) {
      return errorResponse(res, 'Report not found', 404, 'NOT_FOUND');
    }

    if (report.status === 'GENERATING') {
      return successResponse(res, { status: 'GENERATING', message: 'Report is being generated, please wait...' });
    }

    if (report.status === 'FAILED') {
      return errorResponse(res, 'Report generation failed. Please contact support.', 500, 'REPORT_FAILED');
    }

    const reportData = report.reportData;
    const normalizedReportData = normalizeReportData(reportData);

    // For free reports — return a limited subset + trigger re-engagement automation
    if (report.accessLevel === 'FREE') {
      // Fire upgrade nudge WhatsApp (non-blocking, only if not already paid)
      try {
        const lead = await prisma.lead.findFirst({ where: { userId: req.user.id } });
        if (lead && !['paid', 'premium_report_generating', 'premium_report_ready', 'counselling_interested'].includes(lead.status)) {
          triggerAutomation('free_report_viewed', { leadId: lead.id, userId: req.user.id }).catch(() => {});
        }
      } catch (_) { /* non-fatal */ }

      // ── Determine user's true entitlement from lead ──────────────────────
      // IMPORTANT: Lead.planType has a DB-level DEFAULT 'standard', so ALL leads
      // (including free users who never paid) have planType = 'standard'.
      // We must use lead.status as the primary payment indicator, and planType only
      // to distinguish *which* plan was purchased for users who have actually paid.
      const PAID_STATUSES = ['payment_pending', 'paid', 'premium_report_generating', 'premium_report_ready', 'counselling_interested', 'closed'];
      let userPlanType = 'free';
      let consultationPurchased = false;
      let hasPaidPlan = false;
      try {
        const leadForPlan = await prisma.lead.findFirst({
          where: { userId: req.user.id },
          select: { planType: true, status: true },
        });
        const userHasPaid = PAID_STATUSES.includes(leadForPlan?.status);
        // Only trust planType when status confirms payment; otherwise treat as free
        userPlanType = userHasPaid ? (leadForPlan?.planType || 'standard') : 'free';
        consultationPurchased = userPlanType === 'consultation';
        hasPaidPlan = userHasPaid;
      } catch (_) { /* non-fatal */ }

      const freeView = {
        id: report.id,
        assessmentId: report.assessmentId,
        accessLevel: 'FREE',
        reportType: 'free',
        status: report.status,
        generatedAt: report.generatedAt,
        studentSummary: normalizedReportData.studentSummary,
        interestAnalysis: normalizedReportData.interestAnalysis,
        recommendedStream: normalizedReportData.recommendedStream || normalizedReportData.streamRecommendation || null,
        evaluation: normalizedReportData.evaluation,
        roadmaps: normalizedReportData.roadmaps,
        topCareers: normalizedReportData.topCareers.slice(0, 3),
        confidenceScore: report.confidenceScore,
        userPlanType,
        consultationPurchased,
        // Suppress upgrade CTAs for users who have already purchased a paid plan.
        // Their paid/premium/consultation report is either generating or delivered separately.
        upgradeCTA: hasPaidPlan ? null : {
          message: 'Based on your answers, you are NOT suited for random stream selection. Unlock your exact career path — stream, subjects, 3-year roadmap, and top colleges.',
          standard: { price: '₹499', label: 'Full Report' },
          premium:  { price: '₹1,999', label: 'Premium AI Report' },
          urgency: '47 students from your city upgraded this week.',
          lockedSections: ['4 more career matches', 'Aptitude radar chart', '3-year career roadmap', 'Subject recommendations', 'College suggestions', 'Parent guidance', 'PDF download'],
        },
      };
      return successResponse(res, freeView);
    }

    // ── PAID report (standard ₹499 or premium ₹1,999) ─────────────────────────
    const reportType = report.reportType || 'standard';

    // Fetch the user's current plan type to suppress inappropriate upsells.
    // IMPORTANT: Lead.planType defaults to 'standard' in DB for all rows — must
    // check lead.status to confirm the user actually paid before trusting planType.
    const PAID_STATUSES_PAID = ['payment_pending', 'paid', 'premium_report_generating', 'premium_report_ready', 'counselling_interested', 'closed'];
    let userPlanType = reportType; // safe default: at minimum they paid for this report tier
    let consultationPurchased = false;
    try {
      const leadForPlan = await prisma.lead.findFirst({
        where: { userId: req.user.id },
        select: { planType: true, status: true },
      });
      const userHasPaid = PAID_STATUSES_PAID.includes(leadForPlan?.status);
      // Use planType to detect tier upgrades (e.g. standard report holder who later
      // bought consultation) — but only if lead.status confirms payment.
      userPlanType = userHasPaid ? (leadForPlan?.planType || reportType) : reportType;
      consultationPurchased = userPlanType === 'consultation';
    } catch (_) { /* non-fatal — don't break report delivery */ }

    // Show standard → premium upsell ONLY when:
    //  - this is a standard-tier report, AND
    //  - the user has NOT already purchased premium or consultation
    const premiumUpsell = (
      reportType === 'standard' &&
      !['premium', 'consultation'].includes(userPlanType)
    )
      ? {
          show: true,
          price: '₹1,999',
          headline: 'Unlock your Deep AI Career Blueprint',
          benefits: [
            'Year-by-year roadmap from Class 11 → first job',
            'Subject strategy with must-take vs avoid list',
            'Competitive exam timeline (JEE/NEET/CAT)',
            'Scholarship opportunities',
            'Exhaustive 7+ career matches with salary outlook',
          ],
        }
      : null;

    return successResponse(res, {
      id: report.id,
      assessmentId: report.assessmentId,
      accessLevel: 'PAID',
      reportType,
      userPlanType,
      consultationPurchased,
      ...normalizedReportData,
      premiumUpsell,
      generatedAt: report.generatedAt,
    });
  } catch (err) {
    logger.error('[Report] getReport error', { error: err.message });
    throw err;
  }
};

/**
 * GET /reports/:id/pdf
 * Generate and stream PDF for PAID reports.
 */
const downloadReportPdf = async (req, res) => {
  try {
    const report = await prisma.careerReport.findFirst({
      where: { id: req.params.id, userId: req.user.id, accessLevel: 'PAID', status: 'COMPLETED' },
    });

    if (!report) {
      return errorResponse(res, 'Paid report not found. Please upgrade to access PDF download.', 403, 'FORBIDDEN');
    }

    const profile = await prisma.studentProfile.findUnique({ where: { userId: req.user.id } });

    const pdfBuffer = await pdfGenerator.generatePdf(report.reportData, profile);

    // Log download
    await prisma.reportDownload.create({
      data: {
        reportId: report.id,
        userId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="CAD-Gurukul-Report-${profile.fullName.replace(/\s+/g, '-')}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    return res.end(pdfBuffer);
  } catch (err) {
    logger.error('[Report] downloadReportPdf error', { error: err.message });
    throw err;
  }
};

/**
 * GET /reports/:id/status
 * Lightweight status-only endpoint for frontend polling during report generation.
 */
const getReportStatus = async (req, res) => {
  try {
    const report = await prisma.careerReport.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      select: { id: true, status: true, accessLevel: true, generatedAt: true },
    });

    if (!report) return errorResponse(res, 'Report not found', 404, 'NOT_FOUND');

    return successResponse(res, report);
  } catch (err) {
    logger.error('[Report] getReportStatus error', { error: err.message });
    throw err;
  }
};

module.exports = { getMyReports, getReport, getReportStatus, downloadReportPdf };
