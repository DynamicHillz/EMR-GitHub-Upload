import { useCallback, useRef } from 'react';
import { CLINICAL_TERMS } from '../data/clinicalTerms';

const MAX_SUGGESTIONS = 6;

// Medication names are fetched once and shared across every TypeaheadTextField
// on the page — same endpoint MedicationAutocomplete.tsx already uses, but
// cached at module scope so multiple fields (e.g. the 4 SOAP textareas) don't
// each re-fetch the full catalog.
let medicationNamesPromise: Promise<string[]> | null = null;

function loadMedicationNames(): Promise<string[]> {
  if (!medicationNamesPromise) {
    medicationNamesPromise = (async () => {
      try {
        const token = localStorage.getItem('token');
        const apiBaseUrl = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`;
        const response = await fetch(`${apiBaseUrl}/api/pharmacy/medications`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return [];
        const result = await response.json();
        const meds = result.data || [];
        const names = new Set<string>();
        for (const med of meds) {
          if (med.name) names.add(med.name);
          if (med.genericName) names.add(med.genericName);
        }
        return Array.from(names);
      } catch {
        return [];
      }
    })();
  }
  return medicationNamesPromise;
}

async function loadDiagnosisNames(partialWord: string): Promise<string[]> {
  try {
    const token = localStorage.getItem('token');
    const apiBaseUrl = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`;
    const response = await fetch(`${apiBaseUrl}/api/clinical/diagnoses?query=${encodeURIComponent(partialWord)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return [];
    const result = await response.json();
    return (result.data || []).map((d: { name: string }) => d.name).filter(Boolean);
  } catch {
    return [];
  }
}

// Edit distance of exactly/at-most 1 (one insertion, deletion, or
// substitution) — enough to catch a single typo without the cost of full
// Levenshtein, and without pulling in a fuzzy-search dependency.
function isEditDistanceAtMostOne(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a === b) return true;

  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  let i = 0;
  let j = 0;
  let edits = 0;

  while (i < shorter.length && j < longer.length) {
    if (shorter[i] === longer[j]) {
      i++;
      j++;
      continue;
    }
    edits++;
    if (edits > 1) return false;
    if (shorter.length === longer.length) {
      // substitution
      i++;
      j++;
    } else {
      // insertion into shorter / deletion from longer
      j++;
    }
  }
  return true;
}

function rankMatches(partialWord: string, corpus: string[]): string[] {
  const lowerWord = partialWord.toLowerCase();
  const seen = new Set<string>();
  const prefixMatches: string[] = [];
  const fuzzyMatches: string[] = [];

  for (const term of corpus) {
    const lowerTerm = term.toLowerCase();
    if (seen.has(lowerTerm) || lowerTerm === lowerWord) continue;

    if (lowerTerm.startsWith(lowerWord)) {
      seen.add(lowerTerm);
      prefixMatches.push(term);
    }
  }

  // Only bother with fuzzy (typo) matching once there isn't already a good
  // set of prefix matches, and the word is long enough that a 1-edit match
  // is meaningfully different from a coincidence.
  if (prefixMatches.length < MAX_SUGGESTIONS && lowerWord.length >= 4) {
    for (const term of corpus) {
      const lowerTerm = term.toLowerCase();
      if (seen.has(lowerTerm)) continue;
      if (isEditDistanceAtMostOne(lowerWord, lowerTerm)) {
        seen.add(lowerTerm);
        fuzzyMatches.push(term);
      }
    }
  }

  return [...prefixMatches, ...fuzzyMatches].slice(0, MAX_SUGGESTIONS);
}

/**
 * Suggest-and-confirm clinical term lookup for TypeaheadTextField — merges
 * the bundled local vocabulary, this tenant's medication catalog, and
 * ICD-11-backed diagnosis names into one ranked, deduped suggestion list.
 * All local except the diagnosis lookup, which reuses the same endpoint
 * DiagnosisAutocomplete already calls.
 */
export function useClinicalSuggestions() {
  const medicationNamesRef = useRef<string[] | null>(null);

  const getSuggestions = useCallback(async (partialWord: string): Promise<string[]> => {
    if (partialWord.length < 3) return [];

    if (medicationNamesRef.current === null) {
      medicationNamesRef.current = await loadMedicationNames();
    }

    const diagnosisNames = partialWord.length >= 2 ? await loadDiagnosisNames(partialWord) : [];

    const corpus = [...CLINICAL_TERMS, ...medicationNamesRef.current, ...diagnosisNames];
    return rankMatches(partialWord, corpus);
  }, []);

  return { getSuggestions };
}
