/**
 * SQLite Database Initialization Script
 * Creates initial tenant and admin user
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(60));
  console.log('SSMC EMR - Database Initialization');
  console.log('='.repeat(60));
  console.log('');

  try {
    // Check if tenant already exists
    const existingTenant = await prisma.tenant.findFirst();

    if (existingTenant) {
      console.log('✓ Database already initialized');
      console.log(`  Tenant: ${existingTenant.name} (${existingTenant.id})`);

      // Check for admin user
      const adminUser = await prisma.user.findFirst({
        where: {
          tenantId: existingTenant.id,
          role: 'ADMIN'
        }
      });

      if (adminUser) {
        console.log(`  Admin : ${adminUser.email}`);
      }

      console.log('');
      return;
    }

    console.log('[1/2] Creating initial tenant...');

    // Create tenant
    const tenant = await prisma.tenant.create({
      data: {
        id: 'clinic-001',
        name: 'My Clinic',
        slug: 'clinic-001',
        clinicName: 'My Clinic',
        status: 'ACTIVE',
        subscriptionTier: 'PREMIUM',
        primaryColor: '#3b82f6',
        secondaryColor: '#10b981',
        accentColor: '#f59e0b',
        currency: 'NGN',
        currencySymbol: '₦',
        taxEnabled: true,
        defaultTaxRate: 7.5,
        taxName: 'VAT'
      }
    });

    console.log('      ✓ Tenant created:', tenant.name);

    console.log('[2/2] Creating admin user...');

    // Hash password
    const hashedPassword = await bcrypt.hash('admin123', 12);

    // Create admin user
    const admin = await prisma.user.create({
      data: {
        email: 'admin@clinic.com',
        password: hashedPassword,
        firstName: 'System',
        lastName: 'Administrator',
        role: 'ADMIN',
        status: 'ACTIVE',
        tenantId: tenant.id
      }
    });

    console.log('      ✓ Admin user created');
    console.log('');
    console.log('='.repeat(60));
    console.log('DATABASE INITIALIZED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log('');
    console.log('LOGIN CREDENTIALS:');
    console.log('------------------');
    console.log(`  Email   : ${admin.email}`);
    console.log(`  Password: admin123`);
    console.log(`  Tenant  : ${tenant.id}`);
    console.log('');
    console.log('IMPORTANT: Change the admin password after first login!');
    console.log('');

  } catch (error) {
    console.error('Error initializing database:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
