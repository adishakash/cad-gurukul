'use strict';
const nodemailer = require('nodemailer');
const config = require('../../config');
const logger = require('../../utils/logger');

let transporterPromise = null;
let emailHealth = {
  configured: false,
  verified: false,
  lastVerifiedAt: null,
  lastError: null,
};

const maskEmailAddress = (value) => {
  if (!value || typeof value !== 'string' || !value.includes('@')) {
    return value || null;
  }

  const [localPart, domain] = value.split('@');
  if (!localPart || !domain) return value;

  if (localPart.length <= 2) {
    return `${localPart[0] || '*'}*@${domain}`;
  }

  return `${localPart.slice(0, 2)}***@${domain}`;
};

const isEmailConfigured = () => Boolean(
  config.email.host
  && config.email.port
  && config.email.user
  && config.email.pass
  && config.email.from
);

const htmlToPlainText = (html) => {
  if (!html || typeof html !== 'string') return '';

  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const createTransporter = () => nodemailer.createTransport({
  host: config.email.host,
  port: config.email.port,
  secure: config.email.secure,
  pool: true,
  maxConnections: 3,
  maxMessages: 100,
  connectionTimeout: config.email.connectionTimeoutMs,
  greetingTimeout: config.email.greetingTimeoutMs,
  socketTimeout: config.email.socketTimeoutMs,
  auth: {
    user: config.email.user,
    pass: config.email.pass,
  },
});

const getTransporter = async () => {
  if (!isEmailConfigured()) {
    const missingKeys = [
      ['SMTP_HOST', config.email.host],
      ['SMTP_PORT', config.email.port],
      ['SMTP_USER', config.email.user],
      ['SMTP_PASS', config.email.pass],
      ['EMAIL_FROM', config.email.from],
    ].filter(([, value]) => !value).map(([key]) => key);

    const err = new Error(`Email transport is not configured. Missing: ${missingKeys.join(', ')}`);
    emailHealth = {
      ...emailHealth,
      configured: false,
      verified: false,
      lastError: err.message,
    };
    throw err;
  }

  if (!transporterPromise) {
    transporterPromise = Promise.resolve(createTransporter());
    emailHealth = {
      ...emailHealth,
      configured: true,
      lastError: null,
    };
  }

  return transporterPromise;
};

const verifyEmailTransport = async ({ force = false } = {}) => {
  if (!isEmailConfigured()) {
    const err = new Error('Email transport is not configured.');
    emailHealth = {
      ...emailHealth,
      configured: false,
      verified: false,
      lastError: err.message,
    };
    throw err;
  }

  const transporter = await getTransporter();

  if (!force && emailHealth.verified) {
    return emailHealth;
  }

  try {
    await transporter.verify();
    emailHealth = {
      configured: true,
      verified: true,
      lastVerifiedAt: new Date().toISOString(),
      lastError: null,
    };
    logger.info('[Email] SMTP transport verified', {
      host: config.email.host,
      port: config.email.port,
      user: maskEmailAddress(config.email.user),
    });
    return emailHealth;
  } catch (err) {
    emailHealth = {
      configured: true,
      verified: false,
      lastVerifiedAt: new Date().toISOString(),
      lastError: err.message,
    };
    logger.error('[Email] SMTP transport verification failed', {
      host: config.email.host,
      port: config.email.port,
      user: maskEmailAddress(config.email.user),
      error: err.message,
    });
    throw err;
  }
};

const getEmailHealthSnapshot = () => ({
  configured: isEmailConfigured(),
  verified: emailHealth.verified,
  lastVerifiedAt: emailHealth.lastVerifiedAt,
  lastError: emailHealth.lastError,
  host: config.email.host || null,
  port: config.email.port || null,
  user: maskEmailAddress(config.email.user),
  from: config.email.from || null,
});

/**
 * Send a generic email
 */
const sendEmail = async ({ to, subject, html, text, replyTo, attachments }) => {
  const transporter = await getTransporter();

  try {
    const info = await transporter.sendMail({
      from: config.email.from,
      replyTo: replyTo || config.email.replyTo,
      to,
      subject,
      html,
      text: text || htmlToPlainText(html),
      attachments,
    });

    emailHealth = {
      ...emailHealth,
      configured: true,
      lastError: null,
    };

    logger.info('[Email] Sent', {
      to: maskEmailAddress(to),
      subject,
      messageId: info.messageId,
    });
    return info;
  } catch (err) {
    emailHealth = {
      ...emailHealth,
      configured: isEmailConfigured(),
      lastError: err.message,
    };
    logger.error('[Email] Failed to send', {
      to: maskEmailAddress(to),
      subject,
      error: err.message,
    });
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
  const isPaid = accessLevel === 'PAID';
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
  counsellorName = 'Adish Gupta',
  isParent = false,
  studentName,
}) => {
  const recipientDesc = isParent
    ? `Your ward <strong>${studentName}</strong>`
    : 'You';

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

const sendConsultationReminderEmail = async ({
  to,
  name,
  scheduledStartAt,
  scheduledEndAt,
  meetingLink,
  counsellorName,
  counsellorContact,
  reminderLabel,
  isParent = false,
  studentName,
}) => {
  const recipientLabel = isParent ? `${studentName}'s` : 'your'

  return sendEmail({
    to,
    subject: `⏰ Reminder: ${recipientLabel.charAt(0).toUpperCase()}${recipientLabel.slice(1)} career session is ${reminderLabel}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;border:1px solid #e8e8e8;border-radius:8px;overflow:hidden;">
        ${emailHeader}
        <div style="padding:30px;">
          <p style="font-size:16px;color:#1a1a2e;margin:0 0 8px;">Hi ${name}${isParent ? '' : '!'} ⏰</p>
          <p style="font-size:14px;color:#444;line-height:1.6;">
            This is a reminder that ${isParent ? `your ward <strong>${studentName}</strong>'s` : 'your'} 1:1 Career Blueprint Session with <strong>${counsellorName}</strong> is <strong>${reminderLabel}</strong>.
          </p>

          <div style="background:#fff7ed;border:1px solid #fdba74;border-radius:8px;padding:18px;margin:20px 0;">
            <div style="font-size:13px;font-weight:bold;color:#9a3412;margin-bottom:6px;">SESSION DETAILS</div>
            <div style="font-size:16px;font-weight:bold;color:#1a1a2e;">${formatConsultationDateTime(scheduledStartAt)}</div>
            <div style="font-size:13px;color:#9a3412;margin-top:6px;">${formatConsultationTimeRange(scheduledStartAt, scheduledEndAt)}</div>
          </div>

          <div style="margin:24px 0;">
            <a href="${meetingLink}" style="display:inline-block;background:#ea580c;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">
              Join Meeting
            </a>
            <p style="font-size:12px;color:#9a3412;margin:12px 0 0;">${meetingLink}</p>
          </div>

          <ul style="font-size:13px;color:#555;line-height:1.9;padding-left:18px;margin:0;">
            <li>Join 5 minutes before the scheduled time</li>
            <li>Keep your assessment questions handy</li>
            <li>Parents can join the same meeting link</li>
          </ul>

          <p style="font-size:13px;color:#666;margin-top:20px;">Need help? Reply to this email or contact <a href="mailto:${counsellorContact}" style="color:#e94560;">${counsellorContact}</a></p>
        </div>
        ${emailFooter}
      </div>
    `,
  })
}

const sendConsultationFollowUpEmail = async ({
  to,
  name,
  counsellorName,
  meetingLink,
  isParent = false,
  studentName,
}) => {
  return sendEmail({
    to,
    subject: `🙏 Thanks for attending your CAD Gurukul session${isParent ? ` — ${studentName}` : ''}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;border:1px solid #e8e8e8;border-radius:8px;overflow:hidden;">
        ${emailHeader}
        <div style="padding:30px;">
          <p style="font-size:16px;color:#1a1a2e;margin:0 0 8px;">Hi ${name}${isParent ? '' : '!'} 🙏</p>
          <p style="font-size:14px;color:#444;line-height:1.6;">
            ${isParent ? `Thank you for joining <strong>${studentName}</strong>'s` : 'Thank you for attending your'} Career Blueprint Session with <strong>${counsellorName}</strong>.
          </p>
          <div style="background:#f0f4ff;border-left:4px solid #0f3460;border-radius:8px;padding:18px;margin:20px 0;">
            <div style="font-size:13px;font-weight:bold;color:#0f3460;margin-bottom:6px;">WHAT HAPPENS NEXT</div>
            <ul style="font-size:13px;color:#334155;line-height:1.8;padding-left:18px;margin:0;">
              <li>Your personalised counselling report will be prepared next</li>
              <li>You can re-open your meeting link if any quick follow-up is needed: ${meetingLink || 'shared during the session'}</li>
              <li>Our team remains available on email for follow-up questions</li>
            </ul>
          </div>
          <p style="font-size:13px;color:#666;">We’ll notify you as soon as the final counselling report is ready.</p>
        </div>
        ${emailFooter}
      </div>
    `,
  })
}

const formatConsultationDateTime = (date) => new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'full',
  timeStyle: 'short',
  timeZone: 'Asia/Kolkata',
}).format(new Date(date));

const formatConsultationTimeRange = (startAt, endAt) => {
  const formatter = new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });

  return `${formatter.format(new Date(startAt))} - ${formatter.format(new Date(endAt))} IST`;
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
 * Send scheduling email to the registered student after consultation purchase.
 * The email contains a link to the slot-selection page where they pick an exact date + time.
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
    ? `Your ward <strong>${studentName}</strong> has booked a 1:1 Career Blueprint Session with <strong>${counsellorName}</strong>. Please help them select an exact date and time for the live counselling call.`
    : `Your ₹9,999 Career Blueprint Session with <strong>${counsellorName}</strong> has been confirmed. Please choose an exact date and time for your live counselling session.`;

  return sendEmail({
    to,
    subject: '📅 Choose Your Career Session Date & Time — Action Required',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;border:1px solid #e8e8e8;border-radius:8px;overflow:hidden;">
        ${emailHeader}
        <div style="padding:30px;">
          <p style="font-size:16px;color:#1a1a2e;margin:0 0 8px;">${greeting}</p>
          <p style="color:#444;font-size:14px;line-height:1.6;">${intro}</p>

          <div style="background:#f0f4ff;border-radius:8px;padding:18px;margin:20px 0;border-left:4px solid #0f3460;">
            <div style="font-size:13px;font-weight:bold;color:#0f3460;margin-bottom:6px;">YOUR COUNSELLOR</div>
            <div style="font-size:16px;font-weight:bold;color:#1a1a2e;">👨‍💼 ${counsellorName}</div>
            <div style="font-size:13px;color:#555;margin-top:4px;">${counsellorExpertise}</div>
            <div style="font-size:13px;color:#e94560;margin-top:6px;">📧 ${counsellorContact}</div>
          </div>

          <div style="margin:20px 0;">
            <div style="font-size:13px;font-weight:bold;color:#0f3460;margin-bottom:8px;">WHAT TO EXPECT IN YOUR SESSION</div>
            <ul style="font-size:13px;color:#555;line-height:1.8;padding-left:18px;margin:0;">
            <li>60-minute personalised career blueprint discussion</li>
            <li>Parents are welcome to join the session</li>
            <li>Meeting link generated automatically after your slot is booked</li>
            <li>30-day email support after the session</li>
          </ul>
        </div>

        <div style="margin:24px 0;">
            <div style="font-size:14px;font-weight:bold;color:#1a1a2e;margin-bottom:12px;">📅 SELECT YOUR EXACT DATE & TIME</div>
            <p style="font-size:13px;color:#555;margin:0 0 16px;">Click below to see live availability and instantly lock your session slot:</p>
            <a href="${selectionUrl}"
               style="display:inline-block;background:#e94560;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;letter-spacing:0.3px;">
              📅 Book My Session Slot →
            </a>
            <p style="font-size:11px;color:#999;margin:12px 0 0;">
              Or copy this link: <span style="color:#0f3460;">${selectionUrl}</span>
            </p>
          </div>

          <div style="background:#fffbea;border:1px solid #fde68a;border-radius:6px;padding:12px 16px;font-size:12px;color:#92400e;margin-top:20px;">
            ⏰ <strong>Please select your slot within 48 hours.</strong> As soon as you confirm a slot, your meeting link will be generated automatically and mailed to you.
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
  scheduledStartAt,
  scheduledEndAt,
  counsellorName,
  counsellorContact,
  meetingLink,
  meetingProvider = 'JITSI',
  isParent = false,
  studentName,
}) => {
  const label = formatConsultationDateTime(scheduledStartAt);
  const timeRange = formatConsultationTimeRange(scheduledStartAt, scheduledEndAt);
  const subject = isParent
    ? `✅ Career Session Scheduled for ${studentName} — ${label}`
    : `✅ Your Career Session is Scheduled — ${label}`;

  const greeting = isParent ? `Hi ${name},` : `Booked successfully, ${name}! ✅`;
  const confirmText = isParent
    ? `Your ward <strong>${studentName}</strong> is now scheduled for a Career Blueprint Session with <strong>${counsellorName}</strong>.`
    : `Your 1:1 Career Blueprint Session with <strong>${counsellorName}</strong> is now scheduled.`;

  return sendEmail({
    to,
    subject,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;border:1px solid #e8e8e8;border-radius:8px;overflow:hidden;">
        ${emailHeader}
        <div style="padding:30px;">
          <p style="font-size:16px;color:#1a1a2e;margin:0 0 8px;">${greeting}</p>
          <p style="color:#444;font-size:14px;line-height:1.6;">${confirmText}</p>

          <div style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:8px;padding:18px;margin:20px 0;text-align:center;">
            <div style="font-size:28px;margin-bottom:8px;">🗓️</div>
            <div style="font-size:13px;font-weight:bold;color:#065f46;letter-spacing:0.5px;">SCHEDULED SESSION</div>
            <div style="font-size:18px;font-weight:bold;color:#1a1a2e;margin-top:4px;">${label}</div>
            <div style="font-size:13px;color:#065f46;margin-top:6px;">${timeRange}</div>
          </div>

          <div style="background:#f0f4ff;border-radius:8px;padding:16px;margin-bottom:20px;">
            <div style="font-size:13px;font-weight:bold;color:#0f3460;margin-bottom:6px;">YOUR COUNSELLOR</div>
            <div style="font-size:15px;font-weight:bold;color:#1a1a2e;">👨‍💼 ${counsellorName}</div>
            <div style="font-size:13px;color:#e94560;margin-top:4px;">📧 ${counsellorContact}</div>
          </div>

          <div style="background:#fff7ed;border:1px solid #fdba74;border-radius:8px;padding:18px;margin-bottom:20px;">
            <div style="font-size:13px;font-weight:bold;color:#9a3412;margin-bottom:6px;">MEETING LINK</div>
            <a href="${meetingLink}" style="display:inline-block;background:#ea580c;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;">Join ${meetingProvider} Meeting</a>
            <p style="font-size:12px;color:#9a3412;margin:12px 0 0;">${meetingLink}</p>
          </div>

          <div style="font-size:13px;font-weight:bold;color:#0f3460;margin-bottom:8px;">WHAT HAPPENS NEXT</div>
          <ol style="font-size:13px;color:#555;line-height:1.9;padding-left:18px;margin:0 0 20px;">
            <li>Please join the session using the meeting link above 5 minutes early</li>
            <li>Keep your assessment results and questions ready for the call</li>
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
  bookingId,
  scheduledStartAt,
  scheduledEndAt,
  meetingLink,
  meetingProvider = 'JITSI',
}) => {
  const label = formatConsultationDateTime(scheduledStartAt);
  const timeRange = formatConsultationTimeRange(scheduledStartAt, scheduledEndAt);
  const adminEmail = config.email.from?.match(/<(.+?)>/)?.[1] || config.email.user || 'noreply@cadgurukul.com';

  return sendEmail({
    to: adminEmail,
    subject: `[Consultation Scheduled] ${studentName} — ${label}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;">
        ${emailHeader}
        <div style="padding:24px;">
          <h2 style="color:#1a1a2e;margin:0 0 16px;">📌 Consultation Scheduled</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr><td style="padding:8px 0;color:#555;width:140px;">Student</td><td style="padding:8px 0;font-weight:bold;color:#1a1a2e;">${studentName}</td></tr>
            <tr><td style="padding:8px 0;color:#555;">Email</td><td style="padding:8px 0;color:#0f3460;">${studentEmail || 'N/A'}</td></tr>
            <tr><td style="padding:8px 0;color:#555;">Date &amp; Time</td><td style="padding:8px 0;font-weight:bold;color:#e94560;">${label}</td></tr>
            <tr><td style="padding:8px 0;color:#555;">Time Range</td><td style="padding:8px 0;color:#1a1a2e;">${timeRange}</td></tr>
            <tr><td style="padding:8px 0;color:#555;">Booking ID</td><td style="padding:8px 0;font-family:monospace;font-size:12px;color:#666;">${bookingId}</td></tr>
            <tr><td style="padding:8px 0;color:#555;">Meeting</td><td style="padding:8px 0;color:#1a1a2e;"><a href="${meetingLink}" style="color:#e94560;">Join ${meetingProvider}</a></td></tr>
          </table>
          <div style="background:#ecfdf5;border:1px solid #86efac;border-radius:6px;padding:12px 16px;margin-top:20px;font-size:13px;color:#166534;">
            ⚡ The student has locked this slot. It should now appear in the admin consultations calendar for follow-through and live joining.
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
  sendConsultationReminderEmail,
  sendConsultationFollowUpEmail,
  verifyEmailTransport,
  getEmailHealthSnapshot,
  isEmailConfigured,
};
