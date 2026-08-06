/**
 * Age Utilities
 *
 * Pure functions — no Prisma dependency. `ageInYears` was previously
 * duplicated as a private method inside sync-dhis2-aggregate.use-case.ts;
 * extracted here since the NHMIS monthly return report needs the same
 * calculation plus age-group bucketing.
 */

export function ageInYears(dateOfBirth: Date, at: Date): number {
  const ageInMs = at.getTime() - dateOfBirth.getTime();
  return ageInMs / (1000 * 60 * 60 * 24 * 365.25);
}

// Standard NHMIS-style age-group breakdown for attendance reporting. This is
// the part most likely to need adjusting once compared against St.
// Stephen's actual paper form — no real copy was available when this was
// built, so these bands follow the commonly-used NHMIS structure rather
// than a confirmed exact match.
export const NHMIS_AGE_GROUPS = ['<1', '1-4', '5-9', '10-19', '20-49', '50+'] as const;
export type NhmisAgeGroup = (typeof NHMIS_AGE_GROUPS)[number];

export function ageGroup(years: number): NhmisAgeGroup {
  if (years < 1) return '<1';
  if (years < 5) return '1-4';
  if (years < 10) return '5-9';
  if (years < 20) return '10-19';
  if (years < 50) return '20-49';
  return '50+';
}
