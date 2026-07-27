import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillAccessionNumbers() {
  console.log('Starting accession number backfill...');
  
  const records = await prisma.labTestRecord.findMany({
    where: {
      accessionNumber: null,
    },
    include: {
      order: true
    }
  });

  console.log(`Found ${records.length} records to backfill.`);

  for (const record of records) {
    const datePart = record.createdAt.toISOString().slice(2, 10).replace(/-/g, '');
    const randomPart = Math.floor(1000 + Math.random() * 9000).toString();
    const accessionNumber = `LAB-${datePart}-${randomPart}`;

    await prisma.labTestRecord.update({
      where: { id: record.id },
      data: { accessionNumber }
    });
    
    console.log(`Updated record ${record.id} with accessionNumber: ${accessionNumber}`);
  }

  console.log('Backfill complete!');
}

backfillAccessionNumbers()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
