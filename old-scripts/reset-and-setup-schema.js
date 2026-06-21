/**
 * Reset and Execute Complete Database Schema Setup
 *
 * This script:
 * 1. Drops all existing tables and enums
 * 2. Executes the complete schema from scratch
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function resetAndSetupSchema() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

  console.log('🔌 Connecting to database...');
  console.log(`   Using: ${connectionString.includes('5432') ? 'Direct connection (port 5432)' : 'Pooler connection (port 6543)'}`);

  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('✓ Connected to database\n');

    // STEP 1: Drop all existing views
    console.log('🗑️  Step 1: Dropping existing views...');
    await client.query(`
      DROP VIEW IF EXISTS "OutstandingInvoicesView" CASCADE;
    `);
    console.log('✓ Views dropped\n');

    // STEP 2: Drop all existing tables
    console.log('🗑️  Step 2: Dropping existing tables...');
    await client.query(`
      DROP TABLE IF EXISTS "Refund" CASCADE;
      DROP TABLE IF EXISTS "Payment" CASCADE;
      DROP TABLE IF EXISTS "ServiceCatalog" CASCADE;
      DROP TABLE IF EXISTS "InvoiceLineItem" CASCADE;
      DROP TABLE IF EXISTS "Invoice" CASCADE;
      DROP TABLE IF EXISTS "Consultation" CASCADE;
      DROP TABLE IF EXISTS "Patient" CASCADE;
      DROP TABLE IF EXISTS "User" CASCADE;
      DROP TABLE IF EXISTS "Tenant" CASCADE;
    `);
    console.log('✓ Tables dropped\n');

    // STEP 3: Drop all functions
    console.log('🗑️  Step 3: Dropping existing functions...');
    await client.query(`
      DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
    `);
    console.log('✓ Functions dropped\n');

    // STEP 4: Drop all existing enums
    console.log('🗑️  Step 4: Dropping existing enums...');
    await client.query(`
      DROP TYPE IF EXISTS "PaymentGateway" CASCADE;
      DROP TYPE IF EXISTS "ServiceCategory" CASCADE;
      DROP TYPE IF EXISTS "RefundStatus" CASCADE;
      DROP TYPE IF EXISTS "PaymentProcessStatus" CASCADE;
      DROP TYPE IF EXISTS "PaymentMethod" CASCADE;
      DROP TYPE IF EXISTS "PaymentStatus" CASCADE;
      DROP TYPE IF EXISTS "InvoiceStatus" CASCADE;
      DROP TYPE IF EXISTS "PrescriptionStatus" CASCADE;
      DROP TYPE IF EXISTS "AppointmentStatus" CASCADE;
      DROP TYPE IF EXISTS "ConsultationStatus" CASCADE;
      DROP TYPE IF EXISTS "BloodGroup" CASCADE;
      DROP TYPE IF EXISTS "MaritalStatus" CASCADE;
      DROP TYPE IF EXISTS "Gender" CASCADE;
      DROP TYPE IF EXISTS "UserRole" CASCADE;
    `);
    console.log('✓ Enums dropped\n');

    // STEP 5: Create everything from scratch
    console.log('🚀 Step 5: Creating complete schema...\n');
    console.log('=' .repeat(60));

    const schemaPath = path.join(__dirname, 'setup-complete-schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    await client.query(schemaSql);

    console.log('=' .repeat(60));
    console.log('\n✓ Schema creation completed!\n');

    // STEP 6: Verify
    console.log('🔍 Step 6: Verifying setup...\n');

    // Verify tables
    const tablesResult = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename IN ('Tenant', 'User', 'Patient', 'Consultation', 'Invoice', 'InvoiceLineItem', 'ServiceCatalog', 'Payment', 'Refund')
      ORDER BY tablename;
    `);

    console.log(`✓ Tables created: ${tablesResult.rows.length}/9`);
    tablesResult.rows.forEach(row => {
      console.log(`   ✓ ${row.tablename}`);
    });

    // Verify enums
    const enumsResult = await client.query(`
      SELECT DISTINCT typname
      FROM pg_type
      WHERE typname IN (
        'UserRole', 'Gender', 'MaritalStatus', 'ConsultationStatus',
        'AppointmentStatus', 'PrescriptionStatus', 'InvoiceStatus',
        'PaymentStatus', 'PaymentMethod', 'PaymentProcessStatus',
        'RefundStatus', 'ServiceCategory', 'PaymentGateway'
      )
      ORDER BY typname;
    `);

    console.log(`\n✓ Enums created: ${enumsResult.rows.length}/13`);
    enumsResult.rows.forEach(row => {
      console.log(`   ✓ ${row.typname}`);
    });

    // Verify triggers
    const triggersResult = await client.query(`
      SELECT COUNT(*) as count
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
        AND trigger_name LIKE '%updated_at%';
    `);

    console.log(`\n✓ Triggers created: ${triggersResult.rows[0].count}`);

    // Verify view
    const viewsResult = await client.query(`
      SELECT COUNT(*) as count
      FROM information_schema.views
      WHERE table_schema = 'public'
        AND table_name = 'OutstandingInvoicesView';
    `);

    console.log(`✓ Views created: ${viewsResult.rows[0].count}/1`);

    console.log('\n' + '=' .repeat(60));
    console.log('🎉 DATABASE RESET AND SETUP COMPLETE!');
    console.log('=' .repeat(60));
    console.log('\n✅ SUCCESS! Your database is ready to use.\n');
    console.log('Next steps:');
    console.log('1. Run: npx prisma generate');
    console.log('2. Restart backend: npm run dev:backend');
    console.log('3. Create initial data (tenant, users, services)');
    console.log('4. Test API endpoints');
    console.log('');

  } catch (error) {
    console.error('\n❌ Error during schema setup:');
    console.error('Error:', error.message);
    console.log('\nFull error details:');
    console.log(error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed\n');
  }
}

// Run the script
console.log('\n' + '=' .repeat(60));
console.log('St. Stephen EMR - Database Reset & Setup');
console.log('=' .repeat(60));
console.log('\n⚠️  WARNING: This will DELETE all existing data!\n');

resetAndSetupSchema()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  });
