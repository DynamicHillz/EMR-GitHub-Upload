import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateInvoices() {
  console.log('Starting invoice line items migration...');
  
  const invoices = await prisma.invoice.findMany({
    include: { items: true }
  });
  console.log(`Found ${invoices.length} invoices to check.`);

  let migratedCount = 0;

  for (const invoice of invoices) {
    if (!invoice.lineItems) continue;
    
    // Skip if already migrated
    if (invoice.items && invoice.items.length > 0) continue;

    try {
      const items = JSON.parse(invoice.lineItems);
      if (!Array.isArray(items)) continue;

      console.log(`Migrating invoice ${invoice.invoiceNumber} with ${items.length} items...`);

      for (const item of items) {
        // Create an InvoiceLineItem
        await prisma.invoiceLineItem.create({
          data: {
            invoiceId: invoice.id,
            serviceCode: item.serviceId || 'UNKNOWN',
            description: item.serviceName || item.description || 'Unknown Service',
            quantity: item.quantity || 1,
            unitPrice: item.unitPrice || item.price || 0,
            discount: item.discount || 0,
            tax: item.tax || 0,
            subtotal: item.total || item.subtotal || 0,
            insuranceCoverage: 0,
            patientOutOfPocket: item.total || item.subtotal || 0,
          }
        });
      }
      migratedCount++;
    } catch (e) {
      console.error(`Error migrating invoice ${invoice.id}:`, e);
    }
  }

  console.log(`Successfully migrated line items for ${migratedCount} invoices.`);
}

migrateInvoices()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    console.log('Migration complete.');
  });
