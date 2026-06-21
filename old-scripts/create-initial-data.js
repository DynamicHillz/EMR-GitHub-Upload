/**
 * Create Initial Data
 * Creates a default tenant and admin user for first-time setup
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔍 Checking for existing tenants...');

    // Check if tenant exists
    let tenant = await prisma.tenant.findFirst({
      where: { slug: 'st-stephen-hospital' }
    });

    if (!tenant) {
      console.log('📝 Creating default tenant...');
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
      console.log(`✅ Tenant created: ${tenant.name} (ID: ${tenant.id})`);
    } else {
      console.log(`✅ Tenant already exists: ${tenant.name} (ID: ${tenant.id})`);
    }

    // Check if admin user exists
    const existingAdmin = await prisma.user.findFirst({
      where: {
        tenantId: tenant.id,
        role: 'ADMIN'
      }
    });

    if (!existingAdmin) {
      console.log('👤 Creating admin user...');

      // Hash password
      const hashedPassword = await bcrypt.hash('Admin@123', 12);

      const adminUser = await prisma.user.create({
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

      console.log(`✅ Admin user created: ${adminUser.email}`);
      console.log('\n📋 Login Credentials:');
      console.log('   Email: admin@hospital.com');
      console.log('   Password: Admin@123');
      console.log(`   Tenant ID: ${tenant.id}`);
    } else {
      console.log(`✅ Admin user already exists: ${existingAdmin.email}`);
      console.log(`   Tenant ID: ${tenant.id}`);
    }

    console.log('\n✨ Setup complete! You can now login to the application.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
