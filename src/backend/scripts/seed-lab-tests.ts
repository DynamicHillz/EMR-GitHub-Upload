import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TENANT_SLUG = 'st-stephen-hospital';

const LAB_TESTS_WITH_PRICES = [
  { name: 'Seminal Fluid Analysis (S.F.A)', code: 'LAB-SFA', price: 8000 },
  { name: 'H-Pylori', code: 'LAB-HPYLORI', price: 3000 },
  { name: 'Serum Bilirubin (SB, TB)', code: 'LAB-BILIRUBIN', price: 4000 },
  { name: 'Thyroid profile (Testosterone, T3, T4)', code: 'LAB-THYROID', price: 12500 },
  { name: 'High Vaginal Swab (HVS)', code: 'LAB-HVS', price: 5000 },
  { name: 'Endocervical Swab (ECS)', code: 'LAB-ECS', price: 5000 },
  { name: 'Ultrasound (US)', code: 'LAB-US', price: 5000 },
  { name: 'Urine/mcs', code: 'LAB-URINE-MCS', price: 5000 },
  { name: 'Transvaginal Scan (TVS)', code: 'LAB-TVS', price: 10000 },
  { name: 'FSH', code: 'LAB-FSH', price: 12500 },
  { name: 'LH', code: 'LAB-LH', price: 12500 },
  { name: 'Prolactin', code: 'LAB-PROLACTIN', price: 12500 },
  { name: 'Full Blood Count (FBC)', code: 'LAB-FBC', price: 5000 },
  { name: 'Malaria Parasite (MP)', code: 'LAB-MP', price: 2000 },
  { name: 'Packed Cell Volume (PCV)', code: 'LAB-PCV', price: 2000 },
  { name: 'WIDAL', code: 'LAB-WIDAL', price: 3000 },
  { name: 'Random Blood Sugar (RBS)', code: 'LAB-RBS', price: 2000 },
  { name: 'Fasting Blood Sugar (FBS)', code: 'LAB-FBS', price: 2000 },
  { name: 'Erythrocyte Sedimentation Rate (ESR)', code: 'LAB-ESR', price: 4000 },
  { name: 'Pregnancy Test (PT)', code: 'LAB-PT', price: 2000 },
  { name: 'HBSAg (Hepatitis B)', code: 'LAB-HBSAG', price: 2000 },
  { name: 'HCV (Hepatitis C)', code: 'LAB-HCV', price: 2000 },
  { name: 'H/A (Hepatitis A)', code: 'LAB-HAV', price: 2000 },
  { name: 'Retroviral Screening (RVS)', code: 'LAB-RVS', price: 4000 },
  { name: 'VDRL', code: 'LAB-VDRL', price: 2000 },
  { name: 'Cholesterol (CHOL)', code: 'LAB-CHOL', price: 5000 },
  { name: 'Lipid Profile', code: 'LAB-LIPID', price: 20000 },
  { name: 'F/P profile', code: 'LAB-FP', price: 15000 },
  { name: 'Prostate Specific Antigen (PSA)', code: 'LAB-PSA', price: 15000 },
  { name: 'Beta-HCG (B-HCG)', code: 'LAB-BHCG', price: 15000 },
  { name: 'Liver Function Test (LFT)', code: 'LAB-LFT', price: 20000 },
  { name: 'Glucose', code: 'LAB-GLUCOSE', price: 20000 },
  { name: 'Hormone Profile', code: 'LAB-HORMONE', price: 50000 }
];

const ADDITIONAL_LAB_TESTS = [
  { name: 'Urinalysis', code: 'LAB-URINALYSIS', price: 0 },
  { name: 'E/U/Cr (Electrolytes, Urea, Creatinine)', code: 'LAB-EUCR', price: 0 },
  { name: 'Uric Acid', code: 'LAB-URICACID', price: 0 },
  { name: 'Calcium', code: 'LAB-CALCIUM', price: 0 },
  { name: 'Phosphorus', code: 'LAB-PHOSPHORUS', price: 0 },
  { name: 'Magnesium', code: 'LAB-MAGNESIUM', price: 0 },
  { name: 'Serum Amylase', code: 'LAB-AMYLASE', price: 0 },
  { name: 'Serum Lipase', code: 'LAB-LIPASE', price: 0 },
  { name: 'CK-MB', code: 'LAB-CKMB', price: 0 },
  { name: 'Troponin I/T', code: 'LAB-TROPONIN', price: 0 },
  { name: 'D-Dimer', code: 'LAB-DDIMER', price: 0 },
  { name: 'Coagulation Profile (PT/APTT/INR)', code: 'LAB-COAG', price: 0 },
  { name: 'Blood Culture', code: 'LAB-BLOOD-CULTURE', price: 0 },
  { name: 'Sputum AFB', code: 'LAB-AFB', price: 0 },
  { name: 'Stool Microscopy', code: 'LAB-STOOL-MCS', price: 0 },
  { name: 'Occult Blood', code: 'LAB-OCCULT', price: 0 },
  { name: 'Pap Smear', code: 'LAB-PAP', price: 0 },
  { name: 'C-Reactive Protein (CRP)', code: 'LAB-CRP', price: 0 },
  { name: 'Rheumatoid Factor (RF)', code: 'LAB-RF', price: 0 },
  { name: 'HbA1c', code: 'LAB-HBA1C', price: 0 },
  { name: 'ABO/Rh Blood Grouping', code: 'LAB-BLOODGROUP', price: 0 },
  { name: 'Genotype', code: 'LAB-GENOTYPE', price: 0 },
  { name: 'Coombs Test', code: 'LAB-COOMBS', price: 0 }
];

async function main() {
  console.log('Seeding Lab Tests Catalog...');

  const tenant = await prisma.tenant.findUnique({
    where: { slug: TENANT_SLUG }
  });

  if (!tenant) {
    console.error('Tenant not found. Run main seed script first.');
    process.exit(1);
  }

  const allTests = [...LAB_TESTS_WITH_PRICES, ...ADDITIONAL_LAB_TESTS];
  let createdCount = 0;
  let updatedCount = 0;

  for (const test of allTests) {
    const existing = await prisma.serviceCatalog.findUnique({
      where: {
        tenantId_serviceCode: {
          tenantId: tenant.id,
          serviceCode: test.code
        }
      }
    });

    if (existing) {
      await prisma.serviceCatalog.update({
        where: { id: existing.id },
        data: {
          serviceName: test.name,
          basePrice: test.price,
          category: 'LAB_TEST'
        }
      });
      updatedCount++;
    } else {
      await prisma.serviceCatalog.create({
        data: {
          tenantId: tenant.id,
          serviceCode: test.code,
          serviceName: test.name,
          basePrice: test.price,
          category: 'LAB_TEST',
          isActive: true
        }
      });
      createdCount++;
    }
  }

  console.log(`Successfully created ${createdCount} tests and updated ${updatedCount} tests.`);
}

main()
  .catch(e => {
    console.error('Failed to seed lab tests:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
