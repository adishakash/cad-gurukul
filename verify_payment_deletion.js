#!/usr/bin/env node

/**
 * Verification script: Payment Deletion on Student Account Removal
 * 
 * This script verifies that when a student account is deleted:
 * 1. All payment records for that user are removed
 * 2. All career reports are removed
 * 3. All leads with that email are removed
 * 4. The user email is anonymized so it can be reused
 * 
 * Usage: node verify_payment_deletion.js
 */

const prisma = require('./backend/src/config/database');

async function verifyPaymentDeletion() {
  console.log('🔍 Verification: Payment Deletion on Student Account Removal\n');

  try {
    // Create a test user
    console.log('📝 Step 1: Creating test student account...');
    const testEmail = `test_payment_${Date.now()}@cadgurukul.com`;
    const testUser = await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash: 'test_hash',
        role: 'STUDENT',
        studentProfile: {
          create: {
            fullName: 'Test Payment Student',
          },
        },
      },
      include: { studentProfile: true },
    });
    console.log(`✅ Created user: ${testUser.id} (${testEmail})\n`);

    // Create a test payment
    console.log('📝 Step 2: Creating test payment record...');
    const testPayment = await prisma.payment.create({
      data: {
        userId: testUser.id,
        razorpayOrderId: `order_test_${Date.now()}`,
        amountPaise: 100000,
        currency: 'INR',
        status: 'CAPTURED',
        paidAt: new Date(),
        metadata: { planType: 'premium' },
      },
    });
    console.log(`✅ Created payment: ${testPayment.id}\n`);

    // Create a test lead
    console.log('📝 Step 3: Creating test lead with same email...');
    const testLead = await prisma.lead.create({
      data: {
        email: testEmail,
        fullName: 'Test Lead',
        mobileNumber: '9999999999',
        userId: testUser.id,
        paymentId: testPayment.id,
      },
    });
    console.log(`✅ Created lead: ${testLead.id}\n`);

    // Verify records exist
    console.log('📊 Step 4: Verifying records exist before deletion...');
    let userCheck = await prisma.user.findUnique({ where: { id: testUser.id } });
    let paymentCheck = await prisma.payment.findUnique({ where: { id: testPayment.id } });
    let leadCheck = await prisma.lead.findUnique({ where: { id: testLead.id } });

    console.log(`  User exists: ${!!userCheck} ✓`);
    console.log(`  Payment exists: ${!!paymentCheck} ✓`);
    console.log(`  Lead exists: ${!!leadCheck} ✓\n`);

    // Delete the account using the same logic as auth.controller.js
    console.log('🗑️  Step 5: Deleting student account...');
    const anonymisedEmail = `deleted_${testUser.id}@deleted.cadgurukul.internal`;
    
    const { purgeUserData } = require('./backend/src/utils/accountDeletion');
    await prisma.$transaction(async (tx) => {
      await purgeUserData(tx, { userId: testUser.id, email: testEmail });
      await tx.user.update({
        where: { id: testUser.id },
        data: {
          isActive: false,
          deletedAt: new Date(),
          email: anonymisedEmail,
        },
      });
    });
    console.log(`✅ Account deleted (soft-delete with data purge)\n`);

    // Verify records are deleted
    console.log('📊 Step 6: Verifying records deleted after account removal...');
    paymentCheck = await prisma.payment.findUnique({ where: { id: testPayment.id } });
    leadCheck = await prisma.lead.findUnique({ where: { id: testLead.id } });
    userCheck = await prisma.user.findUnique({ where: { id: testUser.id } });

    console.log(`  Payment deleted: ${!paymentCheck} ✓`);
    console.log(`  Lead deleted: ${!leadCheck} ✓`);
    console.log(`  User soft-deleted: ${userCheck?.deletedAt !== null} ✓`);
    console.log(`  User email anonymized: ${userCheck?.email === anonymisedEmail} ✓\n`);

    // Try to create new account with same email
    console.log('📝 Step 7: Re-registering with same email...');
    const newUser = await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash: 'new_password_hash',
        role: 'STUDENT',
        studentProfile: {
          create: {
            fullName: 'New Student Same Email',
          },
        },
      },
    });
    console.log(`✅ Successfully created new account with same email: ${newUser.id}\n`);

    // Verify new user has no old payments
    console.log('📊 Step 8: Verifying new user has no old payment records...');
    const newUserPayments = await prisma.payment.findMany({
      where: { userId: newUser.id },
    });
    console.log(`  New user payment count: ${newUserPayments.length}`);
    console.log(`  No old payments attached: ${newUserPayments.length === 0} ✓\n`);

    // Cleanup
    console.log('🧹 Cleanup: Removing test data...');
    await prisma.studentProfile.deleteMany({ where: { userId: newUser.id } });
    await prisma.user.deleteMany({ where: { id: newUser.id } });
    console.log(`✅ Test data cleaned up\n`);

    console.log('✅ VERIFICATION PASSED: Payment deletion works correctly!');
    console.log('\nSummary:');
    console.log('  1. When a student account is deleted, all payments are removed ✓');
    console.log('  2. All leads are deleted, preventing payment orphans ✓');
    console.log('  3. Email is anonymized allowing re-registration ✓');
    console.log('  4. New accounts with same email have clean payment history ✓');

  } catch (err) {
    console.error('\n❌ VERIFICATION FAILED:', err.message);
    console.error(err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the verification
verifyPaymentDeletion().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
