'use strict';
require('dotenv').config();

const prisma = require('../src/config/database');

const args = new Set(process.argv.slice(2));
const commit = args.has('--commit');
const includeUnlinkedLeads = args.has('--include-unlinked-leads');
const skipLogs = args.has('--skip-logs');
const showHelp = args.has('--help') || args.has('-h');

const usage = `
Usage: node scripts/purge-students-and-reports.js [--commit] [--include-unlinked-leads] [--skip-logs]

Defaults to dry-run (no deletes). To execute, pass --commit and set:
  CONFIRM_PURGE_STUDENTS=YES

Options:
  --include-unlinked-leads  Also delete leads that are not linked to a user account.
  --skip-logs               Skip deleting analytics, WhatsApp, AI sessions, activity logs, and notification logs.
`;

const chunk = (items, size) => {
  const results = [];
  for (let i = 0; i < items.length; i += size) {
    results.push(items.slice(i, i + size));
  }
  return results;
};

const deleteInChunks = async (items, size, deleteFn) => {
  let total = 0;
  for (const batch of chunk(items, size)) {
    if (batch.length === 0) continue;
    const result = await deleteFn(batch);
    total += result?.count || 0;
  }
  return total;
};

const requireConfirmation = () => {
  if (!commit) return;
  if (process.env.CONFIRM_PURGE_STUDENTS !== 'YES') {
    throw new Error('Refusing to delete without CONFIRM_PURGE_STUDENTS=YES');
  }
};

const summarizeCounts = (counts) => {
  const ordered = Object.keys(counts).sort();
  const summary = {};
  for (const key of ordered) summary[key] = counts[key];
  return summary;
};

async function main() {
  console.log(JSON.stringify({ commit, includeUnlinkedLeads, skipLogs }, null, 2));

  const studentUsers = await prisma.user.findMany({
    where: { role: { in: ['STUDENT', 'PARENT'] } },
    select: { id: true },
  });
  const studentUserIds = studentUsers.map((user) => user.id);

  const leadWhere = includeUnlinkedLeads
    ? {
        OR: [
          { userId: { in: studentUserIds } },
          { userType: { in: ['student', 'parent'] } },
        ],
      }
    : { userId: { in: studentUserIds } };

  const leads = await prisma.lead.findMany({
    where: leadWhere,
    select: { id: true },
  });
  const leadIds = leads.map((lead) => lead.id);

  const counts = {
    users: studentUserIds.length,
    leads: leadIds.length,
    assessments: await prisma.assessment.count({ where: { userId: { in: studentUserIds } } }),
    reports: await prisma.careerReport.count({ where: { userId: { in: studentUserIds } } }),
    payments: await prisma.payment.count({ where: { userId: { in: studentUserIds } } }),
    consultations: await prisma.consultationBooking.count({ where: { userId: { in: studentUserIds } } }),
    leadEvents: leadIds.length
      ? await prisma.leadEvent.count({ where: { leadId: { in: leadIds } } })
      : 0,
    analyticsEvents: (await prisma.analyticsEvent.count({ where: { userId: { in: studentUserIds } } }))
      + (leadIds.length ? await prisma.analyticsEvent.count({ where: { leadId: { in: leadIds } } }) : 0),
    whatsAppMessages: (await prisma.whatsAppMessage.count({ where: { userId: { in: studentUserIds } } }))
      + (leadIds.length ? await prisma.whatsAppMessage.count({ where: { leadId: { in: leadIds } } }) : 0),
    aiSessions: await prisma.aISession.count({ where: { userId: { in: studentUserIds } } }),
    activityLogs: await prisma.activityLog.count({ where: { userId: { in: studentUserIds } } }),
    notificationLogs: await prisma.notificationLog.count({ where: { userId: { in: studentUserIds } } }),
  };

  console.log(JSON.stringify({ counts: summarizeCounts(counts) }, null, 2));

  if (!commit) {
    console.log('Dry run only. Pass --commit and CONFIRM_PURGE_STUDENTS=YES to delete.');
    return;
  }

  requireConfirmation();

  if (studentUserIds.length === 0 && leadIds.length === 0) {
    console.log('No student users or leads matched. Nothing to delete.');
    return;
  }

  if (!skipLogs) {
    await deleteInChunks(studentUserIds, 500, (batch) => prisma.analyticsEvent.deleteMany({
      where: { userId: { in: batch } },
    }));
    await deleteInChunks(leadIds, 500, (batch) => prisma.analyticsEvent.deleteMany({
      where: { leadId: { in: batch } },
    }));

    await deleteInChunks(studentUserIds, 500, (batch) => prisma.whatsAppMessage.deleteMany({
      where: { userId: { in: batch } },
    }));
    await deleteInChunks(leadIds, 500, (batch) => prisma.whatsAppMessage.deleteMany({
      where: { leadId: { in: batch } },
    }));

    await deleteInChunks(studentUserIds, 500, (batch) => prisma.aISession.deleteMany({
      where: { userId: { in: batch } },
    }));

    await deleteInChunks(studentUserIds, 500, (batch) => prisma.activityLog.deleteMany({
      where: { userId: { in: batch } },
    }));

    await deleteInChunks(studentUserIds, 500, (batch) => prisma.notificationLog.deleteMany({
      where: { userId: { in: batch } },
    }));
  }

  await deleteInChunks(leadIds, 500, (batch) => prisma.leadEvent.deleteMany({
    where: { leadId: { in: batch } },
  }));

  await deleteInChunks(leadIds, 500, (batch) => prisma.lead.deleteMany({
    where: { id: { in: batch } },
  }));

  await deleteInChunks(studentUserIds, 200, (batch) => prisma.user.deleteMany({
    where: { id: { in: batch } },
  }));

  console.log('Deletion complete.');
}

main()
  .catch((err) => {
    console.error('Purge failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
