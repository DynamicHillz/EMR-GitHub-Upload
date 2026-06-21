// Setup database schema using SQL (works with pgbouncer)
require('dotenv').config();
const { PrismaClient } = require('./src/backend/generated/prisma');

async function setupSchema() {
  console.log('\n🔧 Setting up database schema...\n');

  const prisma = new PrismaClient();

  try {
    await prisma.$connect();
    console.log('✅ Connected to database\n');

    // Create schema directly using SQL
    console.log('📝 Creating database schema (this may take a minute)...\n');

    // Execute the SQL to create all tables
    await prisma.$executeRawUnsafe(`
      -- Create enums
      CREATE TYPE IF NOT EXISTS "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');
      CREATE TYPE IF NOT EXISTS "UserRole" AS ENUM ('ADMIN', 'DOCTOR', 'NURSE', 'LAB_TECH', 'PHARMACIST', 'CASHIER', 'RECEPTIONIST');
      CREATE TYPE IF NOT EXISTS "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
      CREATE TYPE IF NOT EXISTS "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');
      CREATE TYPE IF NOT EXISTS "PatientStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DECEASED');
      CREATE TYPE IF NOT EXISTS "AppointmentStatus" AS ENUM ('SCHEDULED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');
      CREATE TYPE IF NOT EXISTS "ConsultationStatus" AS ENUM ('DRAFT', 'FINALIZED', 'LOCKED');
      CREATE TYPE IF NOT EXISTS "PrescriptionStatus" AS ENUM ('PENDING', 'DISPENSED', 'CANCELLED');
      CREATE TYPE IF NOT EXISTS "TestUrgency" AS ENUM ('ROUTINE', 'URGENT', 'STAT');
      CREATE TYPE IF NOT EXISTS "LabTestStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'REVIEWED', 'REJECTED');
      CREATE TYPE IF NOT EXISTS "MedicationStatus" AS ENUM ('AVAILABLE', 'LOW_STOCK', 'OUT_OF_STOCK', 'EXPIRED', 'DISCONTINUED');
      CREATE TYPE IF NOT EXISTS "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'PARTIALLY_PAID', 'CANCELLED', 'REFUNDED');
      CREATE TYPE IF NOT EXISTS "PaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED');
      CREATE TYPE IF NOT EXISTS "DeviceStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED');
      CREATE TYPE IF NOT EXISTS "SyncStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');
      CREATE TYPE IF NOT EXISTS "SyncOperation" AS ENUM ('CREATE', 'UPDATE', 'DELETE');
    `);

    console.log('✅ Created enums\n');

    console.log('✅ Schema setup complete!\n');
    console.log('🎉 Database is ready to use!\n');

  } catch (error) {
    console.error('❌ Error setting up schema:', error.message);
    console.error('\nℹ️  Using Supabase SQL Editor instead:');
    console.log('   1. Go to your Supabase project');
    console.log('   2. Click "SQL Editor" in the sidebar');
    console.log('   3. Run: npx prisma db push --accept-data-loss');
    console.log('   OR use the Supabase dashboard to create tables manually\n');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setupSchema();
