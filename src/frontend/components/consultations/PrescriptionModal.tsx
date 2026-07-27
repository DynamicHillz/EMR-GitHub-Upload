/**
 * Prescription Modal Component
 *
 * UI for creating prescriptions with allergy checking
 * REQ-CLIN-3: E-prescribing
 * REQ-CLIN-7: Allergy checking
 */

import React, { useState, useRef, useEffect } from 'react';
import { X, AlertTriangle, Pill } from 'lucide-react';
import ConfirmDialog from '../common/ConfirmDialog';
import { useConfirm } from '../../hooks/useConfirm';
import { useToast } from '../ToastContainer';
import MedicationAutocomplete, { Medication } from '../common/MedicationAutocomplete';
import {
  DURATION_OPTIONS,
  mapDosageFormToRoute,
  getQuantityLabel,
  isCountableSolidForm,
  getUnitsPerDoseLabel,
  parseFrequencyToTimesPerDay,
  parseDurationToDays,
} from '../../utils/prescriptionHelpers';
import { matchesDrugClassGroup } from '../../utils/drugClassGroups';
import Dropdown from '../common/Dropdown';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  allergies: string[];
}

export type PrescriptionContext =
  | { type: 'consultation'; consultationId: string }
  | { type: 'admission'; admissionId: string }
  | { type: 'ancVisit'; ancVisitId: string }
  | { type: 'general' };

interface PrescriptionModalProps {
  context: PrescriptionContext;
  patient: Patient;
  onClose: () => void;
  onSuccess: () => void;
  /** 'modal' (default) is a full-screen overlay; 'inline' renders as an
   * expandable card in place, matching the Add Medication pattern used in
   * WardRoundModal/DischargeModal — no backdrop, no fixed positioning. */
  variant?: 'modal' | 'inline';
}

interface PrescriptionFormData {
  medicationId?: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  quantity: number;
  route: string;
  isControlledSubstance: boolean;
  dispenseRationale: string;
  /** The selected medication's inventory dosage form (Tablet, Capsule,
   * Syrup, etc.) — drives the quantity field's label (e.g. "No of
   * Tablets"), since route alone can't distinguish these (all ORAL).
   * Cleared when the medication name is edited by hand rather than picked
   * from the autocomplete, since the form is then no longer known. */
  dosageForm?: string;
  /** The medication's per-unit strength (e.g. "500mg"), known from
   * inventory once selected — shown as a helper alongside "No of
   * Tablets/Capsules" so the doctor still sees the strength even though
   * that field no longer holds it directly. */
  strength?: string;
  /** For Tablet/Capsule only: how many units the patient takes per dose
   * (e.g. 2, for "take 2 tablets 3 times a day") — distinct from
   * `quantity`, which is the total dispensed to the patient. */
  unitsPerDose?: number;
}

const getRouteLabels = (route: string) => {
  switch (route) {
    case 'TOPICAL':
      return {
        dosageLabel: 'Application Amount',
        dosagePlaceholder: 'e.g., Apply thin layer',
        freqOptions: ['Select frequency', 'Once daily', 'Twice daily', 'Three times daily', 'As needed'],
        durationPlaceholder: 'e.g., 7 days',
        instructionsPlaceholder: 'e.g., Apply to affected area only',
      };
    case 'OPHTHALMIC':
    case 'OTIC':
      return {
        dosageLabel: 'Drops per Dose',
        dosagePlaceholder: 'e.g., 2 drops',
        freqOptions: ['Select frequency', 'Once daily', 'Twice daily', 'Three times daily', 'Every 6 hours', 'Every 8 hours', 'As needed'],
        durationPlaceholder: 'e.g., 5 days',
        instructionsPlaceholder: 'e.g., Left eye/ear only',
      };
    case 'INTRAVENOUS':
    case 'INTRAMUSCULAR':
    case 'SUBCUTANEOUS':
      return {
        dosageLabel: 'Dose',
        dosagePlaceholder: 'e.g., 1g, 500mg',
        freqOptions: ['Select frequency', 'STAT (Immediately)', 'Once daily', 'Twice daily', 'Every 8 hours', 'Every 12 hours'],
        durationPlaceholder: 'e.g., STAT, 3 days',
        instructionsPlaceholder: 'e.g., Slow IV push',
      };
    case 'INHALATION':
      return {
        dosageLabel: 'Puffs/Dose',
        dosagePlaceholder: 'e.g., 2 puffs',
        freqOptions: ['Select frequency', 'Once daily', 'Twice daily', 'Every 4 hours', 'As needed'],
        durationPlaceholder: 'e.g., 1 month',
        instructionsPlaceholder: 'e.g., Inhale deeply',
      };
    case 'RECTAL':
    case 'VAGINAL':
      return {
        dosageLabel: 'Dose',
        dosagePlaceholder: 'e.g., 1 suppository',
        freqOptions: ['Select frequency', 'Once daily', 'Twice daily', 'At bedtime', 'As needed'],
        durationPlaceholder: 'e.g., 5 days',
        instructionsPlaceholder: 'e.g., Insert at bedtime',
      };
    default:
      return {
        dosageLabel: 'Dosage',
        dosagePlaceholder: 'e.g., 500mg, 10ml',
        freqOptions: ['Select frequency', 'Once daily', 'Twice daily', 'Three times daily', 'Four times daily', 'Every 4 hours', 'Every 6 hours', 'Every 8 hours', 'Every 12 hours', 'As needed (PRN)'],
        durationPlaceholder: 'e.g., 7 days, 2 weeks',
        instructionsPlaceholder: 'e.g., Take with food, Avoid alcohol',
      };
  }
};

