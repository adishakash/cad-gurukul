'use strict';
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding CAD Gurukul database...');

  // ── Legacy AdminUser (kept for backward compat with old /auth/admin/login) ──
  const legacyAdminPassword = await bcrypt.hash('Admin@123456', 12);
  const legacyAdmin = await prisma.adminUser.upsert({
    where: { email: 'admin@cadgurukul.com' },
    update: {},
    create: {
      email: 'admin@cadgurukul.com',
      passwordHash: legacyAdminPassword,
      fullName: 'Platform Admin',
      role: 'SUPER_ADMIN',
    },
  });
  console.log('✅ Legacy AdminUser created:', legacyAdmin.email);

  // ── Unified Admin User (for new POST /api/v1/admin/login endpoint) ──────────
  // This is a User record with role=ADMIN in the main users table.
  // It uses the same JWT flow as students, verified by `authenticate` middleware.
  const adminPassword = await bcrypt.hash('Admin@123456', 12);
  const adminUser = await prisma.user.upsert({
    where: { email: 'superadmin@cadgurukul.com' },
    update: {},
    create: {
      email: 'superadmin@cadgurukul.com',
      passwordHash: adminPassword,
      name: 'Super Admin',
      role: 'ADMIN',
    },
  });
  console.log('✅ Admin User created:', adminUser.email, '| role:', adminUser.role);
  console.log('   Login via: POST /api/v1/admin/login');
  console.log('   Credentials: superadmin@cadgurukul.com / Admin@123456');
  console.log('   ⚠️  Change the password immediately in production!');

  // Seed pricing plans — upsert-per-plan so production data is never wiped.
  const plans = [
    {
      name: 'Free Report',
      accessLevel: 'FREE',
      amountPaise: 0,
      currency: 'INR',
      features: [
        '10 adaptive questions',
        'Basic interest analysis',
        'Stream recommendation',
        'Top 3 career suggestions',
        'Limited summary report',
      ],
      isActive: true,
      displayOrder: 1,
    },
    {
      name: 'Premium Report',
      accessLevel: 'PAID',
      amountPaise: 49900, // ₹499
      currency: 'INR',
      features: [
        '30 adaptive questions',
        'Full aptitude & personality analysis',
        'Stream + subject recommendations',
        'Top 7 career fits with detailed reasoning',
        '1-year and 3-year roadmaps',
        'Skill gap analysis',
        'Parent guidance notes',
        'Downloadable PDF report',
        'Priority GPT-4o AI',
      ],
      isActive: true,
      displayOrder: 2,
    },
  ];

  for (const plan of plans) {
    await prisma.pricingPlan.upsert({
      where: { name: plan.name },
      update: { amountPaise: plan.amountPaise, features: plan.features, displayOrder: plan.displayOrder },
      create: plan,
    });
  }
  console.log('✅ Pricing plans seeded');

  console.log('🎉 Database seeding complete!');
}

main()
  .catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
