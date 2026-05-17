'use strict';
const prisma = require('../config/database');

const resolveLeadIds = async (client, userId, email) => {
  const clauses = [];
  if (userId) clauses.push({ userId });
  if (email) clauses.push({ email: { equals: email, mode: 'insensitive' } });
  if (!clauses.length) return [];

  const leads = await client.lead.findMany({
    where: { OR: clauses },
    select: { id: true },
  });

  return leads.map((lead) => lead.id);
};

const purgeUserData = async (client, { userId, email }) => {
  const tx = client || prisma;
  const leadIds = await resolveLeadIds(tx, userId, email);

  // ─── PHASE 1: Delete payment-dependent records ─────────────────────────────
  // Payment has a reportId FK to CareerReport, so delete payments BEFORE reports
  // to avoid orphaned payments hanging around after report deletion.
  await tx.payment.deleteMany({ where: { userId } });

  // ─── PHASE 2: Delete report-dependent records ────────────────────────────
  // ReportDownload depends on reportId (FK to CareerReport), so delete downloads
  // BEFORE the reports. Also delete the career reports themselves.
  await tx.reportDownload.deleteMany({ where: { userId } });
  await tx.careerReport.deleteMany({ where: { userId } });

  // ─── PHASE 3: Delete assessment and learning records ─────────────────────
  await tx.assessment.deleteMany({ where: { userId } });

  // ─── PHASE 4: Delete consultation and booking records ──────────────────
  await tx.consultationBooking.deleteMany({ where: { userId } });

  // ─── PHASE 5: Delete user profile and relationships ───────────────────
  await tx.studentProfile.deleteMany({ where: { userId } });
  await tx.parentDetail.deleteMany({ where: { userId } });

  // ─── PHASE 6: Delete user tokens and sessions ──────────────────────────
  await tx.aISession.deleteMany({ where: { userId } });
  await tx.refreshToken.deleteMany({ where: { userId } });
  await tx.emailVerificationToken.deleteMany({ where: { userId } });
  await tx.passwordResetToken.deleteMany({ where: { userId } });

  // ─── PHASE 7: Delete user activity logs ──────────────────────────────
  await tx.analyticsEvent.deleteMany({ where: { userId } });
  await tx.whatsAppMessage.deleteMany({ where: { userId } });

  // ─── PHASE 8: Delete all leads associated with this email/userId ─────────
  // Leads may have been created before account creation or under the old email.
  // Cascade-delete all lead-related records to ensure no orphaned data remains.
  if (leadIds.length) {
    await tx.leadEvent.deleteMany({ where: { leadId: { in: leadIds } } });
    await tx.analyticsEvent.deleteMany({ where: { leadId: { in: leadIds } } });
    await tx.whatsAppMessage.deleteMany({ where: { leadId: { in: leadIds } } });
    await tx.consultationBooking.deleteMany({ where: { leadId: { in: leadIds } } });
    await tx.lead.deleteMany({ where: { id: { in: leadIds } } });
  }
};

module.exports = { purgeUserData };
