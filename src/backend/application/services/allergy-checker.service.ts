/**
 * Allergy Checker
 *
 * Shared logic for checking a candidate medication against a patient's
 * recorded allergies. Extracted from create-prescription.use-case.ts so any
 * other code path that creates a Prescription (e.g. inpatient ward rounds)
 * can enforce the same REQ-CLIN-7 check instead of silently skipping it.
 */

import { matchesDrugClassGroup } from '../../shared/constants/drug-class-groups';

/**
 * Check if medication name matches any patient allergies
 * REQ-CLIN-7: Display warnings for medication allergies
 */
export function checkForAllergies(medicationName: string, allergies: string[]): boolean {
  if (!allergies || allergies.length === 0) {
    return false;
  }

  const medLower = medicationName.toLowerCase();

  return allergies.some((allergy) => {
    const allergyLower = allergy.toLowerCase();

    // Check if medication name contains the allergy or vice versa, or the
    // two fall in the same curated drug-class group (e.g. Penicillin -> Amoxicillin)
    return (
      medLower.includes(allergyLower) ||
      allergyLower.includes(medLower) ||
      matchesDrugClassGroup(allergy, medicationName)
    );
  });
}

/**
 * Find which specific allergies match the medication
 */
export function findMatchingAllergies(medicationName: string, allergies: string[]): string[] {
  const medLower = medicationName.toLowerCase();

  return allergies.filter((allergy) => {
    const allergyLower = allergy.toLowerCase();
    return (
      medLower.includes(allergyLower) ||
      allergyLower.includes(medLower) ||
      matchesDrugClassGroup(allergy, medicationName)
    );
  });
}
