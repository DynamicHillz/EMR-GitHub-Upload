/**
 * Drug Class Groups (frontend mirror)
 *
 * Keep in sync with src/backend/shared/constants/drug-class-groups.ts —
 * this is the live, pre-submit preview shown in the prescribing UI; the
 * backend copy is the one actually enforced at dispense/prescribe time.
 */

export const DRUG_CLASS_GROUPS: string[][] = [
  ['penicillin', 'amoxicillin', 'amoxiclav', 'augmentin', 'ampicillin', 'flucloxacillin', 'cloxacillin', 'piperacillin'],
  ['cephalosporin', 'cefuroxime', 'ceftriaxone', 'cefixime', 'cefpodoxime', 'cephalexin', 'cefaclor', 'cefotaxime'],
  ['sulfonamide', 'sulfa', 'sulfamethoxazole', 'co-trimoxazole', 'cotrimoxazole', 'septrin', 'bactrim'],
  ['nsaid', 'ibuprofen', 'diclofenac', 'naproxen', 'aspirin', 'indomethacin', 'ketorolac', 'meloxicam', 'piroxicam'],
  ['macrolide', 'erythromycin', 'azithromycin', 'clarithromycin'],
];

export function matchesDrugClassGroup(allergen: string, medicationName: string): boolean {
  const allergenLower = allergen.toLowerCase();
  const medLower = medicationName.toLowerCase();

  return DRUG_CLASS_GROUPS.some((group) => {
    const allergenInGroup = group.some((entry) => allergenLower.includes(entry) || entry.includes(allergenLower));
    const medInGroup = group.some((entry) => medLower.includes(entry) || entry.includes(medLower));
    return allergenInGroup && medInGroup;
  });
}
