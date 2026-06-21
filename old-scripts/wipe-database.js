/**
 * Wipe Database - Remove ALL tables, types, functions
 */

const { Client } = require('pg');
require('dotenv').config();

async function wipeDatabase() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });

  try {
    console.log('\n⚠️  WARNING: This will DELETE EVERYTHING in the database!');
    console.log('Waiting 3 seconds... Press Ctrl+C to cancel\n');

    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('🔌 Connecting...');
    await client.connect();
    console.log('✅ Connected!\n');

    console.log('🗑️  Dropping all tables...');
    await client.query(`
      DO $$
      DECLARE
        r RECORD;
      BEGIN
        -- Drop all tables
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
          EXECUTE 'DROP TABLE IF EXISTS "' || r.tablename || '" CASCADE';
        END LOOP;
      END $$;
    `);
    console.log('✅ All tables dropped\n');

    console.log('🗑️  Dropping all enums/types...');
    await client.query(`
      DO $$
      DECLARE
        r RECORD;
      BEGIN
        -- Drop all enums
        FOR r IN (SELECT typname FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typtype = 'e') LOOP
          EXECUTE 'DROP TYPE IF EXISTS "' || r.typname || '" CASCADE';
        END LOOP;
      END $$;
    `);
    console.log('✅ All types dropped\n');

    console.log('🗑️  Dropping all functions...');
    await client.query(`
      DO $$
      DECLARE
        r RECORD;
      BEGIN
        FOR r IN (SELECT proname, oidvectortypes(proargtypes) as argtypes
                  FROM pg_proc INNER JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid
                  WHERE pg_namespace.nspname = 'public') LOOP
          EXECUTE 'DROP FUNCTION IF EXISTS "' || r.proname || '"(' || r.argtypes || ') CASCADE';
        END LOOP;
      END $$;
    `);
    console.log('✅ All functions dropped\n');

    console.log('='.repeat(60));
    console.log('✨ DATABASE WIPED CLEAN!');
    console.log('='.repeat(60));
    console.log('\nNext step: Run the setup');
    console.log('  npx prisma db push --accept-data-loss');
    console.log('  node final-create-admin.js\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

wipeDatabase()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
