import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const WHO_EML_MEDICATIONS = [
  // Analgesics, antipyretics
  {
    name: 'Paracetamol',
    genericName: 'Paracetamol',
    activeIngredient: 'Paracetamol',
    category: 'Analgesics',
    dosageForm: 'Tablet',
    strength: '500mg',
    drugClass: 'Non-opioid analgesic',
    whoAtcCode: 'N02BE01',
    isEssentialMedicine: true,
  },
  {
    name: 'Ibuprofen',
    genericName: 'Ibuprofen',
    activeIngredient: 'Ibuprofen',
    category: 'Analgesics',
    dosageForm: 'Tablet',
    strength: '400mg',
    drugClass: 'NSAID',
    whoAtcCode: 'M01AE01',
    isEssentialMedicine: true,
  },
  // Antibacterials
  {
    name: 'Amoxicillin',
    genericName: 'Amoxicillin',
    activeIngredient: 'Amoxicillin',
    category: 'Antibiotics',
    dosageForm: 'Capsule',
    strength: '500mg',
    drugClass: 'Penicillin',
    whoAtcCode: 'J01CA04',
    isEssentialMedicine: true,
  },
  {
    name: 'Ciprofloxacin',
    genericName: 'Ciprofloxacin',
    activeIngredient: 'Ciprofloxacin',
    category: 'Antibiotics',
    dosageForm: 'Tablet',
    strength: '500mg',
    drugClass: 'Fluoroquinolone',
    whoAtcCode: 'J01MA02',
    isEssentialMedicine: true,
  },
  {
    name: 'Azithromycin',
    genericName: 'Azithromycin',
    activeIngredient: 'Azithromycin',
    category: 'Antibiotics',
    dosageForm: 'Tablet',
    strength: '500mg',
    drugClass: 'Macrolide',
    whoAtcCode: 'J01FA10',
    isEssentialMedicine: true,
  },
  // Antimalarials
  {
    name: 'Artemether + Lumefantrine',
    genericName: 'Artemether/Lumefantrine',
    activeIngredient: 'Artemether/Lumefantrine',
    category: 'Antimalarials',
    dosageForm: 'Tablet',
    strength: '20mg/120mg',
    drugClass: 'Antimalarial',
    whoAtcCode: 'P01BF01',
    isEssentialMedicine: true,
  },
  // Cardiovascular
  {
    name: 'Amlodipine',
    genericName: 'Amlodipine',
    activeIngredient: 'Amlodipine',
    category: 'Cardiovascular',
    dosageForm: 'Tablet',
    strength: '5mg',
    drugClass: 'Calcium Channel Blocker',
    whoAtcCode: 'C08CA01',
    isEssentialMedicine: true,
  },
  {
    name: 'Lisinopril',
    genericName: 'Lisinopril',
    activeIngredient: 'Lisinopril',
    category: 'Cardiovascular',
    dosageForm: 'Tablet',
    strength: '10mg',
    drugClass: 'ACE Inhibitor',
    whoAtcCode: 'C09AA03',
    isEssentialMedicine: true,
  },
  // Antidiabetics
  {
    name: 'Metformin',
    genericName: 'Metformin',
    activeIngredient: 'Metformin',
    category: 'Antidiabetics',
    dosageForm: 'Tablet',
    strength: '500mg',
    drugClass: 'Biguanide',
    whoAtcCode: 'A10BA02',
    isEssentialMedicine: true,
  },
  {
    name: 'Insulin Glargine',
    genericName: 'Insulin Glargine',
    activeIngredient: 'Insulin Glargine',
    category: 'Antidiabetics',
    dosageForm: 'Injection',
    strength: '100 IU/mL',
    drugClass: 'Long-acting insulin',
    whoAtcCode: 'A10AE04',
    isEssentialMedicine: true,
  },
  // Respiratory
  {
    name: 'Salbutamol',
    genericName: 'Salbutamol',
    activeIngredient: 'Salbutamol',
    category: 'Respiratory',
    dosageForm: 'Inhaler',
    strength: '100mcg/dose',
    drugClass: 'Beta-2 Agonist',
    whoAtcCode: 'R03AC02',
    isEssentialMedicine: true,
  }
];

async function main() {
  console.log('🌱 Starting WHO Essential Medicines List (EML) seed...');

  // Assuming a default tenant exists
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    console.error('❌ No tenant found. Please ensure a tenant exists before running this script.');
    process.exit(1);
  }

  const tenantId = tenant.id;

  for (const med of WHO_EML_MEDICATIONS) {
    // Check if medication already exists
    const existingMed = await prisma.medication.findFirst({
      where: {
        tenantId,
        activeIngredient: med.activeIngredient,
        dosageForm: med.dosageForm,
        strength: med.strength,
      }
    });

    if (existingMed) {
      await prisma.medication.update({
        where: { id: existingMed.id },
        data: {
          // @ts-ignore - Temporary fix for schema alignment
          whoAtcCode: med.whoAtcCode,
          isEssentialMedicine: med.isEssentialMedicine,
        }
      });
      console.log(`Updated: ${med.name} with WHO ATC Code ${med.whoAtcCode}`);
    } else {
      await prisma.medication.create({
        // @ts-ignore - Temporary fix for schema alignment
        data: {
          ...med,
          tenantId,
          unitPrice: 10.0, // Default price
          status: 'AVAILABLE',
          stockLevel: 100, // Seed with some stock
        }
      });
      console.log(`Created: ${med.name} (WHO ATC: ${med.whoAtcCode})`);
    }
  }

  console.log('✅ WHO EML seed completed successfully.');
}

main()
  .catch((e) => {
    console.error('Error during WHO EML seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
