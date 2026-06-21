/**
 * Direct PostgreSQL Setup Script
 * This bypasses Prisma to avoid prepared statement conflicts
 */

const { Client } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function setupDatabase() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });

  try {
    console.log('🔌 Connecting to database...\n');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    // Step 1: Create tenant
    console.log('Step 1: Creating tenant...');

    const tenantResult = await client.query(`
      INSERT INTO "Tenant" (id, name, slug, status, settings, "createdAt", "updatedAt")
      VALUES (
        gen_random_uuid(),
        'St. Stephen Hospital',
        'st-stephen-hospital',
        'ACTIVE',
        '{"timezone":"UTC","currency":"USD"}',
        NOW(),
        NOW()
      )
      ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug
      RETURNING id, name, slug;
    `);

    const tenant = tenantResult.rows[0];
    console.log(`✅ Tenant: ${tenant.name}`);
    console.log(`   ID: ${tenant.id}\n`);

    // Step 2: Create admin user
    console.log('Step 2: Creating admin user...');

    // Hash the password
    const hashedPassword = await bcrypt.hash('Admin@123', 12);

    const userResult = await client.query(`
      INSERT INTO "User" (
        id, "tenantId", email, password, "firstName", "lastName",
        phone, role, status, "failedLoginAttempts", "createdAt", "updatedAt"
      )
      VALUES (
        gen_random_uuid(),
        $1,
        'admin@hospital.com',
        $2,
        'System',
        'Administrator',
        '+1234567890',
        'ADMIN',
        'ACTIVE',
        0,
        NOW(),
        NOW()
      )
      ON CONFLICT ("tenantId", email) DO UPDATE
      SET password = EXCLUDED.password
      RETURNING id, email, "firstName", "lastName", role;
    `, [tenant.id, hashedPassword]);

    const user = userResult.rows[0];
    console.log(`✅ Admin user: ${user.email}\n`);

    // Display login credentials
    console.log('='.repeat(60));
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
    if (error.code) {
      console.error(`   PostgreSQL Error Code: ${error.code}`);
    }
    throw error;
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the setup
setupDatabase()
  .then(() => {
    console.log('\n✅ Setup completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Setup failed!');
    process.exit(1);
  });
