/**
 * Seed ICD-10 Catalog (shared/global reference rows)
 *
 * Populates `DiagnosisCatalog` with `tenantId: null, type: 'ICD-10'` rows —
 * NOT tenant-scoped, unlike `seed-hmo-providers.ts`. These are shared
 * reference rows every tenant's diagnosis search can see (see the schema
 * comment on `DiagnosisCatalog.tenantId` and the partial unique index added
 * in the `make_diagnosis_catalog_shared_and_nullable_tenant` migration).
 *
 * Data source: `data/icd10-cm-2018-categories.json` — 24,628 category-level
 * ICD-10-CM codes, generated from the 2018 CMS ICD-10-CM release via
 * https://github.com/k4m1113/ICD-10-CSV (categories.csv). Category-level
 * (not the ~71k fully-granular billing subcodes in that repo's codes.csv)
 * is the right grain for clinical diagnosis search here.
 *
 * Run with: npx ts-node --project tsconfig.backend.json src/backend/scripts/seed-icd10-catalog.ts
 * (the --project flag is required here, unlike other scripts in this
 * folder — without it, ts-node resolves the root tsconfig's ESNext module
 * setting and Node's native ESM loader then refuses the JSON import above
 * with ERR_IMPORT_ATTRIBUTE_MISSING; tsconfig.backend.json's CommonJS
 * module setting avoids that.)
 */

import { PrismaClient } from '@prisma/client';
import icd10Codes from './data/icd10-cm-2018-categories.json';

const prisma = new PrismaClient();

// Postgres caps a single statement at 65,535 bound parameters. Each row
// binds 5 fields (tenantId, code, name, type, isActive), so ~24.6k rows in
// one createMany would blow past that — batch instead.
const BATCH_SIZE = 5000;

async function seedIcd10Catalog() {
  console.log(`Seeding ${icd10Codes.length} shared ICD-10 catalog rows in batches of ${BATCH_SIZE}...`);

  let totalCreated = 0;
  for (let i = 0; i < icd10Codes.length; i += BATCH_SIZE) {
    const batch = icd10Codes.slice(i, i + BATCH_SIZE);
    const result = await prisma.diagnosisCatalog.createMany({
      data: batch.map((item) => ({
        tenantId: null,
        code: item.code,
        name: item.name,
        type: 'ICD-10',
        isActive: true,
      })),
      skipDuplicates: true,
    });
    totalCreated += result.count;
    console.log(`  Batch ${i / BATCH_SIZE + 1}: created ${result.count}/${batch.length}`);
  }

  console.log(`Created: ${totalCreated}, Skipped (already present): ${icd10Codes.length - totalCreated}`);
}

seedIcd10Catalog()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
