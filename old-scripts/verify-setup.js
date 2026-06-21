// Verify database setup
require('dotenv').config();
const { PrismaClient } = require('./src/backend/generated/prisma');

async function verifySetup() {
  console.log('\n🔍 Verifying Database Setup...\n');

  const prisma = new PrismaClient();

  try {
    await prisma.$connect();
    console.log('✅ Connected to Supabase\n');

    // Check if tables exist by querying them
    console.log('📊 Checking tables...\n');

    const tables = [
      { name: 'Tenants', query: () => prisma.tenant.count() },
      { name: 'Users', query: () => prisma.user.count() },
      { name: 'Patients', query: () => prisma.patient.count() },
      { name: 'Appointments', query: () => prisma.appointment.count() },
      { name: 'Consultations', query: () => prisma.consultation.count() },
      { name: 'Prescriptions', query: () => prisma.prescription.count() },
      { name: 'Lab Tests', query: () => prisma.labTest.count() },
      { name: 'Medications', query: () => prisma.medication.count() },
      { name: 'Invoices', query: () => prisma.invoice.count() },
      { name: 'Sync Devices', query: () => prisma.syncDevice.count() },
      { name: 'Audit Logs', query: () => prisma.auditLog.count() },
    ];

    let allTablesExist = true;

    for (const table of tables) {
      try {
        const count = await table.query();
        console.log(`  ✅ ${table.name.padEnd(20)} (${count} records)`);
      } catch (error) {
        console.log(`  ❌ ${table.name.padEnd(20)} NOT FOUND`);
        allTablesExist = false;
      }
    }

    console.log('');

    if (allTablesExist) {
      console.log('🎉 SUCCESS! All tables created successfully!\n');
      console.log('✅ Your database is ready to use!\n');
      console.log('Next steps:');
      console.log('  1. Start backend:  npm run dev:backend');
      console.log('  2. Start frontend: npm run dev:frontend');
      console.log('  3. Open browser:   http://localhost:5173\n');
      return true;
    } else {
      console.log('⚠️  Some tables are missing. Please run the SQL again in Supabase.\n');
      return false;
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Make sure you ran the SQL in Supabase SQL Editor!\n');
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

verifySetup()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
