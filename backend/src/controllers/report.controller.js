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

const normalizeCareerEntry = (career, index) => {
  if (typeof career === 'string') {
    return {
      name: career,
      description: 'Suggested based on your assessment answers.',
      fitScore: null,
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

  return rawTopCareers
    .map((career, index) => normalizeCareerEntry(career, index))
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
        upgradeCTA: {
          message: 'Based on your answers, you are NOT suited for random stream selection. Unlock your exact career path — stream, subjects, 3-year roadmap, and top colleges.',
          standard: { price: '₹499', label: 'Full Report' },
          premium:  { price: '₹1,999', label: 'Premium AI Report' },
          urgency: '47 students from your city upgraded this week.',
          lockedSections: ['4 more career matches', 'Aptitude radar chart', '3-year career roadmap', 'Subject recommendations', 'College suggestions', 'Parent guidance', 'PDF download'],
        },
      };
      return successResponse(res, freeView);
    }

    // PAID report (standard ₹499 or premium ₹1,999)
    const reportType = report.reportType || 'standard';

    // For standard-paid users: add upsell nudge to upgrade to premium
    const premiumUpsell = reportType === 'standard'
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
