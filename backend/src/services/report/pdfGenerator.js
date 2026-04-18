'use strict';
const fs = require('fs');
const puppeteer = require('puppeteer');
const logger = require('../../utils/logger');

/**
 * Resolve the Chromium/Chrome executable path.
 *
 * Priority:
 *  1. PUPPETEER_EXECUTABLE_PATH env var (set in Dockerfile ENV for Alpine containers)
 *  2. Probe common system paths (Alpine apk chromium, Debian apt chromium)
 *  3. Let Puppeteer use its own bundled Chromium (local dev without skip flag)
 */
const resolveChromiumPath = () => {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  const candidates = [
    '/usr/bin/chromium-browser',    // Alpine: apk add chromium (used in Dockerfile)
    '/usr/bin/chromium',            // Some Alpine versions
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
  ];
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p; } catch (_) { /* ignore */ }
  }
  return undefined; // fall back to Puppeteer bundled binary (local dev)
};

/**
 * Generates a PDF from the career report data.
 * Returns a Buffer containing the PDF bytes.
 */
const generatePdf = async (reportData, profile) => {
  logger.info('[PDFGenerator] Generating PDF report', { userId: profile.userId });

  const html = buildReportHtml(reportData, profile);
  const executablePath = resolveChromiumPath();

  logger.info('[PDFGenerator] Using Chromium', { executablePath: executablePath || 'puppeteer-bundled' });

  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(60000);
    // Use domcontentloaded — our HTML is fully self-contained (no external resources)
    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
    });

    logger.info('[PDFGenerator] PDF generated successfully');
    return Buffer.from(pdfBuffer); // ensure Buffer for res.end() + Content-Length
  } finally {
    await browser.close();
  }
};

/**
 * Build HTML template for the career report
 */
