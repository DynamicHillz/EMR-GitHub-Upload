/**
 * Execute Complete Database Schema Setup
 *
 * This script executes the complete schema SQL file directly on Supabase
 * using the direct connection (port 5432) instead of the pooler
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function executeSchema() {
  // Use direct connection for DDL operations
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

  console.log('🔌 Connecting to database...');
  console.log(`   Using: ${connectionString.includes('5432') ? 'Direct connection (port 5432)' : 'Pooler connection (port 6543)'}`);

  const client = new Client({
    connectionString,
    // Don't use connection pooling for DDL
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    // Connect to database
    await client.connect();
    console.log('✓ Connected to database\n');

    // Read the complete schema SQL file
    const schemaPath = path.join(__dirname, 'setup-complete-schema.sql');
    console.log('📄 Reading schema file:', schemaPath);

    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    console.log(`✓ Schema file loaded (${schemaSql.length} characters)\n`);

    // Execute the schema
    console.log('🚀 Executing schema setup...\n');
    console.log('=' .repeat(60));

    const result = await client.query(schemaSql);

    console.log('=' .repeat(60));
    console.log('\n✓ Schema execution completed successfully!\n');

    // Verify tables were created
    console.log('🔍 Verifying tables...');
    const verifyResult = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename IN ('Tenant', 'User', 'Patient', 'Consultation', 'Invoice', 'InvoiceLineItem', 'ServiceCatalog', 'Payment', 'Refund')
      ORDER BY tablename;
    `);

    console.log(`\n✓ Tables created: ${verifyResult.rows.length}/9`);
    verifyResult.rows.forEach(row => {
      console.log(`   ✓ ${row.tablename}`);
    });

    // Verify enums
    const enumResult = await client.query(`
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

    console.log(`\n✓ Enums created: ${enumResult.rows.length}/13`);
    enumResult.rows.forEach(row => {
      console.log(`   ✓ ${row.typname}`);
    });

    // Verify triggers
    const triggerResult = await client.query(`
      SELECT COUNT(*) as count
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
        AND trigger_name LIKE '%updated_at%';
    `);

    console.log(`\n✓ Triggers created: ${triggerResult.rows[0].count}`);

    // Verify view
    const viewResult = await client.query(`
      SELECT COUNT(*) as count
      FROM information_schema.views
      WHERE table_schema = 'public'
        AND table_name = 'OutstandingInvoicesView';
    `);

    console.log(`✓ Views created: ${viewResult.rows[0].count}/1`);

    console.log('\n' + '=' .repeat(60));
    console.log('🎉 DATABASE SETUP COMPLETE!');
    console.log('=' .repeat(60));
    console.log('\nNext steps:');
    console.log('1. Run: npx prisma generate');
    console.log('2. Restart backend: npm run dev:backend');
    console.log('3. Test API endpoints');
    console.log('');

  } catch (error) {
    console.error('\n❌ Error executing schema:');
    console.error('Error:', error.message);

    if (error.message.includes('already exists')) {
      console.log('\n⚠️  Some objects already exist in the database.');
      console.log('   This is usually safe - the script uses CREATE IF NOT EXISTS.');
      console.log('   Run the verification script to check the setup.\n');
    } else if (error.message.includes('does not exist')) {
      console.log('\n⚠️  Missing dependency detected.');
      console.log('   Error details:', error.message);
      console.log('');
    } else {
      console.log('\nFull error details:');
      console.log(error);
    }

    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed\n');
  }
}

// Run the script
console.log('\n' + '=' .repeat(60));
console.log('St. Stephen EMR - Database Schema Setup');
console.log('=' .repeat(60));
console.log('');

executeSchema()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  });
