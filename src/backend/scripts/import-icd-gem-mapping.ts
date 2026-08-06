/**
 * Import ICD-10 <-> ICD-11 Equivalence Mapping
 *
 * Populates `DiagnosisCodeMapping` with WHO's own ICD-10-to-ICD-11
 * crosswalk. NOT tenant-scoped — pure reference data, same as the ICD-10
 * catalog in seed-icd10-catalog.ts.
 *
 * Data source: `data/icd10-to-icd11-who-mapping.json` — 38,059 rows,
 * filtered to only the "WHO map" tagged entries (WHO's own official
 * mapping tables, not the academic Fung et al./manual-annotation
 * supplementary mappings also present in the upstream source) from
 * https://github.com/JeanNikiema/mimicinicd11
 * (MappingScript/MappingsTable/ICD10cm_to_ICD11.csv), itself built from
 * WHO's published mapping.zip (https://icd.who.int/browse11/Downloads).
 *
 * mapKind is derived, not asserted by the source file: a sourceCode with
 * exactly one distinct targetCode across the WHO-map rows is 'EXACT'; more
 * than one is 'ONE_TO_MANY'. The source data doesn't distinguish an
 * 'APPROXIMATE' tier — only these two values appear from this import.
 *
 * Coverage note: this crosswalk was built by the source project to cover
 * ICD-10-CM codes appearing in the MIMIC-IV critical-care research
 * database, not a from-scratch encoding of every WHO mapping table entry.
 * It's genuinely WHO-sourced and large (38k rows), but may under-cover
 * primary/community-care-specific ICD-10 codes relative to WHO's full
 * published table. Re-running this script with an updated/more complete
 * source file (same JSON shape) requires no script changes.
 *
 * Run with: npx ts-node --project tsconfig.backend.json src/backend/scripts/import-icd-gem-mapping.ts
 * (same --project requirement as seed-icd10-catalog.ts, for the same
 * JSON-import-under-ESM reason.)
 */

import { PrismaClient } from '@prisma/client';
import mappings from './data/icd10-to-icd11-who-mapping.json';

const prisma = new PrismaClient();

// Same Postgres 65,535-bound-parameter-per-statement ceiling as
// seed-icd10-catalog.ts — each row binds 5 fields here too.
const BATCH_SIZE = 5000;

async function importIcdGemMapping() {
  console.log(`Importing ${mappings.length} ICD-10<->ICD-11 mapping rows in batches of ${BATCH_SIZE}...`);

  let totalCreated = 0;
  for (let i = 0; i < mappings.length; i += BATCH_SIZE) {
    const batch = mappings.slice(i, i + BATCH_SIZE);
    const result = await prisma.diagnosisCodeMapping.createMany({
      data: batch,
      skipDuplicates: true,
    });
    totalCreated += result.count;
    console.log(`  Batch ${i / BATCH_SIZE + 1}: created ${result.count}/${batch.length}`);
  }

  console.log(`Created: ${totalCreated}, Skipped (already present): ${mappings.length - totalCreated}`);
}

importIcdGemMapping()
  .catch((error) => {
    console.error('Import failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
