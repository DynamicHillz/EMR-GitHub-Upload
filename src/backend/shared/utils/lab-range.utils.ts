/**
 * Parses a free-text lab reference range (as seeded on LabParameter.refRangeMale/refRangeFemale,
 * e.g. "4.0–11.0", "135-145", "<200", ">40") into numeric bounds.
 * Returns {} for non-numeric/qualitative ranges (e.g. "Non-reactive", "AA/AS/SS/AC") —
 * those are handled separately via the raw string in the non-numeric flagging branch.
 */
export function parseNumericRange(rangeStr: string | null | undefined): { min?: number; max?: number } {
  if (!rangeStr) return {};

  const trimmed = rangeStr.trim();

  const lessThan = trimmed.match(/^<\s*([\d.]+)/);
  if (lessThan) {
    return { max: parseFloat(lessThan[1]) };
  }

  const greaterThan = trimmed.match(/^>\s*([\d.]+)/);
  if (greaterThan) {
    return { min: parseFloat(greaterThan[1]) };
  }

  const between = trimmed.match(/^([\d.]+)\s*[-–—]\s*([\d.]+)/);
  if (between) {
    const min = parseFloat(between[1]);
    const max = parseFloat(between[2]);
    if (!isNaN(min) && !isNaN(max)) {
      return { min, max };
    }
  }

  return {};
}
