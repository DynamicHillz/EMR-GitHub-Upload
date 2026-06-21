// Simple database connection test
require('dotenv').config();

const { PrismaClient } = require('./src/backend/generated/prisma');

async function testConnection() {
  console.log('\n🔍 Testing Supabase Database Connection...\n');
  console.log('Connection String:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@'));
  console.log('');

  const prisma = new PrismaClient({
    log: ['error', 'warn'],
  });

  try {
    console.log('⏳ Attempting to connect...');
    await prisma.$connect();
    console.log('✅ Successfully connected to database!');

    console.log('\n⏳ Testing query...');
    const result = await prisma.$queryRaw`SELECT version()`;
    console.log('✅ Query successful!');
    console.log('📊 Database version:', result[0].version);

    console.log('\n🎉 Connection test PASSED!\n');
    return true;
  } catch (error) {
    console.log('❌ Connection test FAILED!\n');
    console.error('Error details:');
    console.error('  Code:', error.code);
    console.error('  Message:', error.message);

    if (error.code === 'P1001') {
      console.log('\n💡 Troubleshooting tips:');
      console.log('   1. Check if Supabase project is ACTIVE (not paused)');
      console.log('   2. Verify connection string is correct');
      console.log('   3. Check if password special characters are URL-encoded');
      console.log('   4. Try the pooling connection (port 6543)');
      console.log('   5. Ensure your internet connection is working');
    }

    return false;
  } finally {
    await prisma.$disconnect();
  }
}

testConnection()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
