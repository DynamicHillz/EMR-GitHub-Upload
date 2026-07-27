/**
 * Database Connection Health Check Script
 *
 * This script verifies that the application can connect to the database
 * and performs basic health checks to ensure the database is ready.
 *
 * Usage: node -r ts-node/register src/backend/scripts/check-db-connection.ts
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
});

async function checkDatabaseConnection() {
  console.log('🔍 Database Connection Health Check');
  console.log('=====================================\n');

  try {
    // Step 1: Test database connection
    console.log('1. Testing database connection...');
    await prisma.$connect();
    console.log('   ✅ Database connection successful\n');

    // Step 2: Check database version
    console.log('2. Checking database version...');
    const versionResult = await prisma.$queryRaw<Array<{ version: string }>>`SELECT version()`;
    console.log(`   ✅ PostgreSQL Version: ${versionResult[0].version}\n`);

    // Step 3: Verify critical tables exist
    console.log('3. Verifying critical tables...');
    const tables = [
      'tenants',
      'users',
      'patients',
      'appointments',
      'consultations',
      'invoices',
      'payments',
      'audit_logs',
    ];

    for (const table of tables) {
      const count = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*) as count FROM "${table}"`
      );
      console.log(`   ✅ ${table}: ${count[0].count} records`);
    }
    console.log();

    // Step 4: Test a simple query
    console.log('4. Testing simple query...');
    const tenantCount = await prisma.tenant.count();
    console.log(`   ✅ Found ${tenantCount} tenant(s)\n`);

    // Step 5: Check connection pool status
    console.log('5. Connection pool info:');
    console.log(`   📊 Database URL: ${process.env.DATABASE_URL?.split('@')[1] || 'Not configured'}`);
    console.log(`   📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log();

    // Success summary
    console.log('=====================================');
    console.log('✅ All health checks passed!');
    console.log('Database is ready for use.\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Health check failed!');
    console.error('Error:', error);
    console.error('\nPlease check:');
    console.error('1. DATABASE_URL is correctly set in .env');
    console.error('2. Database server is running');
    console.error('3. Database schema is up to date (run: npm run prisma:generate && npm run prisma:migrate)');
    console.error('4. Network connectivity to database server\n');

    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the health check
checkDatabaseConnection();
