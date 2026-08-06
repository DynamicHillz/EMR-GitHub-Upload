/**
 * One-time backfill: Patient.hmoProvider was previously just a free-text
 * name typed/selected at registration, with no real link to InsuranceProvider.
 * This script matches existing patients to a real InsuranceProvider record
 * (case-insensitive name match, scoped to the same tenant) and sets the new
 * Patient.hmoProviderId FK — the field generate-invoice.use-case.ts now
 * actually reads for HMO billing.
 *
 * Safe to re-run: only touches patients where hmoProviderId is still null.
 * Ambiguous/no-match patients are left alone and printed for manual review,
 * never guessed.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Backfilling Patient.hmoProviderId from legacy hmoProvider text...');

  const patients = await prisma.patient.findMany({
    where: { hmoProvider: { not: null }, hmoProviderId: null, isDeleted: false },
    select: { id: true, tenantId: true, patientId: true, firstName: true, lastName: true, hmoProvider: true },
  });

  console.log(`Found ${patients.length} patient(s) with a legacy hmoProvider value and no link yet.`);

  let linked = 0;
  const unmatched: typeof patients = [];

  for (const patient of patients) {
    // Tier 1: exact name match.
    let candidates = await prisma.insuranceProvider.findMany({
      where: {
        tenantId: patient.tenantId,
        name: { equals: patient.hmoProvider!, mode: 'insensitive' },
      },
    });

    // Tier 2: patients were often registered with an abbreviated name
    // ("Reliance", "Avon") rather than the full legal name on file
    // ("Reliance HMO Limited") — a contains-match still only auto-links
    // when it's unambiguous (exactly one candidate), never guessed among
    // several.
    if (candidates.length === 0) {
      candidates = await prisma.insuranceProvider.findMany({
        where: {
          tenantId: patient.tenantId,
          name: { contains: patient.hmoProvider!, mode: 'insensitive' },
        },
      });
    }

    if (candidates.length === 1) {
      await prisma.patient.update({
        where: { id: patient.id },
        data: { hmoProviderId: candidates[0].id },
      });
      linked++;
    } else {
      unmatched.push(patient);
    }
  }

  console.log(`Linked ${linked} patient(s).`);

  if (unmatched.length > 0) {
    console.log(`\n${unmatched.length} patient(s) need manual review (no exact match, or more than one candidate):`);
    for (const p of unmatched) {
      console.log(`  - ${p.patientId} (${p.firstName} ${p.lastName}): hmoProvider = "${p.hmoProvider}"`);
    }
  }
}

main()
  .catch((e) => {
    console.error('Backfill failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
