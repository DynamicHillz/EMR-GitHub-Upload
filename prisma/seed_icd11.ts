import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ICD11_CODES = [
  // Certain infectious or parasitic diseases
  { code: '1A00', name: 'Cholera' },
  { code: '1A01', name: 'Intestinal infection due to other Vibrio' },
  { code: '1A02', name: 'Intestinal infections due to Shigella' },
  { code: '1B10', name: 'Tuberculosis of respiratory system' },
  { code: '1C62', name: 'Plasmodium falciparum malaria' },
  { code: '1E31', name: 'Acute poliomyelitis' },
  { code: '1F40', name: 'Rabies' },
  
  // Neoplasms
  { code: '2A20', name: 'Malignant neoplasm of stomach' },
  { code: '2C25', name: 'Malignant neoplasm of breast' },
  { code: '2C61', name: 'Malignant neoplasm of prostate' },

  // Diseases of the blood or blood-forming organs
  { code: '3A00', name: 'Iron deficiency anaemia' },
  { code: '3A51', name: 'Sickle cell disorders' },

  // Endocrine, nutritional or metabolic diseases
  { code: '5A10', name: 'Type 1 diabetes mellitus' },
  { code: '5A11', name: 'Type 2 diabetes mellitus' },
  { code: '5B50', name: 'Obesity' },
  { code: '5B54', name: 'Severe acute malnutrition' },

  // Mental, behavioural or neurodevelopmental disorders
  { code: '6A70', name: 'Single episode of depressive disorder' },
  { code: '6B00', name: 'Generalized anxiety disorder' },

  // Sleep-wake disorders
  { code: '7A00', name: 'Insomnia' },

  // Diseases of the nervous system
  { code: '8A20', name: 'Epilepsy' },
  { code: '8B00', name: 'Migraine' },

  // Diseases of the circulatory system
  { code: 'BA00', name: 'Essential hypertension' },
  { code: 'BA41', name: 'Acute myocardial infarction' },
  { code: 'BB40', name: 'Heart failure' },

  // Diseases of the respiratory system
  { code: 'CA23', name: 'Asthma' },
  { code: 'CA40', name: 'Pneumonia' },

  // Diseases of the digestive system
  { code: 'DA04', name: 'Gastro-oesophageal reflux disease' },
  { code: 'DA21', name: 'Peptic ulcer' },
  
  // Maternal / Pregnancy
  { code: 'JA00', name: 'Ectopic pregnancy' },
  { code: 'JA40', name: 'Gestational diabetes mellitus' },
  { code: 'JA41', name: 'Pre-eclampsia' }
];

async function main() {
  console.log('Starting ICD-11 Diagnosis seeding...');
  const tenantId = '3ffae4f7-d90b-4d2a-b67e-0f98d35fde70'; // Default tenant

  for (const item of ICD11_CODES) {
    await prisma.diagnosisCatalog.upsert({
      where: {
        tenantId_code: {
          tenantId,
          code: item.code
        }
      },
      update: {
        name: item.name,
        type: 'ICD-11'
      },
      create: {
        tenantId,
        code: item.code,
        name: item.name,
        type: 'ICD-11',
        description: `WHO ICD-11 standard code: ${item.name}`
      }
    });
  }

  console.log(`Seeded ${ICD11_CODES.length} ICD-11 diagnoses.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