const PrescriptionModal: React.FC<PrescriptionModalProps> = ({
  context,
  patient,
  onClose,
  onSuccess,
  variant = 'modal',
}) => {
  const isInline = variant === 'inline';
  const toast = useToast();
  const { confirm, isOpen, options, loading: confirmLoading, handleConfirm, handleCancel } = useConfirm();

  const [formData, setFormData] = useState<PrescriptionFormData>({
    medicationName: '',
    dosage: '',
    frequency: '',
    duration: '',
    instructions: '',
    quantity: 0,
    route: 'ORAL',
    isControlledSubstance: false,
    dispenseRationale: '',
    dosageForm: undefined,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allergyWarning, setAllergyWarning] = useState<string | null>(null);
  const [interactionWarning, setInteractionWarning] = useState<string | null>(null);
  const [interactionSeverity, setInteractionSeverity] = useState<'INFO' | 'WARNING' | 'CRITICAL' | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [duplicateSeverity, setDuplicateSeverity] = useState<'INFO' | 'WARNING' | 'CRITICAL' | null>(null);
  const interactionCheckTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Once the doctor manually edits Quantity, stop overwriting it with the
  // auto-total below — resets when a new medication is picked so auto-total
  // resumes for that fresh entry.
  const [quantityManuallyEdited, setQuantityManuallyEdited] = useState(false);

  // Allergy matches are never severity-graded in this schema, so any match
  // is treated as high-stakes; CRITICAL-tier interactions/duplicates get the
  // same treatment — all three require a typed reason rather than a click-through.
  const requiresOverrideReason =
    !!allergyWarning || interactionSeverity === 'CRITICAL' || duplicateSeverity === 'CRITICAL';

  const labels = getRouteLabels(formData.route);
  const quantityLabels = getQuantityLabel(formData.route, formData.dosageForm);
  const isSolidCountable = isCountableSolidForm(formData.dosageForm);
  const unitsPerDoseLabel = getUnitsPerDoseLabel(formData.dosageForm);

  // Auto-total Quantity = (units per dose) × (times/day) × (days) once all
  // three are known — e.g. "2 tablets, three times daily, 7 days" -> 42.
  // Only applies to Tablet/Capsule (see isCountableSolidForm) and only
  // until the doctor manually overrides Quantity themselves.
  useEffect(() => {
    if (!isSolidCountable || quantityManuallyEdited) return;
    const timesPerDay = parseFrequencyToTimesPerDay(formData.frequency);
    const days = parseDurationToDays(formData.duration);
    if (formData.unitsPerDose && timesPerDay && days) {
      const calculated = formData.unitsPerDose * timesPerDay * days;
      setFormData((prev) => (prev.quantity === calculated ? prev : { ...prev, quantity: calculated }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSolidCountable, quantityManuallyEdited, formData.unitsPerDose, formData.frequency, formData.duration]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    if (name === 'quantity') {
      setQuantityManuallyEdited(true);
    }
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : name === 'quantity' ? parseInt(value) || 0 : value,
    }));
  };

  const handleUnitsPerDoseChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0;
    setFormData((prev) => ({ ...prev, unitsPerDose: value }));
  };

  const checkAllergies = (medicationName: string) => {
    if (medicationName && Array.isArray(patient.allergies) && patient.allergies.length > 0) {
      const medLower = medicationName.toLowerCase();
      const matchingAllergies = patient.allergies.filter((allergy: string) => {
        const allergyLower = allergy.toLowerCase();
        return (
          medLower.includes(allergyLower) ||
          allergyLower.includes(medLower) ||
          matchesDrugClassGroup(allergy, medicationName)
        );
      });

      setAllergyWarning(
        matchingAllergies.length > 0
          ? `WARNING: Patient is allergic to ${matchingAllergies.join(', ')}`
          : null
      );
    } else {
      setAllergyWarning(null);
    }
  };

  const checkInteractionsLive = (medicationName: string) => {
    if (interactionCheckTimeout.current) {
      clearTimeout(interactionCheckTimeout.current);
    }

    if (!medicationName) {
      setInteractionWarning(null);
      setInteractionSeverity(null);
      setDuplicateWarning(null);
      setDuplicateSeverity(null);
      return;
    }

    interactionCheckTimeout.current = setTimeout(async () => {
      try {
        const token = localStorage.getItem('token');
        const apiBaseUrl = `${window.location.protocol}//${window.location.hostname}:3000`;
        const res = await fetch(
          `${apiBaseUrl}/api/prescriptions/check-interactions?patientId=${patient.id}&medicationName=${encodeURIComponent(medicationName)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          const result = await res.json();
          const details: string[] = result.data?.interactionDetails || [];
          setInteractionWarning(details.length > 0 ? details.join('; ') : null);
          setInteractionSeverity(result.data?.interactionHighestSeverity || null);

          const dupDetails: string[] = result.data?.duplicateDetails || [];
          setDuplicateWarning(dupDetails.length > 0 ? dupDetails.join('; ') : null);
          setDuplicateSeverity(result.data?.duplicateHighestSeverity || null);
        }
      } catch (error) {
        console.error('Error checking drug interactions:', error);
      }
    }, 400);
  };

  const handleMedicationNameChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      medicationName: value,
      medicationId: undefined,
      dosageForm: undefined,
      strength: undefined,
      unitsPerDose: undefined,
    }));
    checkAllergies(value);
    checkInteractionsLive(value);
  };

  const handleMedicationSelect = (medication: Medication) => {
    const mappedRoute = mapDosageFormToRoute(medication.dosageForm);
    setQuantityManuallyEdited(false);
    setFormData((prev) => ({
      ...prev,
      medicationName: medication.name,
      medicationId: medication.id,
      route: mappedRoute || prev.route,
      dosage: isCountableSolidForm(medication.dosageForm) ? prev.dosage : (medication.strength || prev.dosage),
      isControlledSubstance: medication.isControlledSubstance ?? prev.isControlledSubstance,
      dosageForm: medication.dosageForm,
      strength: medication.strength,
      unitsPerDose: undefined,
    }));
    checkAllergies(medication.name);
    checkInteractionsLive(medication.name);
  };

  // For Tablet/Capsule, the backend still just gets a descriptive `dosage`
  // string — this composes it from the per-dose count + known strength
  // (e.g. "2 tablets (500mg each)") rather than adding a new API field.
  const composeDosage = (): string => {
    if (isSolidCountable && formData.unitsPerDose) {
      const unitWord = formData.unitsPerDose === 1 ? unitsPerDoseLabel.unitSingular : unitsPerDoseLabel.unitPlural;
      return formData.strength
        ? `${formData.unitsPerDose} ${unitWord} (${formData.strength} each)`
        : `${formData.unitsPerDose} ${unitWord}`;
    }
    return formData.dosage;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const hasValidDosage = isSolidCountable ? !!formData.unitsPerDose && formData.unitsPerDose > 0 : !!formData.dosage;
    if (!formData.medicationName || !hasValidDosage || !formData.frequency) {
      toast.error('Validation Error', 'Please fill in all required fields');
      return;
    }

    // Allergy matches, and CRITICAL-tier interactions/duplicates, require a
    // typed justification (reusing the dispense-rationale field) rather than
    // a single click-through — a click is not enough friction for these.
    if (requiresOverrideReason && !formData.dispenseRationale.trim()) {
      toast.error(
        'Justification Required',
        'This medication has a high-severity safety alert. Please type a clinical justification before prescribing.'
      );
      return;
    }

    // Drug interaction: CRITICAL already handled by the typed-justification gate above;
    // WARNING/INFO still uses the lighter single-confirm flow.
    if (interactionWarning && interactionSeverity !== 'CRITICAL') {
      const confirmed = await confirm({
        title: 'Drug Interaction Warning',
        message: `${interactionWarning}\n\nAre you sure you want to prescribe this medication?`,
        confirmText: 'Yes, Prescribe',
        cancelText: 'Cancel',
        variant: 'danger',
      });
      if (!confirmed) {
        return;
      }
    }

    // Duplicate/overlapping therapy: CRITICAL (exact duplicate) already handled
    // above; WARNING (same class or near-match name) uses a single confirm.
    if (duplicateWarning && duplicateSeverity !== 'CRITICAL') {
      const confirmed = await confirm({
        title: 'Duplicate Therapy Warning',
        message: `${duplicateWarning}\n\nAre you sure you want to prescribe this medication?`,
        confirmText: 'Yes, Prescribe',
        cancelText: 'Cancel',
        variant: 'danger',
      });
      if (!confirmed) {
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      const apiBaseUrl = `${window.location.protocol}//${window.location.hostname}:3000`;

      const payload: Record<string, unknown> = {
        patientId: patient.id,
        medicationId: formData.medicationId,
        medicationName: formData.medicationName,
        dosage: composeDosage(),
        frequency: formData.frequency,
        duration: formData.duration,
        instructions: formData.instructions,
        quantity: formData.quantity,
        route: formData.route,
        isControlledSubstance: formData.isControlledSubstance,
        dispenseRationale: formData.dispenseRationale || undefined,
      };

      // Consultation-based prescribing keeps using the existing nested endpoint;
      // admission (Postop Plan) and ancVisit contexts use the shared endpoint.
      const url =
        context.type === 'consultation'
          ? `${apiBaseUrl}/api/consultations/${context.consultationId}/prescriptions`
          : `${apiBaseUrl}/api/prescriptions`;

      if (context.type === 'admission') {
        payload.admissionId = context.admissionId;
        payload.type = 'INPATIENT';
      } else if (context.type === 'ancVisit') {
        payload.ancVisitId = context.ancVisitId;
        payload.type = 'ANC';
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok) {
        if (result.warning) {
          toast.warning('Prescription Created', result.warning);
        } else {
          toast.success('Success', 'Prescription created successfully!');
        }
        onSuccess();
      } else {
        toast.error('Error', result.message || 'Failed to create prescription');
      }
    } catch (error) {
      console.error('Error creating prescription:', error);
      toast.error('Error', 'Failed to create prescription. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const outerClass = isInline
    ? 'mt-4 p-4 border border-primary-200 bg-primary-50 rounded-lg'
    : 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200';
  const cardClass = isInline
    ? ''
    : 'bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-gray-100';
  const contentClass = isInline ? '' : 'overflow-y-auto flex-grow bg-gray-50 flex flex-col';

  return (
    <div className={outerClass}>
      <div className={cardClass}>
        {/* Header */}
        {isInline ? (
          <div className="flex items-center justify-between mb-4">
            <h5 className="font-medium text-primary-900 text-sm flex items-center gap-2">
              <Pill className="w-4 h-4" />
              New Prescription Order
            </h5>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4 flex items-center justify-between text-white flex-shrink-0 shadow-md">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg shadow-inner">
                <Pill className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-wide">New Prescription</h2>
                <p className="text-blue-100 text-sm opacity-90 mt-0.5">
                  Patient: <span className="font-semibold">{patient.fullName}</span>
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white hover:bg-white/10 p-2 rounded-full transition-all duration-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Scrollable Content */}
        <div className={contentClass}>
          {/* Patient Allergies Warning */}
          {Array.isArray(patient.allergies) && patient.allergies.length > 0 && (
            <div className={`${isInline ? 'mb-4' : 'mx-6 mt-6'} p-4 bg-red-50 border border-red-200 rounded-xl shadow-sm`}>
              <div className="flex items-start gap-3">
                <div className="bg-red-100 p-2 rounded-full">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                </div>
                <div>
                  <h4 className="font-semibold text-red-900">Patient Allergies</h4>
                  <p className="text-sm text-red-700 mt-1">
                    {patient.allergies.join(', ')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className={isInline ? 'flex-grow flex flex-col' : 'p-6 flex-grow flex flex-col'}>
            {/* Real-time Allergy Warning */}
            {allergyWarning && (
              <div className="mb-6 p-4 bg-red-100 border-2 border-red-500 rounded-xl animate-pulse shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="bg-red-200 p-2 rounded-full">
                    <AlertTriangle className="w-6 h-6 text-red-700 flex-shrink-0" />
                  </div>
                  <div>
                    <h4 className="font-bold text-red-900 text-lg">ALLERGY ALERT</h4>
                    <p className="text-red-800 mt-1 font-medium">{allergyWarning}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Real-time Drug Interaction Warning */}
            {interactionWarning && (
              <div className="mb-6 p-4 bg-orange-100 border-2 border-orange-500 rounded-xl shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="bg-orange-200 p-2 rounded-full">
                    <AlertTriangle className="w-6 h-6 text-orange-700 flex-shrink-0" />
                  </div>
                  <div>
                    <h4 className="font-bold text-orange-900 text-lg">
                      DRUG INTERACTION WARNING {interactionSeverity === 'CRITICAL' && '(CRITICAL)'}
                    </h4>
                    <p className="text-orange-800 mt-1 font-medium">{interactionWarning}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Real-time Duplicate / Overlapping Therapy Warning */}
            {duplicateWarning && (
              <div className="mb-6 p-4 bg-amber-100 border-2 border-amber-500 rounded-xl shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="bg-amber-200 p-2 rounded-full">
                    <AlertTriangle className="w-6 h-6 text-amber-700 flex-shrink-0" />
                  </div>
                  <div>
                    <h4 className="font-bold text-amber-900 text-lg">
                      DUPLICATE THERAPY WARNING {duplicateSeverity === 'CRITICAL' && '(CRITICAL)'}
                    </h4>
                    <p className="text-amber-800 mt-1 font-medium">{duplicateWarning}</p>
                  </div>
                </div>
              </div>
            )}

            <div className={isInline ? 'space-y-5 flex-grow' : 'space-y-5 bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex-grow'}>
            {/* Medication Name and Route */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Medication Name <span className="text-red-500">*</span>
                </label>
                <MedicationAutocomplete
                  value={formData.medicationName}
                  onChange={handleMedicationNameChange}
                  onSelect={handleMedicationSelect}
                  placeholder="Search inventory or type a medication name..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Route / Form <span className="text-red-500">*</span>
                </label>
                <Dropdown
                  name="route"
                  value={formData.route}
                  onChange={handleChange}
                  required
                  className="input w-full"
                >
                  <option value="ORAL">Oral (Tablet, Syrup)</option>
                  <option value="INTRAVENOUS">Intravenous (IV)</option>
                  <option value="INTRAMUSCULAR">Intramuscular (IM)</option>
                  <option value="SUBCUTANEOUS">Subcutaneous (SC)</option>
                  <option value="TOPICAL">Topical (Ointment, Cream)</option>
                  <option value="OPHTHALMIC">Ophthalmic (Eye Drops)</option>
                  <option value="OTIC">Otic (Ear Drops)</option>
                  <option value="INHALATION">Inhalation</option>
                  <option value="RECTAL">Rectal (Suppository)</option>
                  <option value="SUBLINGUAL">Sublingual</option>
                  <option value="NASAL">Nasal</option>
                  <option value="VAGINAL">Vaginal</option>
                  <option value="OTHER">Other</option>
                </Dropdown>
              </div>
            </div>

            {/* Dosage and Frequency */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                {isSolidCountable ? (
                  <>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {unitsPerDoseLabel.label} (per dose) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="unitsPerDose"
                      value={formData.unitsPerDose || ''}
                      onChange={handleUnitsPerDoseChange}
                      required
                      min="1"
                      className="input w-full"
                      placeholder="e.g., 2"
                    />
                    {formData.strength && (
                      <p className="text-xs text-gray-500 mt-1">{formData.strength} per {unitsPerDoseLabel.unitSingular}</p>
                    )}
                  </>
                ) : (
                  <>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {labels.dosageLabel} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="dosage"
                      value={formData.dosage}
                      onChange={handleChange}
                      required
                      className="input w-full"
                      placeholder={labels.dosagePlaceholder}
                    />
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Frequency <span className="text-red-500">*</span>
                </label>
                <Dropdown
                  name="frequency"
                  value={formData.frequency}
                  onChange={handleChange}
                  required
                  className="input w-full"
                >
                  {labels.freqOptions.map(opt => (
                    <option key={opt} value={opt === 'Select frequency' ? '' : opt}>{opt}</option>
                  ))}
                  {/* Ensure currently selected value is available even if not in typical options */}
                  {formData.frequency && !labels.freqOptions.includes(formData.frequency) && formData.frequency !== 'Select frequency' && (
                    <option value={formData.frequency}>{formData.frequency}</option>
                  )}
                </Dropdown>
              </div>
            </div>

            {/* Duration and Quantity */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration
                </label>
                <Dropdown
                  name="duration"
                  value={formData.duration}
                  onChange={handleChange}
                  className="input w-full"
                >
                  {DURATION_OPTIONS.map(opt => (
                    <option key={opt} value={opt === 'Select duration' ? '' : opt}>{opt}</option>
                  ))}
                  <option value="CUSTOM">Custom...</option>
                  {formData.duration && !DURATION_OPTIONS.includes(formData.duration) && (
                    <option value={formData.duration}>{formData.duration}</option>
                  )}
                </Dropdown>
                {(formData.duration === 'CUSTOM' || (!!formData.duration && !DURATION_OPTIONS.includes(formData.duration) && formData.duration !== 'CUSTOM')) && (
                  <input
                    type="text"
                    className="input w-full mt-2"
                    placeholder={labels.durationPlaceholder}
                    value={formData.duration === 'CUSTOM' ? '' : formData.duration}
                    onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value }))}
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {quantityLabels.qtyLabel}
                </label>
                <input
                  type="number"
                  name="quantity"
                  value={formData.quantity || ''}
                  onChange={handleChange}
                  min="0"
                  className="input w-full"
                  placeholder={quantityLabels.qtyPlaceholder}
                />
                {isSolidCountable && !quantityManuallyEdited && formData.quantity > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Auto-calculated from {unitsPerDoseLabel.unitSingular} count × frequency × duration — you can still edit it.
                  </p>
                )}
              </div>
            </div>

            {/* Controlled Substance */}
            <div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isControlledSubstance"
                  name="isControlledSubstance"
                  checked={formData.isControlledSubstance}
                  onChange={handleChange}
                  className="h-4 w-4 text-primary-600 border-gray-300 rounded"
                />
                <label htmlFor="isControlledSubstance" className="text-sm font-medium text-gray-700">
                  Controlled Substance
                </label>
              </div>
              {(formData.isControlledSubstance || requiresOverrideReason) && (
                <div className="mt-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {requiresOverrideReason ? (
                      <>
                        Override Justification{' '}
                        <span className="text-red-500">*</span>{' '}
                        <span className="text-gray-400 font-normal">(required — high-severity safety alert above)</span>
                      </>
                    ) : (
                      <>
                        Dispense Rationale{' '}
                        <span className="text-gray-400 font-normal">(required if duration exceeds 7 days)</span>
                      </>
                    )}
                  </label>
                  <textarea
                    name="dispenseRationale"
                    value={formData.dispenseRationale}
                    onChange={handleChange}
                    rows={2}
                    className="input w-full"
                    placeholder={
                      requiresOverrideReason
                        ? 'Explain why this medication is being prescribed despite the alert above...'
                        : 'Clinical justification for the prescribed quantity/duration...'
                    }
                  />
                </div>
              )}
            </div>

            {/* Instructions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Instructions
              </label>
              <textarea
                name="instructions"
                value={formData.instructions}
                onChange={handleChange}
                rows={3}
                className="input w-full"
                placeholder={labels.instructionsPlaceholder}
              />
            </div>
          </div>

            {/* Action Buttons */}
            <div className={isInline ? 'pt-4 mt-4 flex justify-end gap-3' : 'pt-4 mt-6 flex justify-end gap-3 border-t border-gray-100'}>
              <button
                type="button"
                onClick={onClose}
                className={isInline
                  ? 'text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5'
                  : 'px-5 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors duration-200'}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={isInline
                  ? 'bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium py-1.5 px-4 rounded-md disabled:opacity-50 flex items-center gap-2'
                  : 'px-5 py-2.5 text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2'}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Creating...
                  </>
                ) : 'Create Prescription'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={isOpen}
        onClose={handleCancel}
        onConfirm={handleConfirm}
        title={options.title}
        message={options.message}
        confirmText={options.confirmText}
        cancelText={options.cancelText}
        variant={options.variant}
        loading={confirmLoading}
      />
    </div>
  );
};

export default PrescriptionModal;
