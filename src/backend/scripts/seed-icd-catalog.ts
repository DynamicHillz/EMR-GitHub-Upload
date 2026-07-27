import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TENANT_SLUG = 'st-stephen-hospital';

const ICD11_CODES = [
  // Infectious & Parasitic
  { code: '1F40', name: 'Plasmodium falciparum malaria', type: 'ICD-11' },
  { code: '1F41', name: 'Plasmodium vivax malaria', type: 'ICD-11' },
  { code: '1F4Z', name: 'Malaria, unspecified', type: 'ICD-11' },
  { code: '1A00', name: 'Cholera', type: 'ICD-11' },
  { code: '1B10', name: 'Respiratory tuberculosis', type: 'ICD-11' },
  { code: '1B1Z', name: 'Tuberculosis, unspecified', type: 'ICD-11' },
  { code: '1C62', name: 'Human immunodeficiency virus disease without mentioned associated disease', type: 'ICD-11' },
  { code: '1D00', name: 'Viral infection of unspecified site', type: 'ICD-11' },
  
  // Respiratory
  { code: 'CA01', name: 'Acute upper respiratory infection', type: 'ICD-11' },
  { code: 'CA40', name: 'Pneumonia', type: 'ICD-11' },
  { code: 'CA20', name: 'Acute bronchitis', type: 'ICD-11' },
  { code: 'CA23', name: 'Asthma', type: 'ICD-11' },
  
  // Cardiovascular
  { code: 'BA00', name: 'Essential hypertension', type: 'ICD-11' },
  { code: 'BA41', name: 'Acute myocardial infarction', type: 'ICD-11' },
  { code: 'BD11', name: 'Heart failure', type: 'ICD-11' },
  { code: '8B90', name: 'Stroke, not known if ischaemic or haemorrhagic', type: 'ICD-11' },

  // Metabolic/Endocrine
  { code: '5A10', name: 'Type 1 diabetes mellitus', type: 'ICD-11' },
  { code: '5A11', name: 'Type 2 diabetes mellitus', type: 'ICD-11' },
  { code: '5B5B', name: 'Obesity', type: 'ICD-11' },

  // Digestive
  { code: 'DA20', name: 'Dental caries', type: 'ICD-11' },
  { code: 'DD70', name: 'Gastritis', type: 'ICD-11' },
  { code: 'DD90', name: 'Peptic ulcer disease', type: 'ICD-11' },
  { code: 'DD30', name: 'Gastroenteritis or colitis of infectious origin', type: 'ICD-11' },

  // Maternal
  { code: 'JA00', name: 'Normal pregnancy', type: 'ICD-11' },
  { code: 'JB40', name: 'Pre-eclampsia', type: 'ICD-11' },

  // Symptoms
  { code: 'MA00', name: 'Abdominal and pelvic pain', type: 'ICD-11' },
  { code: 'MG26', name: 'Fever of other or unknown origin', type: 'ICD-11' },
  { code: 'MG24', name: 'Pain, unspecified', type: 'ICD-11' },
  { code: 'MG30', name: 'Headache', type: 'ICD-11' },
  
  // Musculoskeletal
  { code: 'FA00', name: 'Rheumatoid arthritis', type: 'ICD-11' },
  { code: 'FA30', name: 'Osteoarthritis', type: 'ICD-11' },
  { code: 'ME04', name: 'Low back pain', type: 'ICD-11' },

  // ICD-10 Fallbacks (Common ones still heavily used)
  { code: 'A09', name: 'Infectious gastroenteritis and colitis, unspecified', type: 'ICD-10' },
  { code: 'I10', name: 'Essential (primary) hypertension', type: 'ICD-10' },
  { code: 'E11', name: 'Type 2 diabetes mellitus', type: 'ICD-10' },
];

async function seedICDCodes() {
  console.log('Starting ICD-11 catalog seed...');

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: TENANT_SLUG },
    });

    if (!tenant) {
      console.error(`Tenant with slug '${TENANT_SLUG}' not found.`);
      process.exit(1);
    }

    let createdCount = 0;
    let skippedCount = 0;

    for (const item of ICD11_CODES) {
      // @ts-ignore - Temporary fix for schema alignment
      const existing = await prisma.diagnosisCatalog.findUnique({
        where: {
          tenantId_code: {
            tenantId: tenant.id,
            code: item.code,
          },
        },
      });

      if (!existing) {
        // @ts-ignore - Temporary fix for schema alignment
        await prisma.diagnosisCatalog.create({
          data: {
            tenantId: tenant.id,
            code: item.code,
            name: item.name,
            type: item.type,
            isActive: true,
          },
        });
        createdCount++;
        console.log(`Created: [${item.code}] ${item.name}`);
      } else {
        skippedCount++;
      }
    }

    console.log(`Seed complete! Created: ${createdCount}, Skipped: ${skippedCount}`);
  } catch (error) {
    console.error('Seed failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedICDCodes();
