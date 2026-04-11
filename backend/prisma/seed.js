'use strict';
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding CAD Gurukul database...');

  // Seed admin user
  const adminPassword = await bcrypt.hash('Admin@123456', 12);
  const admin = await prisma.adminUser.upsert({
    where: { email: 'admin@cadgurukul.com' },
    update: {},
    create: {
      email: 'admin@cadgurukul.com',
      passwordHash: adminPassword,
      fullName: 'Platform Admin',
      role: 'SUPER_ADMIN',
    },
  });
  console.log('✅ Admin created:', admin.email);

  // Seed pricing plans
  await prisma.pricingPlan.deleteMany({});
  await prisma.pricingPlan.createMany({
    data: [
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
    ],
  });
  console.log('✅ Pricing plans seeded');

  console.log('🎉 Database seeding complete!');
}

main()
  .catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
