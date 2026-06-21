/**
 * Fresh Database Setup
 * Automated setup for a brand new Supabase database
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { execSync } = require('child_process');
require('dotenv').config();

const prisma = new PrismaClient();

async function freshSetup() {
  console.log('='.repeat(60));
  console.log('🚀 FRESH DATABASE SETUP');
  console.log('='.repeat(60));
  console.log('');

  try {
    // Step 1: Push Prisma schema to database
    console.log('Step 1: Creating database schema...');
    console.log('This may take a minute...\n');

    try {
      execSync('npx prisma db push --skip-generate --accept-data-loss', {
        stdio: 'inherit',
        env: { ...process.env, FORCE_COLOR: '1' }
      });
      console.log('\n✅ Database schema created!');
    } catch (error) {
      console.error('❌ Failed to create schema');
      throw error;
    }

    // Step 2: Connect to database
    console.log('\nStep 2: Connecting to database...');
    await prisma.$connect();
    console.log('✅ Connected!\n');

    // Step 3: Create tenant
    console.log('Step 3: Creating default tenant...');

    let tenant = await prisma.tenant.findUnique({
      where: { slug: 'st-stephen-hospital' }
    });

    if (!tenant) {
      tenant = await prisma.tenant.create({
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
    } else {
      console.log(`✅ Tenant exists: ${tenant.name}`);
    }
    console.log(`   Tenant ID: ${tenant.id}\n`);

    // Step 4: Create admin user
    console.log('Step 4: Creating admin user...');

    const hashedPassword = await bcrypt.hash('Admin@123', 12);

    let adminUser = await prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email: 'admin@hospital.com'
        }
      }
    });

    if (!adminUser) {
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
      console.log(`✅ Admin user created!`);
    } else {
      // Update password if user exists
      await prisma.user.update({
        where: { id: adminUser.id },
        data: { password: hashedPassword }
      });
      console.log(`✅ Admin user exists (password updated)`);
    }

    // Display success message
    console.log('\n' + '='.repeat(60));
    console.log('✨ SETUP COMPLETE! ✨');
    console.log('='.repeat(60));
    console.log('\n📋 LOGIN CREDENTIALS:\n');
    console.log(`   🏥 Tenant ID:  ${tenant.id}`);
    console.log(`   📧 Email:      admin@hospital.com`);
    console.log(`   🔑 Password:   Admin@123`);
    console.log('\n💡 COPY the Tenant ID above!\n');
    console.log('🌐 Login at: http://localhost:5173\n');
    console.log('='.repeat(60));
    console.log('\n✅ You can now login and start using the system!\n');

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run setup
freshSetup()
  .then(() => {
    console.log('Setup script completed successfully!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Setup script failed!');
    process.exit(1);
  });
