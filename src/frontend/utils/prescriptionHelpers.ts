export const DURATION_OPTIONS = [
  'Select duration', '3 days', '5 days', '7 days', '10 days', '14 days',
  '1 month', '3 months', 'STAT (single dose)', 'Until discontinued',
];

// Best-guess route from the medication's inventory dosage form — doctors can still change it.
export const mapDosageFormToRoute = (dosageForm?: string): string | null => {
  if (!dosageForm) return null;
  const form = dosageForm.toLowerCase();
  if (form.includes('tablet') || form.includes('capsule') || form.includes('syrup')) return 'ORAL';
  if (form.includes('injection')) return 'INTRAVENOUS';
  if (form.includes('cream') || form.includes('ointment')) return 'TOPICAL';
  if (form.includes('drop')) return 'OPHTHALMIC';
  if (form.includes('inhaler')) return 'INHALATION';
  return null;
};

export interface QuantityLabel {
  qtyLabel: string;
  qtyPlaceholder: string;
}

// Route-level fallback for the quantity field — used when the specific
// dosage form isn't known (e.g. medication typed freehand, not selected
// from inventory).
const ROUTE_QUANTITY_FALLBACK: Record<string, QuantityLabel> = {
  TOPICAL: { qtyLabel: 'Quantity (Tubes/Grams)', qtyPlaceholder: 'e.g., 1' },
  OPHTHALMIC: { qtyLabel: 'Quantity (Bottles)', qtyPlaceholder: 'e.g., 1' },
  OTIC: { qtyLabel: 'Quantity (Bottles)', qtyPlaceholder: 'e.g., 1' },
  INTRAVENOUS: { qtyLabel: 'Quantity (Vials/Ampoules/Bags)', qtyPlaceholder: 'e.g., 2' },
  INTRAMUSCULAR: { qtyLabel: 'Quantity (Vials/Ampoules/Bags)', qtyPlaceholder: 'e.g., 2' },
  SUBCUTANEOUS: { qtyLabel: 'Quantity (Vials/Ampoules/Bags)', qtyPlaceholder: 'e.g., 2' },
  INHALATION: { qtyLabel: 'Quantity (Inhalers)', qtyPlaceholder: 'e.g., 1' },
};

// The quantity field's label/unit should match the medication's actual
// dosage form (Tablet/Capsule/Syrup are all route ORAL, so route alone
// can't tell them apart). Falls back to the coarser route-based default
// when the dosage form isn't known (e.g. medication typed freehand rather
// than selected from inventory).
//
// Tablet/Capsule say "Total Quantity" rather than "No of Tablets" to stay
// unambiguous next to the separate per-dose field (see
// getUnitsPerDoseLabel below) — this is the total dispensed to the
// patient, not what they take per dose.
export const getQuantityLabel = (route: string, dosageForm?: string): QuantityLabel => {
  const form = (dosageForm || '').toLowerCase();

  if (form.includes('tablet')) return { qtyLabel: 'Total Quantity (Tablets)', qtyPlaceholder: 'e.g., 30' };
  if (form.includes('capsule')) return { qtyLabel: 'Total Quantity (Capsules)', qtyPlaceholder: 'e.g., 30' };
  if (form.includes('suppository')) return { qtyLabel: 'No of Suppositories', qtyPlaceholder: 'e.g., 5' };
  if (form.includes('lozenge')) return { qtyLabel: 'No of Lozenges', qtyPlaceholder: 'e.g., 10' };
  if (form.includes('sachet') || form.includes('powder')) return { qtyLabel: 'No of Sachets', qtyPlaceholder: 'e.g., 10' };
  if (form.includes('patch')) return { qtyLabel: 'No of Patches', qtyPlaceholder: 'e.g., 4' };
  if (form.includes('syrup') || form.includes('suspension') || form.includes('solution') || form.includes('elixir')) {
    return { qtyLabel: 'Volume (ml)', qtyPlaceholder: 'e.g., 100' };
  }
  if (form.includes('inhaler')) return { qtyLabel: 'No of Inhalers', qtyPlaceholder: 'e.g., 1' };
  if (form.includes('cream') || form.includes('ointment')) return { qtyLabel: 'Quantity (Tubes/Grams)', qtyPlaceholder: 'e.g., 1' };
  if (form.includes('injection')) return { qtyLabel: 'Quantity (Vials/Ampoules/Bags)', qtyPlaceholder: 'e.g., 2' };

  return ROUTE_QUANTITY_FALLBACK[route] || { qtyLabel: 'Quantity', qtyPlaceholder: 'e.g., 30' };
};

// Tablet/Capsule are the only forms where the doctor's per-dose amount is
// naturally a whole-unit count ("take 2 tablets") rather than a strength
// or free-text description — this is what distinguishes it from Quantity
// (the total dispensed) and from routes like injections/drops/inhalers
// whose per-dose field is already a free-text amount (e.g. "Drops per
// Dose", "Puffs/Dose").
export const isCountableSolidForm = (dosageForm?: string): boolean => {
  const form = (dosageForm || '').toLowerCase();
  return form.includes('tablet') || form.includes('capsule');
};

export interface UnitsPerDoseLabel {
  label: string;
  unitSingular: string;
  unitPlural: string;
}

export const getUnitsPerDoseLabel = (dosageForm?: string): UnitsPerDoseLabel => {
  const form = (dosageForm || '').toLowerCase();
  if (form.includes('capsule')) return { label: 'No of Capsules', unitSingular: 'capsule', unitPlural: 'capsules' };
  return { label: 'No of Tablets', unitSingular: 'tablet', unitPlural: 'tablets' };
};

// How many times per day a frequency option implies — used to auto-total
// Quantity from (units per dose) × (times/day) × (days). Returns null for
// anything that isn't a clean daily rate (PRN, single-dose STAT) so callers
// know to leave Quantity for the doctor to fill in manually instead of
// guessing.
export const parseFrequencyToTimesPerDay = (frequency: string): number | null => {
  const f = frequency.toLowerCase();
  if (f.includes('as needed') || f.includes('prn')) return null;
  if (f.includes('stat')) return null;
  if (f.includes('four times daily')) return 4;
  if (f.includes('three times daily')) return 3;
  if (f.includes('twice daily')) return 2;
  if (f.includes('once daily') || f.includes('at bedtime')) return 1;
  if (f.includes('every 4 hours')) return 6;
  if (f.includes('every 6 hours')) return 4;
  if (f.includes('every 8 hours')) return 3;
  if (f.includes('every 12 hours')) return 2;
  return null;
};

// How many days a duration option/free-text value spans — used alongside
// parseFrequencyToTimesPerDay for the Quantity auto-total. Returns null for
// open-ended durations ("Until discontinued") or anything unparseable.
export const parseDurationToDays = (duration: string): number | null => {
  const d = duration.toLowerCase().trim();
  if (!d) return null;
  if (d.includes('stat')) return 1;
  if (d.includes('until discontinued')) return null;

  const monthMatch = d.match(/(\d+)\s*month/);
  if (monthMatch) return parseInt(monthMatch[1], 10) * 30;

  const weekMatch = d.match(/(\d+)\s*week/);
  if (weekMatch) return parseInt(weekMatch[1], 10) * 7;

  const dayMatch = d.match(/(\d+)\s*day/);
  if (dayMatch) return parseInt(dayMatch[1], 10);

  return null;
};
