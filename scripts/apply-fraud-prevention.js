const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function applyFraudPrevention() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Read and execute the SQL file
    const sqlPath = path.join(__dirname, '..', 'sql', 'add-fraud-prevention.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📝 Applying fraud prevention schema changes...');
    await client.query(sql);
    console.log('✅ Fraud prevention schema applied successfully!');

    console.log('\n🔒 Fraud Prevention Features Added:');
    console.log('  ✓ Receipt photo and proof document fields');
    console.log('  ✓ Approval workflow (supervisor approval for large amounts)');
    console.log('  ✓ Enhanced audit trail (IP, device, location)');
    console.log('  ✓ Reconciliation tracking');
    console.log('  ✓ Fraud detection flags');
    console.log('  ✓ Payment audit log table');
    console.log('  ✓ Fraud prevention settings table');
    console.log('  ✓ Default settings created for all tenants');

  } catch (error) {
    console.error('❌ Error applying fraud prevention:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

applyFraudPrevention();
