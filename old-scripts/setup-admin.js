/**
 * Setup Admin User
 * Creates a default tenant and admin user for first-time setup
 * Run this with: node setup-admin.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting setup...\n');

  try {
    // Step 1: Create or get tenant
    console.log('Step 1: Checking for tenant...');
    let tenant = await prisma.tenant.findUnique({
      where: { slug: 'st-stephen-hospital' }
    });

    if (!tenant) {
      console.log('Creating tenant...');
      tenant = await prisma.tenant.create({
        data: {
          name: 'St. Stephen Hospital',
          slug: 'st-stephen-hospital',
          status: 'ACTIVE',
          settings: JSON.stringify({
            timezone: 'UTC',
            currency: 'USD'
          })
        }
      });
      console.log(`✅ Tenant created: ${tenant.name}`);
    } else {
      console.log(`✅ Tenant exists: ${tenant.name}`);
    }

    console.log(`   Tenant ID: ${tenant.id}\n`);

    // Step 2: Create or get admin user
    console.log('Step 2: Checking for admin user...');
    let adminUser = await prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email: 'admin@hospital.com'
        }
      }
    });

    if (!adminUser) {
      console.log('Creating admin user...');

      // Hash password: Admin@123
      const hashedPassword = await bcrypt.hash('Admin@123', 12);

      adminUser = await prisma.user.create({
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
      console.log(`✅ Admin user created`);
    } else {
      console.log(`✅ Admin user exists`);
    }

    // Step 3: Display login information
    console.log('\n' + '='.repeat(60));
    console.log('✨ SETUP COMPLETE! ✨');
    console.log('='.repeat(60));
    console.log('\n📋 LOGIN CREDENTIALS:\n');
    console.log(`   🏥 Tenant ID:  ${tenant.id}`);
    console.log(`   📧 Email:      admin@hospital.com`);
    console.log(`   🔑 Password:   Admin@123`);
    console.log('\n💡 IMPORTANT: Copy the Tenant ID above!\n');
    console.log('🌐 Login at: http://localhost:5173\n');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nFull error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed');
    process.exit(1);
  });
