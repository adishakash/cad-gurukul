'use strict';
const prisma = require('../config/database');
const { successResponse, errorResponse } = require('../utils/helpers');
const logger = require('../utils/logger');
const pdfGenerator = require('../services/report/pdfGenerator');

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

    // For free reports — return a limited subset
    if (report.accessLevel === 'FREE') {
      const freeView = {
        id: report.id,
        assessmentId: report.assessmentId,
        accessLevel: 'FREE',
        status: report.status,
        generatedAt: report.generatedAt,
        studentSummary: reportData?.studentSummary,
        interestAnalysis: reportData?.interestAnalysis,
        recommendedStream: reportData?.recommendedStream,
        topCareers: (reportData?.topCareers || []).slice(0, 3),
        confidenceScore: report.confidenceScore,
        upgradeCTA: {
          message: 'Upgrade to Paid report to unlock full career analysis, roadmaps, subject recommendations, and PDF download.',
          price: '₹499',
        },
      };
      return successResponse(res, freeView);
    }

    // Full paid report
    return successResponse(res, {
      id: report.id,
      assessmentId: report.assessmentId,
      accessLevel: 'PAID',
      ...reportData,
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
