/**
 * Test Prisma query to see which table it's using
 */

const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function testQuery() {
  try {
    console.log('Testing Prisma query...\n');

    const users = await prisma.user.findMany({
      take: 5,
    });

    console.log(`\nFound ${users.length} users:`);
    users.forEach(user => {
      console.log(`  - ${user.email} (${user.role})`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testQuery();
