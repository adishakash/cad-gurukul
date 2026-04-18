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

// ─────────────────────────────────────────────────────────────────────────────
// CONSULTATION EMAILS — Phase 7
// ─────────────────────────────────────────────────────────────────────────────

const SLOT_LABELS = {
  morning_9_12:  'Morning — 9:00 AM to 12:00 PM',
  afternoon_2_5: 'Afternoon — 2:00 PM to 5:00 PM',
  evening_6_9:   'Evening — 6:00 PM to 9:00 PM',
};

const emailHeader = `
  <div style="background:#0f3460;padding:28px 30px;text-align:center;">
    <h1 style="color:#e94560;margin:0;font-family:Arial,sans-serif;font-size:26px;">CAD Gurukul</h1>
    <p style="color:#ccd6f6;margin:6px 0 0;font-size:13px;font-family:Arial,sans-serif;">AI Career Guidance for Indian Students</p>
  </div>`;

const emailFooter = `
  <div style="background:#f5f5f5;padding:16px;text-align:center;font-size:12px;color:#888;font-family:Arial,sans-serif;">
    © ${new Date().getFullYear()} CAD Gurukul. All rights reserved.<br>
    If you did not make this booking, please contact us at <a href="mailto:support@cadgurukul.com" style="color:#e94560;">support@cadgurukul.com</a>
  </div>`;

/**
 * Send slot-selection email to student (and optionally parent) after consultation purchase.
 * The email contains a link to the slot-selection page; the student picks their preferred window.
 */
const sendConsultationSlotEmail = async ({
  to,
  name,
  slotToken,
  counsellorName,
  counsellorExpertise,
  counsellorContact,
  isParent = false,
  studentName,
}) => {
  const selectionUrl = `${config.frontendUrl}/consultation/select-slot?token=${slotToken}`;
  const greeting = isParent ? `Hi ${name},` : `Hi ${name}! 🎉`;
  const intro = isParent
    ? `Your ward <strong>${studentName}</strong> has booked a 1:1 Career Blueprint Session with <strong>${counsellorName}</strong>. Please help them select a preferred time slot.`
    : `Your ₹9,999 Career Blueprint Session with <strong>${counsellorName}</strong> has been confirmed! Please select a time slot that works best for you.`;

  return sendEmail({
    to,
    subject: `📅 Select Your Career Session Slot — Action Required`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;border:1px solid #e8e8e8;border-radius:8px;overflow:hidden;">
        ${emailHeader}
        <div style="padding:30px;">
          <p style="font-size:16px;color:#1a1a2e;margin:0 0 8px;">${greeting}</p>
          <p style="color:#444;font-size:14px;line-height:1.6;">${intro}</p>

          <!-- Counsellor card -->
          <div style="background:#f0f4ff;border-radius:8px;padding:18px;margin:20px 0;border-left:4px solid #0f3460;">
            <div style="font-size:13px;font-weight:bold;color:#0f3460;margin-bottom:6px;">YOUR COUNSELLOR</div>
            <div style="font-size:16px;font-weight:bold;color:#1a1a2e;">👨‍💼 ${counsellorName}</div>
            <div style="font-size:13px;color:#555;margin-top:4px;">${counsellorExpertise}</div>
            <div style="font-size:13px;color:#e94560;margin-top:6px;">📧 ${counsellorContact}</div>
          </div>

          <!-- What to expect -->
          <div style="margin:20px 0;">
            <div style="font-size:13px;font-weight:bold;color:#0f3460;margin-bottom:8px;">WHAT TO EXPECT IN YOUR SESSION</div>
            <ul style="font-size:13px;color:#555;line-height:1.8;padding-left:18px;margin:0;">
              <li>45-minute personalised career blueprint discussion</li>
              <li>Parents are welcome to join the session</li>
              <li>Session recording sent to your email within 24 hours</li>
              <li>30-day email support after the session</li>
            </ul>
          </div>

          <!-- Slot selection CTA -->
          <div style="margin:24px 0;">
            <div style="font-size:14px;font-weight:bold;color:#1a1a2e;margin-bottom:12px;">📅 SELECT YOUR PREFERRED TIME SLOT</div>
            <p style="font-size:13px;color:#555;margin:0 0 16px;">Click the button below to view available time slots and book your session:</p>
            <a href="${selectionUrl}"
               style="display:inline-block;background:#e94560;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;letter-spacing:0.3px;">
              📅 Choose My Time Slot →
            </a>
            <p style="font-size:11px;color:#999;margin:12px 0 0;">
              Or copy this link: <span style="color:#0f3460;">${selectionUrl}</span>
            </p>
          </div>

          <div style="background:#fffbea;border:1px solid #fde68a;border-radius:6px;padding:12px 16px;font-size:12px;color:#92400e;margin-top:20px;">
            ⏰ <strong>Please select your slot within 48 hours.</strong> Our team will send you the exact meeting link and date within 24 hours of your selection.
          </div>
        </div>
        ${emailFooter}
      </div>
    `,
  });
};

/**
 * Send confirmation email after the student selects a slot.
 */
const sendSlotConfirmationEmail = async ({
  to,
  name,
  slot,
  slotLabel,
  counsellorName,
  counsellorContact,
  isParent = false,
  studentName,
}) => {
  const label = SLOT_LABELS[slot] || slotLabel || slot;
  const subject = isParent
    ? `✅ Career Session Slot Confirmed for ${studentName} — ${label}`
    : `✅ Your Career Session Slot is Confirmed! — ${label}`;

  const greeting = isParent ? `Hi ${name},` : `Great choice, ${name}! ✅`;
  const confirmText = isParent
    ? `Your ward <strong>${studentName}</strong> has confirmed their Career Blueprint Session with <strong>${counsellorName}</strong>.`
    : `You have confirmed your 1:1 Career Blueprint Session with <strong>${counsellorName}</strong>.`;

  return sendEmail({
    to,
    subject,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;border:1px solid #e8e8e8;border-radius:8px;overflow:hidden;">
        ${emailHeader}
        <div style="padding:30px;">
          <p style="font-size:16px;color:#1a1a2e;margin:0 0 8px;">${greeting}</p>
          <p style="color:#444;font-size:14px;line-height:1.6;">${confirmText}</p>

          <!-- Slot confirmed badge -->
          <div style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:8px;padding:18px;margin:20px 0;text-align:center;">
            <div style="font-size:28px;margin-bottom:8px;">🗓️</div>
            <div style="font-size:13px;font-weight:bold;color:#065f46;letter-spacing:0.5px;">SELECTED SLOT</div>
            <div style="font-size:18px;font-weight:bold;color:#1a1a2e;margin-top:4px;">${label}</div>
          </div>

          <!-- Counsellor contact -->
          <div style="background:#f0f4ff;border-radius:8px;padding:16px;margin-bottom:20px;">
            <div style="font-size:13px;font-weight:bold;color:#0f3460;margin-bottom:6px;">YOUR COUNSELLOR</div>
            <div style="font-size:15px;font-weight:bold;color:#1a1a2e;">👨‍💼 ${counsellorName}</div>
            <div style="font-size:13px;color:#e94560;margin-top:4px;">📧 ${counsellorContact}</div>
          </div>

          <!-- What happens next -->
          <div style="font-size:13px;font-weight:bold;color:#0f3460;margin-bottom:8px;">WHAT HAPPENS NEXT</div>
          <ol style="font-size:13px;color:#555;line-height:1.9;padding-left:18px;margin:0 0 20px;">
            <li>Our team will confirm the exact meeting date &amp; time within 24 hours</li>
            <li>You will receive a Zoom/Meet link by email before the session</li>
            <li>Prepare any questions about your career path, stream selection, or college options</li>
            <li>Parents are encouraged to join — it helps us give the best advice</li>
          </ol>

          <div style="background:#fffbea;border:1px solid #fde68a;border-radius:6px;padding:12px 16px;font-size:12px;color:#92400e;">
            Questions? Reach us at <a href="mailto:${counsellorContact}" style="color:#e94560;">${counsellorContact}</a>
          </div>
        </div>
        ${emailFooter}
      </div>
    `,
  });
};

