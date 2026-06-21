/**
 * Check if there are patients in the database
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    const patientCount = await prisma.patient.count();
    console.log(`Total patients in database: ${patientCount}`);

    if (patientCount > 0) {
      const patients = await prisma.patient.findMany({
        take: 5,
        select: {
          id: true,
          patientId: true,
          firstName: true,
          lastName: true,
          phone: true,
        }
      });

      console.log('\nFirst 5 patients:');
      patients.forEach(p => {
        console.log(`  - ${p.patientId}: ${p.firstName} ${p.lastName} (${p.phone || 'No phone'})`);
      });
    } else {
      console.log('\n⚠️  No patients found in database!');
      console.log('You need to register some patients first.');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
