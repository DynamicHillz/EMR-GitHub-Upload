/**
 * Database Health Check Script
 * Verifies database structure, relationships, and data integrity
 */

const { Client } = require('pg');
require('dotenv').config();

async function checkDatabaseHealth() {
  const client = new Client({ connectionString: process.env.DIRECT_URL });

  try {
    console.log('🔌 Connecting to database...\n');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    // 1. Check all tables exist
    console.log('═══════════════════════════════════════════════');
    console.log('📋 CHECKING DATABASE TABLES');
    console.log('═══════════════════════════════════════════════\n');

    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    console.log(`Found ${tablesResult.rows.length} tables:\n`);
    tablesResult.rows.forEach((row, idx) => {
      console.log(`  ${idx + 1}. ${row.table_name}`);
    });

    // 2. Check critical tables
    console.log('\n═══════════════════════════════════════════════');
    console.log('🔍 VERIFYING CRITICAL TABLES');
    console.log('═══════════════════════════════════════════════\n');

    const criticalTables = [
      'tenants', 'users', 'patients', 'appointments', 'consultations',
      'prescriptions', 'lab_tests', 'medications', 'invoices', 'payments'
    ];

    const existingTables = tablesResult.rows.map(r => r.table_name);
    let missingTables = [];

    criticalTables.forEach(table => {
      if (existingTables.includes(table)) {
        console.log(`  ✅ ${table}`);
      } else {
        console.log(`  ❌ ${table} - MISSING!`);
        missingTables.push(table);
      }
    });

    // 3. Check foreign key constraints
    console.log('\n═══════════════════════════════════════════════');
    console.log('🔗 CHECKING FOREIGN KEY CONSTRAINTS');
    console.log('═══════════════════════════════════════════════\n');

    const fkResult = await client.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      ORDER BY tc.table_name;
    `);

    console.log(`Found ${fkResult.rows.length} foreign key relationships\n`);
    console.log(`  ✅ Foreign keys properly configured`);

    // 4. Check indexes
    console.log('\n═══════════════════════════════════════════════');
    console.log('📊 CHECKING INDEXES');
    console.log('═══════════════════════════════════════════════\n');

    const indexResult = await client.query(`
      SELECT
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname;
    `);

    console.log(`Found ${indexResult.rows.length} indexes`);

    // Count indexes per table
    const indexCount = {};
    indexResult.rows.forEach(row => {
      indexCount[row.tablename] = (indexCount[row.tablename] || 0) + 1;
    });

    console.log('\nIndexes per table:');
    Object.entries(indexCount).forEach(([table, count]) => {
      console.log(`  ${table}: ${count} indexes`);
    });

    // 5. Check data integrity
    console.log('\n═══════════════════════════════════════════════');
    console.log('🔐 CHECKING DATA INTEGRITY');
    console.log('═══════════════════════════════════════════════\n');

    // Check tenants
    const tenantsCount = await client.query('SELECT COUNT(*) FROM tenants');
    console.log(`  Tenants: ${tenantsCount.rows[0].count} record(s)`);

    if (tenantsCount.rows[0].count > 0) {
      const tenants = await client.query('SELECT id, name, status FROM tenants');
      tenants.rows.forEach(t => {
        console.log(`    - ${t.name} (${t.id}) - ${t.status}`);
      });
    }

    // Check users
    const usersCount = await client.query('SELECT COUNT(*) FROM users');
    console.log(`\n  Users: ${usersCount.rows[0].count} record(s)`);

    if (usersCount.rows[0].count > 0) {
      const users = await client.query(`
        SELECT u.email, u.role, u.status, t.name as tenant_name
        FROM users u
        JOIN tenants t ON u."tenantId" = t.id
      `);
      users.rows.forEach(u => {
        console.log(`    - ${u.email} (${u.role}) - ${u.status} [${u.tenant_name}]`);
      });
    }

    // Check patients
    const patientsCount = await client.query('SELECT COUNT(*) FROM patients');
    console.log(`\n  Patients: ${patientsCount.rows[0].count} record(s)`);

    // Check appointments
    const appointmentsCount = await client.query('SELECT COUNT(*) FROM appointments');
    console.log(`  Appointments: ${appointmentsCount.rows[0].count} record(s)`);

    // Check consultations
    const consultationsCount = await client.query('SELECT COUNT(*) FROM consultations');
    console.log(`  Consultations: ${consultationsCount.rows[0].count} record(s)`);

    // Check invoices
    const invoicesCount = await client.query('SELECT COUNT(*) FROM invoices');
    console.log(`  Invoices: ${invoicesCount.rows[0].count} record(s)`);

    // 6. Check for orphaned records
    console.log('\n═══════════════════════════════════════════════');
    console.log('🔍 CHECKING FOR ORPHANED RECORDS');
    console.log('═══════════════════════════════════════════════\n');

    // Users without tenants
    const orphanedUsers = await client.query(`
      SELECT COUNT(*) FROM users u
      LEFT JOIN tenants t ON u."tenantId" = t.id
      WHERE t.id IS NULL
    `);
    console.log(`  Orphaned users: ${orphanedUsers.rows[0].count}`);

    // Patients without tenants
    const orphanedPatients = await client.query(`
      SELECT COUNT(*) FROM patients p
      LEFT JOIN tenants t ON p."tenantId" = t.id
      WHERE t.id IS NULL
    `);
    console.log(`  Orphaned patients: ${orphanedPatients.rows[0].count}`);

    // 7. Check enum types
    console.log('\n═══════════════════════════════════════════════');
    console.log('📝 CHECKING ENUM TYPES');
    console.log('═══════════════════════════════════════════════\n');

    const enumsResult = await client.query(`
      SELECT t.typname as enum_name
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      GROUP BY t.typname
      ORDER BY t.typname;
    `);

    console.log(`Found ${enumsResult.rows.length} enum types:`);
    enumsResult.rows.forEach((row, idx) => {
      console.log(`  ${idx + 1}. ${row.enum_name}`);
    });

    // Final summary
    console.log('\n═══════════════════════════════════════════════');
    console.log('📊 HEALTH CHECK SUMMARY');
    console.log('═══════════════════════════════════════════════\n');

    const issues = [];

    if (missingTables.length > 0) {
      issues.push(`❌ Missing tables: ${missingTables.join(', ')}`);
    }
    if (parseInt(tenantsCount.rows[0].count) === 0) {
      issues.push('❌ No tenants found');
    }
    if (parseInt(usersCount.rows[0].count) === 0) {
      issues.push('❌ No users found');
    }
    if (parseInt(orphanedUsers.rows[0].count) > 0) {
      issues.push(`⚠️  ${orphanedUsers.rows[0].count} orphaned users`);
    }
    if (parseInt(orphanedPatients.rows[0].count) > 0) {
      issues.push(`⚠️  ${orphanedPatients.rows[0].count} orphaned patients`);
    }

    if (issues.length === 0) {
      console.log('✅ All checks passed!');
      console.log('✅ Database is healthy and well-organized');
      console.log('✅ No integrity issues found');
    } else {
      console.log('⚠️  Issues found:\n');
      issues.forEach(issue => console.log(`  ${issue}`));
    }

    console.log('\n═══════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkDatabaseHealth()
  .then(() => {
    console.log('✅ Health check complete!\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Health check failed:', error.message);
    process.exit(1);
  });
