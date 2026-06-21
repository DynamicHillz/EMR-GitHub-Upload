/**
 * Create Initial Tenant and Admin User
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const prisma = new PrismaClient();

async function createInitialData() {
  try {
    console.log('\n🚀 Creating initial data...\n');

    // Create tenant
    console.log('Creating tenant...');
    const tenant = await prisma.tenant.create({
      data: {
        name: 'St. Stephen Hospital',
        slug: 'st-stephen-hospital',
        clinicName: 'St. Stephen Medical Center',
        status: 'ACTIVE',
        subscriptionTier: 'BASIC',
        settings: JSON.stringify({
          timezone: 'UTC',
          currency: 'USD'
        })
      }
    });

    console.log(`✅ Tenant created: ${tenant.name}`);
    console.log(`   ID: ${tenant.id}\n`);

    // Create admin user
    console.log('Creating admin user...');
    const hashedPassword = await bcrypt.hash('Admin@123', 12);

    const admin = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: 'admin@hospital.com',
        password: hashedPassword,
        firstName: 'System',
        lastName: 'Administrator',
        phone: '+1234567890',
        role: 'ADMIN',
        status: 'ACTIVE',
        failedLoginAttempts: 0
      }
    });

    console.log(`✅ Admin user created: ${admin.email}\n`);

    console.log('='.repeat(60));
    console.log('✨ SETUP COMPLETE! ✨');
    console.log('='.repeat(60));
    console.log('\n📋 LOGIN CREDENTIALS:\n');
    console.log(`   🏥 Tenant ID:  ${tenant.id}`);
    console.log(`   📧 Email:      admin@hospital.com`);
    console.log(`   🔑 Password:   Admin@123`);
    console.log('\n💡 COPY the Tenant ID above!');
    console.log('\n🌐 Login at: http://localhost:5173\n');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createInitialData()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