const buildReportHtml = (report, profile) => {
  const topCareers = (report.topCareers || [])
    .map((career) => {
      if (typeof career === 'string') {
        return `<li class="career-item"><strong>${career}</strong></li>`;
      }
      return `
        <li class="career-item">
          <div class="career-header">
            <strong>${career.name || career.title || ''}</strong>
            <span class="fit-score">${career.fitScore != null ? `Fit Score: ${career.fitScore}%` : ''}</span>
          </div>
          <p>${career.reason || ''}</p>
          ${career.coursePath ? `<p><em>Path: ${career.coursePath}</em></p>` : ''}
          ${career.indiaScope ? `<p><em>India Scope: ${career.indiaScope}</em></p>` : ''}
        </li>`;
    })
    .join('');

  const roadmapHtml = report.oneYearRoadmap
    ? `
    <div class="section">
      <h2>📅 1-Year Roadmap</h2>
      <ul>
        <li><strong>Q1 (Months 1-3):</strong> ${report.oneYearRoadmap.quarter1 || ''}</li>
        <li><strong>Q2 (Months 4-6):</strong> ${report.oneYearRoadmap.quarter2 || ''}</li>
        <li><strong>Q3 (Months 7-9):</strong> ${report.oneYearRoadmap.quarter3 || ''}</li>
        <li><strong>Q4 (Months 10-12):</strong> ${report.oneYearRoadmap.quarter4 || ''}</li>
      </ul>
    </div>
    <div class="section">
      <h2>🚀 3-Year Roadmap</h2>
      <ul>
        <li><strong>Year 1:</strong> ${report.threeYearRoadmap?.year1 || ''}</li>
        <li><strong>Year 2:</strong> ${report.threeYearRoadmap?.year2 || ''}</li>
        <li><strong>Year 3:</strong> ${report.threeYearRoadmap?.year3 || ''}</li>
      </ul>
    </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>CAD Gurukul – Career Guidance Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; background: #fff; font-size: 13px; line-height: 1.6; }
    .cover { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); color: #fff; padding: 60px 40px; text-align: center; }
    .cover h1 { font-size: 32px; color: #e94560; margin-bottom: 8px; }
    .cover .subtitle { font-size: 16px; color: #a8b2d8; margin-bottom: 30px; }
    .cover .student-name { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
    .cover .student-meta { font-size: 14px; color: #ccd6f6; }
    .cover .report-badge { display: inline-block; background: #e94560; color: #fff; padding: 6px 20px; border-radius: 20px; font-size: 12px; font-weight: 700; margin-top: 20px; letter-spacing: 2px; }
    .content { padding: 30px 40px; }
    .section { margin-bottom: 28px; border-left: 4px solid #e94560; padding-left: 16px; }
    .section h2 { font-size: 18px; color: #0f3460; margin-bottom: 10px; }
    .section p { margin-bottom: 8px; color: #333; }
    .score-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 12px; }
    .score-card { background: #f0f4ff; border-radius: 8px; padding: 12px; text-align: center; }
    .score-card .label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
    .score-card .value { font-size: 22px; font-weight: 700; color: #0f3460; }
    .highlight-box { background: #fff8f0; border: 1px solid #ffd0a0; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
    .career-list { list-style: none; }
    .career-item { background: #f8f9ff; border: 1px solid #e0e7ff; border-radius: 8px; padding: 14px; margin-bottom: 10px; }
    .career-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .fit-score { background: #0f3460; color: #fff; padding: 2px 10px; border-radius: 12px; font-size: 11px; }
    ul.action-list li { margin-bottom: 6px; padding-left: 8px; }
    .parent-section { background: #f0fff4; border: 1px solid #b7dfc3; border-radius: 8px; padding: 16px; }
    .footer { background: #1a1a2e; color: #a8b2d8; text-align: center; padding: 20px; font-size: 11px; }
    .confidence-badge { display: inline-block; background: #22c55e; color: #fff; padding: 4px 16px; border-radius: 20px; font-weight: 700; font-size: 14px; }
    .page-break { page-break-before: always; }
    .tag { display: inline-block; background: #e0e7ff; color: #4338ca; padding: 2px 10px; border-radius: 10px; font-size: 11px; margin: 2px; }
  </style>
</head>
<body>

<!-- Cover Page -->
<div class="cover">
  <h1>CAD Gurukul</h1>
  <p class="subtitle">AI-Powered Career Guidance Platform for Indian Students</p>
  <div class="student-name">${profile.fullName}</div>
  <div class="student-meta">
    ${profile.classStandard?.replace('_', ' ') || ''} &bull; ${profile.board || ''} &bull; ${profile.city || ''}, ${profile.state || ''}
  </div>
  <div class="report-badge">✦ PREMIUM CAREER REPORT ✦</div>
  <p style="margin-top:20px; font-size:12px; color:#8892b0;">Generated on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
  <div style="margin-top:16px;">
    Confidence Score: <span class="confidence-badge">${report.confidenceScore || 80}%</span>
  </div>
</div>

<div class="content">

  <!-- Student Summary -->
  <div class="section">
    <h2>👤 Student Profile Summary</h2>
    <p>${report.studentSummary || ''}</p>
  </div>

  <!-- Interest Analysis -->
  <div class="section">
    <h2>🎯 Interest Analysis</h2>
    <p>${report.interestAnalysis || ''}</p>
  </div>

  <!-- Aptitude Analysis -->
  ${report.aptitudeAnalysis ? `<div class="section"><h2>🧠 Aptitude Analysis</h2><p>${report.aptitudeAnalysis}</p></div>` : ''}

  <!-- Personality Insights -->
  ${report.personalityInsights ? `<div class="section"><h2>🌟 Personality Insights</h2><p>${report.personalityInsights}</p><p><strong>Type:</strong> ${report.personalityType || ''} &bull; <strong>Learning Style:</strong> ${report.learningStyle || ''}</p></div>` : ''}

  <!-- Scores -->
  ${report.scores ? `
  <div class="section">
    <h2>📊 Skill & Aptitude Scores</h2>
    <div class="score-grid">
      ${Object.entries(report.scores).map(([k, v]) => `<div class="score-card"><div class="label">${k}</div><div class="value">${v}</div></div>`).join('')}
    </div>
  </div>` : ''}

  <!-- Recommended Stream -->
  <div class="section">
    <h2>🎓 Recommended Stream</h2>
    <div class="highlight-box">
      <strong style="font-size:18px; color:#0f3460;">${report.recommendedStream || ''}</strong>
      <p style="margin-top:8px;">${report.streamReason || ''}</p>
    </div>
    ${report.recommendedSubjects?.length ? `
    <p><strong>Recommended Subjects:</strong></p>
    <div>${(report.recommendedSubjects || []).map((s) => `<span class="tag">${s}</span>`).join('')}</div>
    <p style="margin-top:8px;">${report.subjectReason || ''}</p>` : ''}
  </div>

  <div class="page-break"></div>

  <!-- Top Careers -->
  <div class="section">
    <h2>🚀 Top Career Recommendations</h2>
    <ul class="career-list">${topCareers}</ul>
  </div>

  <!-- Higher Education -->
  ${report.higherEducationDirection ? `<div class="section"><h2>🏫 Higher Education Direction</h2><p>${report.higherEducationDirection}</p></div>` : ''}

  <!-- Skill Gaps -->
  ${report.skillGaps?.length ? `
  <div class="section">
    <h2>⚡ Skill Gaps to Address</h2>
    <div>${(report.skillGaps || []).map((s) => `<span class="tag">⚠ ${s}</span>`).join('')}</div>
    ${report.skillDevelopmentPlan ? `<p style="margin-top:10px;">${report.skillDevelopmentPlan}</p>` : ''}
  </div>` : ''}

  <!-- Roadmaps -->
  ${roadmapHtml}

  <!-- Action Steps -->
  ${report.actionableNextSteps?.length ? `
  <div class="section">
    <h2>✅ Actionable Next Steps</h2>
    <ul class="action-list">
      ${(report.actionableNextSteps || []).map((s, i) => `<li>${i + 1}. ${s}</li>`).join('')}
    </ul>
  </div>` : ''}

  <!-- Parent Guidance -->
  ${report.parentGuidance ? `
  <div class="section">
    <h2>👨‍👩‍👧 Parent Guidance</h2>
    <div class="parent-section">${report.parentGuidance}</div>
  </div>` : ''}

  <!-- Motivational Message -->
  ${report.motivationalMessage ? `
  <div class="section">
    <h2>💫 A Message for You</h2>
    <blockquote style="border-left:4px solid #e94560; padding-left:16px; font-style:italic; color:#444;">${report.motivationalMessage}</blockquote>
  </div>` : ''}

</div>

<div class="footer">
  <p>CAD Gurukul | AI Career Guidance for Indian Students</p>
  <p>This report is generated by AI and should be used as a guidance tool alongside professional counselling.</p>
  <p>© ${new Date().getFullYear()} CAD Gurukul. All rights reserved.</p>
</div>

</body>
</html>`;
};

module.exports = { generatePdf };
