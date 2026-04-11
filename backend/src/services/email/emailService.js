'use strict';
const nodemailer = require('nodemailer');
const config = require('../../config');
const logger = require('../../utils/logger');

const transporter = nodemailer.createTransport({
  host: config.email.host,
  port: config.email.port,
  secure: config.email.secure,
  auth: { user: config.email.user, pass: config.email.pass },
});

/**
 * Send a generic email
 */
const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const info = await transporter.sendMail({
      from: config.email.from,
      to,
      subject,
      html,
      text,
    });
    logger.info('[Email] Sent', { to, subject, messageId: info.messageId });
    return info;
  } catch (err) {
    logger.error('[Email] Failed to send', { to, subject, error: err.message });
    throw err;
  }
};

/**
 * Send welcome email after registration
 */
const sendWelcomeEmail = async ({ to, name }) => {
  return sendEmail({
    to,
    subject: 'Welcome to CAD Gurukul – Start Your Career Journey',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
        <div style="background:#0f3460;padding:30px;text-align:center;">
          <h1 style="color:#e94560;margin:0;">CAD Gurukul</h1>
          <p style="color:#ccd6f6;margin:8px 0 0;">AI Career Guidance for Indian Students</p>
        </div>
        <div style="padding:30px;">
          <h2>Welcome, ${name}! 🎓</h2>
          <p>You're all set to discover your ideal career path with the help of our AI-powered assessment.</p>
          <p>Here's what to do next:</p>
          <ol>
            <li>Complete your profile in the Student Dashboard</li>
            <li>Start your FREE career assessment</li>
            <li>Receive your personalized Career Guidance Report</li>
          </ol>
          <p style="margin-top:24px;"><a href="${config.frontendUrl}/dashboard" style="background:#e94560;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">Go to Dashboard</a></p>
        </div>
        <div style="background:#f5f5f5;padding:16px;text-align:center;font-size:12px;color:#888;">
          © ${new Date().getFullYear()} CAD Gurukul. All rights reserved.
        </div>
      </div>
    `,
  });
};

/**
 * Send report ready notification
 */
const sendReportReadyEmail = async ({ to, name, reportId, accessLevel }) => {
  return sendEmail({
    to,
    subject: `Your ${accessLevel === 'PAID' ? 'Premium' : 'Free'} Career Report is Ready!`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
        <div style="background:#0f3460;padding:30px;text-align:center;">
          <h1 style="color:#e94560;margin:0;">CAD Gurukul</h1>
        </div>
        <div style="padding:30px;">
          <h2>Your Career Report is Ready, ${name}! 🎉</h2>
          <p>Your ${accessLevel === 'PAID' ? 'comprehensive Premium' : 'Free Summary'} Career Guidance Report has been generated.</p>
          ${accessLevel === 'PAID' ? '<p>Download your detailed PDF report from the dashboard.</p>' : '<p>Upgrade to Premium for a complete analysis with roadmaps, detailed career fits, and PDF download.</p>'}
          <p style="margin-top:24px;"><a href="${config.frontendUrl}/reports/${reportId}" style="background:#e94560;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">View My Report</a></p>
        </div>
        <div style="background:#f5f5f5;padding:16px;text-align:center;font-size:12px;color:#888;">
          © ${new Date().getFullYear()} CAD Gurukul
        </div>
      </div>
    `,
  });
};

module.exports = { sendEmail, sendWelcomeEmail, sendReportReadyEmail };
