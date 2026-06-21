/**
 * Final Setup - Create user in the correct tables with correct schema
 */

const { Client } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function finalSetup() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });

  try {
    console.log('🔌 Connecting...\n');
    await client.connect();

    // Check tenants table schema
    const tenantsColumns = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'tenants'
      ORDER BY ordinal_position;
    `);

    console.log('tenants table columns:');
    tenantsColumns.rows.forEach(c => console.log(`  ${c.column_name}: ${c.data_type}`));

    // Check users table schema
    const usersColumns = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `);

    console.log('\nusers table columns:');
    usersColumns.rows.forEach(c => console.log(`  ${c.column_name}: ${c.data_type}`));

    // Now create tenant in tenants table
    console.log('\n---\nCreating tenant in tenants table...');
    const tenantResult = await client.query(`
      INSERT INTO tenants (id, name, slug, "clinicName", "subscriptionTier", "subscriptionStart", "createdAt", "updatedAt")
      VALUES (
        gen_random_uuid(),
        'St. Stephen Hospital',
        'st-stephen-hospital',
        'St. Stephen Medical Center',
        'BASIC',
        NOW(),
        NOW(),
        NOW()
      )
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
      RETURNING id, name, slug;
    `);

    const tenant = tenantResult.rows[0];
    console.log(`✅ Tenant: ${tenant.name} (${tenant.id})`);

    // Create user in users table
    console.log('\nCreating user in users table...');
    const hashedPassword = await bcrypt.hash('Admin@123', 12);

    const userResult = await client.query(`
      INSERT INTO users (
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
      RETURNING id, email, role;
    `, [tenant.id, hashedPassword]);

    const user = userResult.rows[0];
    console.log(`✅ User: ${user.email}`);

    console.log('\n' + '='.repeat(60));
    console.log('✨ SUCCESS! ✨');
    console.log('='.repeat(60));
    console.log(`\n   🏥 Tenant ID:  ${tenant.id}`);
    console.log(`   📧 Email:      admin@hospital.com`);
    console.log(`   🔑 Password:   Admin@123\n`);
    console.log('   🌐 Login at:   http://localhost:5173\n');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code) console.error(`Code: ${error.code}`);
    throw error;
  } finally {
    await client.end();
  }
}

finalSetup()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