/**
 * Send an internal notification to the company email when a student selects a slot.
 */
const sendAdminSlotNotification = async ({
  studentName,
  studentEmail,
  slot,
  slotLabel,
  bookingId,
}) => {
  const label = SLOT_LABELS[slot] || slotLabel || slot;
  const adminEmail = config.email.from?.match(/<(.+?)>/)?.[1] || config.email.user || 'noreply@cadgurukul.com';

  return sendEmail({
    to: adminEmail,
    subject: `[Action Required] New Slot Selected — ${studentName} — ${label}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;">
        ${emailHeader}
        <div style="padding:24px;">
          <h2 style="color:#1a1a2e;margin:0 0 16px;">📌 New Consultation Slot Selected</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr><td style="padding:8px 0;color:#555;width:140px;">Student</td><td style="padding:8px 0;font-weight:bold;color:#1a1a2e;">${studentName}</td></tr>
            <tr><td style="padding:8px 0;color:#555;">Email</td><td style="padding:8px 0;color:#0f3460;">${studentEmail || 'N/A'}</td></tr>
            <tr><td style="padding:8px 0;color:#555;">Slot</td><td style="padding:8px 0;font-weight:bold;color:#e94560;">${label}</td></tr>
            <tr><td style="padding:8px 0;color:#555;">Booking ID</td><td style="padding:8px 0;font-family:monospace;font-size:12px;color:#666;">${bookingId}</td></tr>
          </table>
          <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;padding:12px 16px;margin-top:20px;font-size:13px;color:#991b1b;">
            ⚡ Please confirm the exact meeting date and send the calendar invite + Zoom link within 24 hours.
          </div>
        </div>
        ${emailFooter}
      </div>
    `,
  });
};

module.exports = { sendEmail, sendWelcomeEmail, sendReportReadyEmail, sendConsultationSlotEmail, sendSlotConfirmationEmail, sendAdminSlotNotification };

