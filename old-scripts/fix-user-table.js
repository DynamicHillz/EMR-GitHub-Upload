/**
 * Fix User table - Add missing columns
 */

const { Client } = require('pg');
require('dotenv').config();

async function fixUserTable() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });

  try {
    console.log('🔌 Connecting to database...\n');
    await client.connect();
    console.log('✅ Connected!\n');

    console.log('Adding missing columns to User table...\n');

    // Add status column (if not exists)
    try {
      await client.query(`
        ALTER TABLE "User"
        ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE';
      `);
      console.log('✅ Added status column');
    } catch (e) {
      console.log('⚠️  status column: ' + e.message);
    }

    // Add failedLoginAttempts column (if not exists)
    try {
      await client.query(`
        ALTER TABLE "User"
        ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER DEFAULT 0;
      `);
      console.log('✅ Added failedLoginAttempts column');
    } catch (e) {
      console.log('⚠️  failedLoginAttempts column: ' + e.message);
    }

    // Add lockedUntil column (if not exists)
    try {
      await client.query(`
        ALTER TABLE "User"
        ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP;
      `);
      console.log('✅ Added lockedUntil column');
    } catch (e) {
      console.log('⚠️  lockedUntil column: ' + e.message);
    }

    // Add lastLogin column (if not exists)
    try {
      await client.query(`
        ALTER TABLE "User"
        ADD COLUMN IF NOT EXISTS "lastLogin" TIMESTAMP;
      `);
      console.log('✅ Added lastLogin column');
    } catch (e) {
      console.log('⚠️  lastLogin column: ' + e.message);
    }

    // Update existing users to have status = 'ACTIVE' where isActive = true
    console.log('\nUpdating existing users...');
    await client.query(`
      UPDATE "User"
      SET status = CASE
        WHEN "isActive" = true THEN 'ACTIVE'
        ELSE 'INACTIVE'
      END
      WHERE status IS NULL OR status = '';
    `);
    console.log('✅ Updated user statuses');

    // Update existing users to have failedLoginAttempts = 0
    await client.query(`
      UPDATE "User"
      SET "failedLoginAttempts" = 0
      WHERE "failedLoginAttempts" IS NULL;
    `);
    console.log('✅ Updated failedLoginAttempts');

    console.log('\n='.repeat(60));
    console.log('✨ User table fixed successfully!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

fixUserTable()
  .then(() => {
    console.log('\n✅ Script completed!');
    process.exit(0);
  })
  .catch(() => {
    console.error('\n❌ Script failed!');
    process.exit(1);
  });
