/**
 * Drug Class Groups
 *
 * A small, curated cross-reference for allergy matching — e.g. a patient
 * with a recorded "Penicillin" allergy should also be flagged when
 * prescribed/dispensed "Amoxicillin", not just an exact/substring match
 * on the word "penicillin" itself.
 *
 * Deliberately NOT a full drug taxonomy: the schema has no drug-class
 * field to drive this from real data, so this is a pragmatic, reviewable
 * list covering the families most likely to matter for this formulary —
 * not a claim of clinical completeness. Extend the arrays below as needed.
 */

export const DRUG_CLASS_GROUPS: string[][] = [
  // Penicillins
  ['penicillin', 'amoxicillin', 'amoxiclav', 'augmentin', 'ampicillin', 'flucloxacillin', 'cloxacillin', 'piperacillin'],
  // Cephalosporins
  ['cephalosporin', 'cefuroxime', 'ceftriaxone', 'cefixime', 'cefpodoxime', 'cephalexin', 'cefaclor', 'cefotaxime'],
  // Sulfonamides
  ['sulfonamide', 'sulfa', 'sulfamethoxazole', 'co-trimoxazole', 'cotrimoxazole', 'septrin', 'bactrim'],
  // NSAIDs
  ['nsaid', 'ibuprofen', 'diclofenac', 'naproxen', 'aspirin', 'indomethacin', 'ketorolac', 'meloxicam', 'piroxicam'],
  // Macrolides
  ['macrolide', 'erythromycin', 'azithromycin', 'clarithromycin'],
];

/**
 * True if the allergen and medicationName fall in the same curated group,
 * even when neither string contains the other.
 */
export function matchesDrugClassGroup(allergen: string, medicationName: string): boolean {
  const allergenLower = allergen.toLowerCase();
  const medLower = medicationName.toLowerCase();

  return DRUG_CLASS_GROUPS.some((group) => {
    const allergenInGroup = group.some((entry) => allergenLower.includes(entry) || entry.includes(allergenLower));
    const medInGroup = group.some((entry) => medLower.includes(entry) || entry.includes(medLower));
    return allergenInGroup && medInGroup;
  });
}
