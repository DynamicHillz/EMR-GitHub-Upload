/**
 * Drug Interaction Checker
 *
 * Shared logic for checking a candidate medication against a patient's
 * currently active prescriptions. Used both at the moment of prescribing
 * (so the doctor sees it before committing, not just the pharmacist at
 * dispense time) and when a prescription is actually created — same
 * query, one place, so the two can't silently drift apart.
 */

import { PrismaClient, AlertSeverity } from '@prisma/client';
import { matchesDrugClassGroup } from '../../shared/constants/drug-class-groups';

export interface InteractionCheckResult {
  interactionWarning: boolean;
  interactionDetails: string[];
  highestSeverity: AlertSeverity | null;
}

const SEVERITY_RANK: Record<AlertSeverity, number> = { INFO: 0, WARNING: 1, CRITICAL: 2 };

function highestOf(severities: AlertSeverity[]): AlertSeverity | null {
  if (severities.length === 0) return null;
  return severities.reduce((max, s) => (SEVERITY_RANK[s] > SEVERITY_RANK[max] ? s : max));
}

async function getActiveMedications(
  prisma: PrismaClient,
  tenantId: string,
  patientId: string
): Promise<string[]> {
  const activePrescriptions = await prisma.prescription.findMany({
    where: {
      patientId,
      tenantId,
      status: { in: ['PENDING', 'DISPENSED'] },
    },
    select: { medicationName: true },
  });

  return activePrescriptions.map((p) => p.medicationName);
}

export async function checkDrugInteractions(
  prisma: PrismaClient,
  tenantId: string,
  patientId: string,
  medicationName: string
): Promise<InteractionCheckResult> {
  const activeMeds = await getActiveMedications(prisma, tenantId, patientId);

  if (activeMeds.length === 0) {
    return { interactionWarning: false, interactionDetails: [], highestSeverity: null };
  }

  const orConditions = activeMeds.flatMap((med) => [
    { drug1: { contains: medicationName, mode: 'insensitive' as const }, drug2: { contains: med, mode: 'insensitive' as const } },
    { drug2: { contains: medicationName, mode: 'insensitive' as const }, drug1: { contains: med, mode: 'insensitive' as const } },
  ]);

  const interactions = await prisma.drugInteraction.findMany({
    where: { OR: orConditions },
  });

  if (interactions.length === 0) {
    return { interactionWarning: false, interactionDetails: [], highestSeverity: null };
  }

  const interactionDetails = interactions.map(
    (i) =>
      `Interaction with ${i.drug1.toLowerCase() === medicationName.toLowerCase() ? i.drug2 : i.drug1}: ${i.description} (${i.severity})`
  );

  return {
    interactionWarning: true,
    interactionDetails,
    highestSeverity: highestOf(interactions.map((i) => i.severity)),
  };
}

export interface DuplicateTherapyCheckResult {
  duplicateWarning: boolean;
  duplicateDetails: string[];
  highestSeverity: AlertSeverity | null;
}

/**
 * Flags when a candidate medication either exactly duplicates a currently
 * active prescription (e.g. re-prescribing the same drug) or shares a
 * therapeutic class with one (e.g. two different NSAIDs) — reuses the same
 * curated class groups already used for allergy cross-reactivity matching.
 */
export async function checkDuplicateTherapy(
  prisma: PrismaClient,
  tenantId: string,
  patientId: string,
  medicationName: string
): Promise<DuplicateTherapyCheckResult> {
  const activeMeds = await getActiveMedications(prisma, tenantId, patientId);

  if (activeMeds.length === 0) {
    return { duplicateWarning: false, duplicateDetails: [], highestSeverity: null };
  }

  const medLower = medicationName.toLowerCase();
  const details: string[] = [];
  const severities: AlertSeverity[] = [];

  for (const med of activeMeds) {
    const medOtherLower = med.toLowerCase();
    if (medOtherLower === medLower) {
      details.push(`Already prescribing ${med} (same medication, active)`);
      severities.push('CRITICAL');
    } else if (medLower.includes(medOtherLower) || medOtherLower.includes(medLower)) {
      details.push(`Already prescribing ${med} (closely matching name, active)`);
      severities.push('WARNING');
    } else if (matchesDrugClassGroup(med, medicationName)) {
      details.push(`Already prescribing ${med} (same therapeutic class, active)`);
      severities.push('WARNING');
    }
  }

  if (details.length === 0) {
    return { duplicateWarning: false, duplicateDetails: [], highestSeverity: null };
  }

  return { duplicateWarning: true, duplicateDetails: details, highestSeverity: highestOf(severities) };
}
