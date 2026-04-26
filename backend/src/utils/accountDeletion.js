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

  await tx.reportDownload.deleteMany({ where: { userId } });
  await tx.payment.deleteMany({ where: { userId } });
  await tx.careerReport.deleteMany({ where: { userId } });
  await tx.assessment.deleteMany({ where: { userId } });
  await tx.consultationBooking.deleteMany({ where: { userId } });
  await tx.parentDetail.deleteMany({ where: { userId } });
  await tx.studentProfile.deleteMany({ where: { userId } });
  await tx.aISession.deleteMany({ where: { userId } });
  await tx.analyticsEvent.deleteMany({ where: { userId } });
  await tx.whatsAppMessage.deleteMany({ where: { userId } });
  await tx.emailVerificationToken.deleteMany({ where: { userId } });
  await tx.passwordResetToken.deleteMany({ where: { userId } });
  await tx.refreshToken.deleteMany({ where: { userId } });

  if (leadIds.length) {
    await tx.leadEvent.deleteMany({ where: { leadId: { in: leadIds } } });
    await tx.analyticsEvent.deleteMany({ where: { leadId: { in: leadIds } } });
    await tx.whatsAppMessage.deleteMany({ where: { leadId: { in: leadIds } } });
    await tx.consultationBooking.deleteMany({ where: { leadId: { in: leadIds } } });
    await tx.lead.deleteMany({ where: { id: { in: leadIds } } });
  }
};

module.exports = { purgeUserData };
