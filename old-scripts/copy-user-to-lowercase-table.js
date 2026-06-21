/**
 * Copy user from "User" table to "users" table (lowercase)
 */

const { Client } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function copyUser() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });

  try {
    console.log('🔌 Connecting to database...\n');
    await client.connect();
    console.log('✅ Connected!\n');

    // Get tenant ID from User table
    const tenantResult = await client.query(`
      SELECT DISTINCT "tenantId"
      FROM "User"
      WHERE email = 'admin@hospital.com'
      LIMIT 1;
    `);

    if (tenantResult.rows.length === 0) {
      console.log('❌ No user found in User table');
      return;
    }

    const tenantId = tenantResult.rows[0].tenantId;
    console.log(`Found tenant ID: ${tenantId}\n`);

    // Hash the password
    const hashedPassword = await bcrypt.hash('Admin@123', 12);

    // Insert into lowercase users table
    console.log('Inserting into users table...');
    await client.query(`
      INSERT INTO users (
        id, "tenantId", email, password, "firstName", "lastName",
        phone, role, status, "failedLoginAttempts", "lastLogin", "lockedUntil",
        "createdAt", "updatedAt"
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
        NULL,
        NULL,
        NOW(),
        NOW()
      )
      ON CONFLICT ("tenantId", email) DO UPDATE
      SET password = EXCLUDED.password,
          status = EXCLUDED.status,
          "failedLoginAttempts" = EXCLUDED."failedLoginAttempts"
      RETURNING id, email, role;
    `, [tenantId, hashedPassword]);

    console.log('✅ User copied to users table!\n');

    // Verify
    const verifyResult = await client.query(`
      SELECT id, email, role, status, "failedLoginAttempts"
      FROM users
      WHERE email = 'admin@hospital.com'
      LIMIT 1;
    `);

    console.log('Verified user in users table:');
    console.log(JSON.stringify(verifyResult.rows[0], null, 2));

    console.log('\n' + '='.repeat(60));
    console.log('✨ SUCCESS! You can now login with:');
    console.log('='.repeat(60));
    console.log(`\n   🏥 Tenant ID:  ${tenantId}`);
    console.log(`   📧 Email:      admin@hospital.com`);
    console.log(`   🔑 Password:   Admin@123\n`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

copyUser()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
