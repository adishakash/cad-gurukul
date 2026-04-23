'use strict';
require('dotenv').config();

const { verifyEmailTransport, sendEmail, getEmailHealthSnapshot } = require('../src/services/email/emailService');

const targetEmail = process.env.EMAIL_TEST_TO || process.argv[2] || process.env.SMTP_USER;

async function main() {
  if (!targetEmail) {
    throw new Error('No target email provided. Pass an email as an argument or set EMAIL_TEST_TO.');
  }

  await verifyEmailTransport({ force: true });

  const now = new Date().toISOString();
  const result = await sendEmail({
    to: targetEmail,
    subject: 'CAD Gurukul CLI Email Test',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;border:1px solid #e8e8e8;border-radius:8px;overflow:hidden;">
        <div style="background:#0f3460;padding:28px 30px;text-align:center;">
          <h1 style="color:#e94560;margin:0;font-size:26px;">CAD Gurukul</h1>
          <p style="color:#ccd6f6;margin:6px 0 0;font-size:13px;">CLI email smoke test</p>
        </div>
        <div style="padding:30px;">
          <p style="font-size:16px;color:#1a1a2e;margin:0 0 12px;">SMTP delivery is working.</p>
          <p style="font-size:14px;color:#444;line-height:1.6;">This message was sent by the backend CLI test script.</p>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-top:20px;">
            <div style="font-size:12px;color:#475569;margin-bottom:6px;">Sent At</div>
            <div style="font-size:14px;font-weight:bold;color:#0f172a;">${now}</div>
          </div>
        </div>
      </div>
    `,
  });

  console.log(JSON.stringify({
    ok: true,
    targetEmail,
    messageId: result.messageId,
    emailHealth: getEmailHealthSnapshot(),
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({
    ok: false,
    targetEmail,
    error: err.message,
    emailHealth: getEmailHealthSnapshot(),
  }, null, 2));
  process.exit(1);
});
