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
 * Send report-ready notification email.
 * Called for free report, ₹499 standard, and ₹1,999 premium after generation.
 *
 * @param {object} opts
 * @param {string} opts.to            - Recipient email
 * @param {string} opts.name          - Student name
 * @param {string} opts.reportId      - CareerReport.id for deep-link
 * @param {'FREE'|'PAID'} opts.accessLevel
 * @param {'free'|'standard'|'premium'} [opts.reportType]  - defaults to accessLevel mapping
 * @param {boolean} [opts.isParent]   - true when emailing the parent
 * @param {string} [opts.studentName] - required when isParent=true
 */
const sendReportReadyEmail = async ({
  to,
  name,
  reportId,
  accessLevel,
  reportType,
  isParent = false,
  studentName,
}) => {
  const isPaid    = accessLevel === 'PAID';
  const isPremium = reportType === 'premium';

  const planLabel = isPremium
    ? '₹1,999 Premium AI'
    : isPaid
      ? '₹499 Full Career'
      : 'Free Summary';

  const subject = isPremium
    ? `🚀 Your Premium AI Career Report is Ready, ${isParent ? studentName : name}!`
    : isPaid
      ? `📄 Your Full Career Report is Ready, ${isParent ? studentName : name}!`
      : `📊 Your Free Career Report is Ready, ${isParent ? studentName : name}!`;

  const greeting = isParent
    ? `Hi ${name},<br>Your ward <strong>${studentName}</strong>'s career report is ready.`
    : `Hi ${name}! 🎉<br>Your <strong>${planLabel} Career Report</strong> is ready.`;

  const upgradeBlock = !isPaid
    ? `<div style="margin:24px 0;padding:16px 20px;background:#fff7ed;border:1px solid #fdba74;border-radius:8px;">
        <div style="font-size:13px;font-weight:bold;color:#9a3412;margin-bottom:6px;">🚀 Want deeper career clarity?</div>
        <p style="font-size:13px;color:#7c2d12;margin:0 0 12px;">Upgrade to the Full Report (₹499) for 7+ detailed career paths, a year-by-year roadmap, and a downloadable PDF.</p>
        <a href="${config.frontendUrl}/payment?plan=standard" style="background:#ea580c;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:13px;">Upgrade Now →</a>
      </div>`
    : '';

  const downloadBlock = isPaid
    ? `<div style="margin:20px 0;padding:14px 18px;background:#f0fdf4;border:1px solid #86efac;border-radius:8px;font-size:13px;color:#14532d;">
        <strong>✅ PDF Download Included</strong> — Open your report and click "Download PDF" to save a copy.
      </div>`
    : '';

  return sendEmail({
    to,
    subject,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;border:1px solid #e8e8e8;border-radius:8px;overflow:hidden;">
        <div style="background:#0f3460;padding:28px 30px;text-align:center;">
          <h1 style="color:#e94560;margin:0;font-size:26px;">CAD Gurukul</h1>
          <p style="color:#ccd6f6;margin:6px 0 0;font-size:13px;">AI Career Guidance for Indian Students</p>
        </div>
        <div style="padding:30px;">
          <p style="font-size:16px;color:#1a1a2e;margin:0 0 10px;">${greeting}</p>

          <!-- Report badge -->
          <div style="margin:20px 0;padding:16px 20px;background:#f0f4ff;border-left:4px solid #0f3460;border-radius:6px;">
            <div style="font-size:12px;font-weight:bold;color:#0f3460;letter-spacing:0.5px;margin-bottom:4px;">YOUR REPORT</div>
            <div style="font-size:18px;font-weight:bold;color:#1a1a2e;">${planLabel} Career Report</div>
            ${isPremium ? `<div style="font-size:13px;color:#555;margin-top:4px;">7+ career paths · Year-by-year roadmap · Subject strategy · Scholarship list</div>` : ''}
          </div>

          ${upgradeBlock}
          ${downloadBlock}

          <div style="margin:24px 0;">
            <a href="${config.frontendUrl}/reports/${reportId}"
               style="display:inline-block;background:#e94560;color:#fff;padding:14px 30px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">
              📊 View My Report →
            </a>
          </div>

          <p style="font-size:13px;color:#666;margin:0;">If the button doesn't work, open: <a href="${config.frontendUrl}/reports/${reportId}" style="color:#e94560;">${config.frontendUrl}/reports/${reportId}</a></p>
        </div>
        <div style="background:#f5f5f5;padding:16px;text-align:center;font-size:12px;color:#888;">
          © ${new Date().getFullYear()} CAD Gurukul. All rights reserved.
        </div>
      </div>
    `,
  });
};

/**
 * Send counselling (₹9,999 final) report-ready email after meeting completion.
 * Sent to student (and optionally parent) when the admin marks the counselling report as ready.
 */
const sendCounsellingReportEmail = async ({
  to,
  name,
  reportId,
  bookingId,
  counsellorName = 'Adish Gupta',
  isParent = false,
  studentName,
}) => {
  const recipientDesc = isParent
    ? `Your ward <strong>${studentName}</strong>`
    : `You`;

  return sendEmail({
    to,
    subject: `🎓 Your Personalised Counselling Report is Ready${isParent ? ` — ${studentName}` : ''}!`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;border:1px solid #e8e8e8;border-radius:8px;overflow:hidden;">
        <div style="background:#0f3460;padding:28px 30px;text-align:center;">
          <h1 style="color:#e94560;margin:0;font-size:26px;">CAD Gurukul</h1>
          <p style="color:#ccd6f6;margin:6px 0 0;font-size:13px;">AI Career Guidance for Indian Students</p>
        </div>
        <div style="padding:30px;">
          <p style="font-size:16px;color:#1a1a2e;margin:0 0 8px;">Hi ${name}! 🎓</p>
          <p style="font-size:14px;color:#444;line-height:1.6;">${recipientDesc} completed the 1:1 Career Blueprint Session with <strong>${counsellorName}</strong>. Your personalised counselling report is now ready.</p>

          <div style="margin:20px 0;padding:16px 20px;background:#fff7ed;border-left:4px solid #ea580c;border-radius:6px;">
            <div style="font-size:12px;font-weight:bold;color:#9a3412;letter-spacing:0.5px;margin-bottom:4px;">YOUR COUNSELLING REPORT INCLUDES</div>
            <ul style="font-size:13px;color:#7c2d12;margin:8px 0 0;padding-left:18px;line-height:1.8;">
              <li>Personalised career roadmap from your session</li>
              <li>Recommended stream and subject choices</li>
              <li>Action plan for the next 12 months</li>
              <li>Session notes and follow-up guidance</li>
            </ul>
          </div>

          <div style="margin:24px 0;">
            <a href="${config.frontendUrl}/dashboard"
               style="display:inline-block;background:#ea580c;color:#fff;padding:14px 30px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">
              📋 View Counselling Report →
            </a>
          </div>

          <p style="font-size:13px;color:#666;">Have questions? Reply to this email or contact us at <a href="mailto:support@cadgurukul.com" style="color:#e94560;">support@cadgurukul.com</a></p>
        </div>
        <div style="background:#f5f5f5;padding:16px;text-align:center;font-size:12px;color:#888;">
          © ${new Date().getFullYear()} CAD Gurukul. All rights reserved.
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

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 10: MEET DETAILS & SCHEDULING EMAILS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send Google Meet / meeting details to student (and optionally parent)
 * after admin schedules the session.
 *
 * @param {object} opts
 * @param {string} opts.to               - Recipient email
 * @param {string} opts.name             - Recipient name
 * @param {string} opts.studentName      - Student's full name (if isParent)
 * @param {boolean} [opts.isParent]
 * @param {string} opts.counsellorName
 * @param {string} opts.counsellorContact
 * @param {string} opts.meetLink         - Google Meet / video call URL
 * @param {string} opts.scheduledDateStr - Human-readable date e.g. "Wednesday, 25 June 2026"
 * @param {string} opts.scheduledTimeStr - Human-readable time e.g. "9:00 AM – 12:00 PM IST"
 * @param {string} opts.bookingId        - ConsultationBooking.id for reference
 */
const sendMeetDetailsEmail = async ({
  to,
  name,
  studentName,
  isParent = false,
  counsellorName,
  counsellorContact,
  meetLink,
  scheduledDateStr,
  scheduledTimeStr,
  bookingId,
}) => {
  const greeting  = isParent ? `Hi ${name},` : `You're all set, ${name}! 🎉`;
  const intro     = isParent
    ? `Your ward <strong>${studentName}</strong>'s Career Blueprint Session has been officially scheduled. Here are the details:`
    : `Your 1:1 Career Blueprint Session with <strong>${counsellorName}</strong> is officially scheduled. Here are your meeting details:`;

  return sendEmail({
    to,
    subject: `📹 Meeting Confirmed — Your Career Session Link is Ready${isParent ? ` (${studentName})` : ''}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;border:1px solid #e8e8e8;border-radius:8px;overflow:hidden;">
        ${emailHeader}
        <div style="padding:30px;">
          <p style="font-size:16px;color:#1a1a2e;margin:0 0 8px;">${greeting}</p>
          <p style="color:#444;font-size:14px;line-height:1.6;">${intro}</p>

          <!-- Meeting card -->
          <div style="background:#f0f4ff;border:1px solid #c7d2fe;border-radius:10px;padding:22px;margin:22px 0;">
            <div style="font-size:12px;font-weight:bold;color:#4338ca;letter-spacing:0.8px;margin-bottom:10px;">YOUR MEETING DETAILS</div>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr>
                <td style="padding:6px 0;color:#555;width:130px;vertical-align:top;">📅 Date</td>
                <td style="padding:6px 0;font-weight:bold;color:#1a1a2e;">${scheduledDateStr}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#555;vertical-align:top;">⏰ Time</td>
                <td style="padding:6px 0;font-weight:bold;color:#1a1a2e;">${scheduledTimeStr}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#555;vertical-align:top;">👨‍💼 Counsellor</td>
                <td style="padding:6px 0;font-weight:bold;color:#1a1a2e;">${counsellorName}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#555;vertical-align:top;">📹 Platform</td>
                <td style="padding:6px 0;color:#1a1a2e;">Google Meet</td>
              </tr>
            </table>

            <!-- Big Meet Join button -->
            <div style="margin-top:18px;text-align:center;">
              <a href="${meetLink}"
                 style="display:inline-block;background:#4338ca;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;letter-spacing:0.2px;">
                📹 Join Google Meet →
              </a>
              <p style="font-size:11px;color:#999;margin:10px 0 0;">
                Or paste this link: <span style="color:#4338ca;word-break:break-all;">${meetLink}</span>
              </p>
            </div>
          </div>

          <!-- Tips -->
          <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:16px;margin-bottom:20px;">
            <div style="font-size:12px;font-weight:bold;color:#14532d;margin-bottom:8px;">📋 BEFORE YOUR SESSION</div>
            <ul style="font-size:13px;color:#166534;margin:0;padding-left:18px;line-height:1.8;">
              <li>Join 2–3 minutes early to test your audio/video</li>
              <li>Keep a notepad handy for career path ideas</li>
              <li>List your top 3 career questions in advance</li>
              <li>Parents are welcome — it greatly helps the session</li>
            </ul>
          </div>

          <div style="background:#fffbea;border:1px solid #fde68a;border-radius:6px;padding:12px 16px;font-size:12px;color:#92400e;">
            Need to reschedule or have questions?
            Contact us at <a href="mailto:${counsellorContact}" style="color:#e94560;">${counsellorContact}</a>
          </div>
        </div>
        ${emailFooter}
      </div>
    `,
  });
};

/**
 * Notify admin when a customer books a date-specific availability slot.
 */
const sendAdminNewBookingNotification = async ({
  studentName,
  studentEmail,
  scheduledDateStr,
  scheduledTimeStr,
  bookingId,
  slotId,
}) => {
  const adminEmail = config.email.from?.match(/<(.+?)>/)?.[1] || config.email.user || 'noreply@cadgurukul.com';

  return sendEmail({
    to: adminEmail,
    subject: `[New Booking] ${studentName} — ${scheduledDateStr} ${scheduledTimeStr}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;">
        ${emailHeader}
        <div style="padding:24px;">
          <h2 style="color:#1a1a2e;margin:0 0 16px;">📆 New Consultation Booked</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr><td style="padding:8px 0;color:#555;width:140px;">Student</td>
                <td style="padding:8px 0;font-weight:bold;color:#1a1a2e;">${studentName}</td></tr>
            <tr><td style="padding:8px 0;color:#555;">Email</td>
                <td style="padding:8px 0;color:#0f3460;">${studentEmail || 'N/A'}</td></tr>
            <tr><td style="padding:8px 0;color:#555;">Date</td>
                <td style="padding:8px 0;font-weight:bold;color:#e94560;">${scheduledDateStr}</td></tr>
            <tr><td style="padding:8px 0;color:#555;">Time</td>
                <td style="padding:8px 0;font-weight:bold;color:#e94560;">${scheduledTimeStr}</td></tr>
            <tr><td style="padding:8px 0;color:#555;">Booking ID</td>
                <td style="padding:8px 0;font-family:monospace;font-size:12px;color:#666;">${bookingId}</td></tr>
            <tr><td style="padding:8px 0;color:#555;">Slot ID</td>
                <td style="padding:8px 0;font-family:monospace;font-size:12px;color:#666;">${slotId}</td></tr>
          </table>
          <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;padding:12px 16px;margin-top:20px;font-size:13px;color:#991b1b;">
            ⚡ A Google Meet link has been generated automatically. Please verify the Admin Scheduling dashboard for details.
          </div>
        </div>
        ${emailFooter}
      </div>
    `,
  });
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendReportReadyEmail,
  sendCounsellingReportEmail,
  sendConsultationSlotEmail,
  sendSlotConfirmationEmail,
  sendAdminSlotNotification,
  // Phase 10 — scheduling & Google Meet
  sendMeetDetailsEmail,
  sendAdminNewBookingNotification,
};

