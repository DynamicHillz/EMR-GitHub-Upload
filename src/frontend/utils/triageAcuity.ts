/**
 * Vitals-derived triage acuity suggestion — frontend mirror of
 * src/backend/shared/utils/triage-acuity.utils.ts (same pattern already
 * used for drugClassGroups.ts) so TriageAssessmentModal.tsx can compute a
 * live suggestion as vitals are typed, with no round trip.
 *
 * WHO ETAT-style danger-sign thresholds mapped onto the 5 categories the
 * modal actually offers. Explicitly a threshold aid, not a validated triage
 * score — the nurse's own category selection is always what gets saved.
 *
 * No patient age is available at the triage-entry point today, so
 * thresholds are deliberately conservative, general-purpose values rather
 * than age-stratified pediatric/adult bands.
 */

export type SuggestedTriageCategory = 'RESUSCITATION' | 'EMERGENT' | 'URGENT' | 'SEMI_URGENT';

export interface TriageVitalsInput {
  systolicBP?: number;
  heartRate?: number;
  respiratoryRate?: number;
  spO2?: number;
  temperature?: number;
  glucoseLevel?: number;
  painScore?: number;
  consciousnessLevel?: string; // AVPU: 'Alert' | 'Voice' | 'Pain' | 'Unresponsive'
}

export interface TriageAcuitySuggestion {
  category: SuggestedTriageCategory;
  reasons: string[];
}

export function suggestTriageCategory(vitals: TriageVitalsInput): TriageAcuitySuggestion | null {
  const resuscitationReasons: string[] = [];
  const emergentReasons: string[] = [];
  const urgentReasons: string[] = [];

  if (vitals.consciousnessLevel === 'Unresponsive') resuscitationReasons.push('Unresponsive (AVPU)');
  if (vitals.spO2 !== undefined && vitals.spO2 < 85) resuscitationReasons.push(`SpO2 ${vitals.spO2}%`);
  if (vitals.systolicBP !== undefined && vitals.systolicBP < 70) resuscitationReasons.push(`Systolic BP ${vitals.systolicBP}`);
  if (vitals.respiratoryRate !== undefined && (vitals.respiratoryRate > 40 || vitals.respiratoryRate < 8)) {
    resuscitationReasons.push(`Resp rate ${vitals.respiratoryRate}`);
  }
  if (vitals.heartRate !== undefined && (vitals.heartRate > 160 || vitals.heartRate < 40)) {
    resuscitationReasons.push(`Pulse rate ${vitals.heartRate}`);
  }
  if (vitals.glucoseLevel !== undefined && vitals.glucoseLevel < 40) resuscitationReasons.push(`Glucose ${vitals.glucoseLevel} (severe hypoglycemia)`);

  if (resuscitationReasons.length > 0) {
    return { category: 'RESUSCITATION', reasons: resuscitationReasons };
  }

  if (vitals.consciousnessLevel === 'Voice' || vitals.consciousnessLevel === 'Pain') {
    emergentReasons.push(`Responds to ${vitals.consciousnessLevel.toLowerCase()} only (AVPU)`);
  }
  if (vitals.spO2 !== undefined && vitals.spO2 >= 85 && vitals.spO2 < 90) emergentReasons.push(`SpO2 ${vitals.spO2}%`);
  if (vitals.systolicBP !== undefined && vitals.systolicBP >= 70 && vitals.systolicBP < 90) emergentReasons.push(`Systolic BP ${vitals.systolicBP}`);
  if (
    vitals.respiratoryRate !== undefined &&
    ((vitals.respiratoryRate >= 30 && vitals.respiratoryRate <= 40) || (vitals.respiratoryRate >= 8 && vitals.respiratoryRate < 10))
  ) {
    emergentReasons.push(`Resp rate ${vitals.respiratoryRate}`);
  }
  if (
    vitals.heartRate !== undefined &&
    ((vitals.heartRate >= 130 && vitals.heartRate <= 160) || (vitals.heartRate >= 40 && vitals.heartRate < 50))
  ) {
    emergentReasons.push(`Pulse rate ${vitals.heartRate}`);
  }
  if (vitals.glucoseLevel !== undefined && vitals.glucoseLevel >= 40 && vitals.glucoseLevel < 54) {
    emergentReasons.push(`Glucose ${vitals.glucoseLevel} (hypoglycemia)`);
  }
  if (vitals.painScore !== undefined && vitals.painScore >= 8) emergentReasons.push(`Pain score ${vitals.painScore}/10`);

  if (emergentReasons.length > 0) {
    return { category: 'EMERGENT', reasons: emergentReasons };
  }

  if (vitals.spO2 !== undefined && vitals.spO2 >= 90 && vitals.spO2 < 95) urgentReasons.push(`SpO2 ${vitals.spO2}%`);
  if (vitals.respiratoryRate !== undefined && vitals.respiratoryRate >= 25 && vitals.respiratoryRate < 30) urgentReasons.push(`Resp rate ${vitals.respiratoryRate}`);
  if (vitals.heartRate !== undefined && vitals.heartRate >= 110 && vitals.heartRate < 130) urgentReasons.push(`Pulse rate ${vitals.heartRate}`);
  if (vitals.temperature !== undefined && vitals.temperature >= 39.5) urgentReasons.push(`Temp ${vitals.temperature}°C`);
  if (vitals.painScore !== undefined && vitals.painScore >= 5 && vitals.painScore < 8) urgentReasons.push(`Pain score ${vitals.painScore}/10`);

  if (urgentReasons.length > 0) {
    return { category: 'URGENT', reasons: urgentReasons };
  }

  return null;
}
