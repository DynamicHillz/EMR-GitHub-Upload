import React, { useState, useEffect, useCallback, KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, User, Calendar, Phone, AlertCircle, X } from 'lucide-react';
import PatientDetailView from '../components/PatientDetailView';
import { useToast } from '../components/ToastContainer';
import ErrorAlert from '../components/common/ErrorAlert';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { useConfirm } from '../hooks/useConfirm';
import { useDraftPersistence } from '../hooks/useDraftPersistence';
import TriageAssessmentModal from '../components/triage/TriageAssessmentModal';
import { NIGERIA_LGA_MAP, NIGERIAN_STATES } from '../utils/nigeria-states';
import Dropdown from '../components/common/Dropdown';
import { useAuth } from '../contexts/AuthContext';
import { offlineFetch } from '../services/offlineFetch';

const BLOOD_GROUPS = [
  { value: 'A_POSITIVE', label: 'A+' },
  { value: 'A_NEGATIVE', label: 'A-' },
  { value: 'B_POSITIVE', label: 'B+' },
  { value: 'B_NEGATIVE', label: 'B-' },
  { value: 'AB_POSITIVE', label: 'AB+' },
  { value: 'AB_NEGATIVE', label: 'AB-' },
  { value: 'O_POSITIVE', label: 'O+' },
  { value: 'O_NEGATIVE', label: 'O-' },
];

// Using NIGERIA_LGA_MAP from utils

// ── Tag input component ──────────────────────────────────────────────────────
const TagInput: React.FC<{
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder: string;
  chipColor: 'red' | 'yellow';
}> = ({ tags, onChange, placeholder, chipColor }) => {
  const [inputValue, setInputValue] = useState('');

  const addTag = (value: string) => {
    const trimmed = value.trim();
    if (trimmed && !tags.includes(trimmed)) onChange([...tags, trimmed]);
    setInputValue('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const chipClass =
    chipColor === 'red'
      ? 'bg-red-100 text-red-800 border border-red-200'
      : 'bg-yellow-100 text-yellow-800 border border-yellow-200';

  return (
    <div
      className="input w-full min-h-[44px] h-auto flex flex-wrap gap-2 p-2 cursor-text"
      onClick={() => document.getElementById(`tag-${placeholder}`)?.focus()}
    >
      {tags.map((tag, i) => (
        <span key={i} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm font-medium ${chipClass}`}>
          {tag}
          <button type="button" onClick={e => { e.stopPropagation(); onChange(tags.filter((_, j) => j !== i)); }} className="hover:opacity-70">
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        id={`tag-${placeholder}`}
        type="text"
        value={inputValue}
        onChange={e => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (inputValue.trim()) addTag(inputValue); }}
        placeholder={tags.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[120px] outline-none bg-transparent text-sm"
      />
    </div>
  );
};

// ── Types ────────────────────────────────────────────────────────────────────
interface PatientFormData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  dobUnknown: boolean;
  approximateYear: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  phone: string;
  email: string;
  address: string;
  state: string;
  lga: string;
  bloodGroup: string;
  genotype: string;
  allergies: string[];
  patientAllergies: { allergen: string, reactionType: string, severity: string }[];
  chronicConditions: string[];
  pastSurgicalHistory: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
  patientType: 'PRIVATE' | 'HMO';
  hmoProvider: string;
  hmoProviderOther: string;
  hmoNumber: string;
  nhisNumber: string;
  consentGiven: boolean;
}

interface Patient {
  id: string;
  patientId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  age: number;
  gender: string;
  phone: string;
  hasAllergies: boolean;
  createdAt: string;
}

const EMPTY_FORM: PatientFormData = {
  firstName: '', lastName: '', dateOfBirth: '', dobUnknown: false,
  approximateYear: '', gender: 'MALE', phone: '', email: '',
  address: '', state: '', lga: '', bloodGroup: '', genotype: '',
  allergies: [], patientAllergies: [], chronicConditions: [], pastSurgicalHistory: '',
  emergencyContactName: '', emergencyContactPhone: '',
  emergencyContactRelationship: '', patientType: 'PRIVATE',
  hmoProvider: '', hmoProviderOther: '', hmoNumber: '', nhisNumber: '', consentGiven: false,
};

// ── Page ─────────────────────────────────────────────────────────────────────
const PatientsPage: React.FC = () => {
  const toast = useToast();
  const { hasRole } = useAuth();
  const canRegisterPatients = hasRole(['DOCTOR', 'NURSE', 'RECEPTIONIST']);
  const [searchParams] = useSearchParams();
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newAllergy, setNewAllergy] = useState({ allergen: '', reactionType: '', severity: 'MILD' });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<PatientFormData>(EMPTY_FORM);
  const [newPatientTriage, setNewPatientTriage] = useState<{ id: string; fullName: string } | null>(null);
  const [triagePromptPatient, setTriagePromptPatient] = useState<{ id: string; fullName: string } | null>(null);
  const [hmoProviders, setHmoProviders] = useState<{ id: string; name: string; type: string }[]>([]);

  // Live duplicate detection inside the registration form itself — checks
  // as the user types rather than as a separate pre-check step.
  const [duplicateCandidates, setDuplicateCandidates] = useState<Patient[]>([]);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [duplicateWarningDismissed, setDuplicateWarningDismissed] = useState(false);

  const { confirm, isOpen: confirmIsOpen, options: confirmOptions, loading: confirmLoading, handleConfirm, handleCancel } = useConfirm();
  const registrationDraft = useDraftPersistence<PatientFormData>('patient-registration-draft', formData, showModal);

  // Derived: LGAs for selected state
  const availableLGAs = formData.state ? (NIGERIA_LGA_MAP[formData.state] ?? []) : [];

  // Deep-link support: /patients?patientId=... jumps straight to that patient's detail view
  useEffect(() => {
    const deepLinkedId = searchParams.get('patientId');
    if (deepLinkedId) {
      setSelectedPatient({ id: deepLinkedId } as Patient);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const fetchHmoProviders = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${window.location.protocol}//${window.location.hostname}:3000/api/insurance/providers`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setHmoProviders(Array.isArray(data) ? data : (data.data || []));
        } else {
          console.error(`Failed to load HMO providers: ${res.status} ${res.statusText}`);
        }
      } catch (err) {
        console.error('Failed to load HMO providers:', err);
        setHmoProviders([]);
      }
    };
    fetchHmoProviders();
  }, []);

  const searchPatients = useCallback(async (query: string) => {
    if (query.length < 3 && query.length > 0) return;
    if (query.length === 0) { setSearchResults([]); setShowResults(false); return; }
    setIsSearching(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch(
        `${window.location.protocol}//${window.location.hostname}:3000/api/patients/search?query=${encodeURIComponent(query)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      setSearchResults(res.ok ? (data.data || []) : []);
      if (res.ok) setShowResults(true);
    } catch { setSearchResults([]); }
    finally { setIsSearching(false); }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => searchPatients(searchQuery), 300);
    return () => clearTimeout(id);
  }, [searchQuery, searchPatients]);

  // Live duplicate detection: as the user fills in name, phone, or email,
  // check for existing patients matching any of those — no separate
  // pre-check step, just a heads-up right where they're typing.
  useEffect(() => {
    if (!showModal) { setDuplicateCandidates([]); return; }

    const phoneDigits = formData.phone.replace(/\D/g, '');
    const nameReady = formData.firstName.trim().length >= 2 && formData.lastName.trim().length >= 2;
    const phoneReady = phoneDigits.length >= 7;
    const emailReady = /\S+@\S+\.\S+/.test(formData.email.trim());

    if (!nameReady && !phoneReady && !emailReady) {
      setDuplicateCandidates([]);
      return;
    }

    const queries: string[] = [];
    if (nameReady) queries.push(`${formData.firstName.trim()} ${formData.lastName.trim()}`);
    if (phoneReady) queries.push(formData.phone.trim());
    if (emailReady) queries.push(formData.email.trim());

    const id = setTimeout(async () => {
      setIsCheckingDuplicates(true);
      try {
        const token = localStorage.getItem('token');
        const results = await Promise.all(queries.map(q =>
          fetch(`${window.location.protocol}//${window.location.hostname}:3000/api/patients/search?query=${encodeURIComponent(q)}`,
            { headers: { Authorization: `Bearer ${token}` } })
            .then(res => res.ok ? res.json() : { data: [] })
            .then(data => data.data || [])
            .catch(() => [])
        ));
        const merged = new Map<string, Patient>();
        results.flat().forEach((p: Patient) => merged.set(p.id, p));
        setDuplicateCandidates(Array.from(merged.values()));
        setDuplicateWarningDismissed(false);
      } finally {
        setIsCheckingDuplicates(false);
      }
    }, 500);
    return () => clearTimeout(id);
  }, [formData.firstName, formData.lastName, formData.phone, formData.email, showModal]);

  const openRegistrationModal = async () => {
    const draft = registrationDraft.restore();
    const draftHasContent = !!draft && (draft.firstName || draft.lastName || draft.phone);
    if (draftHasContent) {
      const restoreConfirmed = await confirm({
        title: 'Restore unsaved registration?',
        message: `You have an unsaved registration in progress${draft!.firstName || draft!.lastName ? ` for "${draft!.firstName} ${draft!.lastName}"` : ''}. Restore it, or start fresh?`,
        confirmText: 'Restore Draft',
        cancelText: 'Start Fresh',
        variant: 'info',
      });
      if (restoreConfirmed) {
        setFormData(draft!);
      } else {
        registrationDraft.clear();
        setFormData(EMPTY_FORM);
      }
    }
    setShowModal(true);
  };

  const closeRegistrationModal = () => {
    registrationDraft.clear();
    setShowModal(false);
    setDuplicateCandidates([]);
    setFormData(EMPTY_FORM);
    setError('');
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    // When state changes, reset LGA
    if (name === 'state') {
      setFormData(prev => ({ ...prev, state: value, lga: '' }));
      return;
    }
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const resolveDOB = (): string => {
    if (formData.dobUnknown && formData.approximateYear) return `${formData.approximateYear}-01-01`;
    return formData.dateOfBirth;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    const dob = resolveDOB();
    if (!dob) { setError('Please provide a date of birth or approximate year.'); setIsSubmitting(false); return; }

    try {
      const token = localStorage.getItem('token');
      if (!token) { setError('Please login first'); setIsSubmitting(false); return; }

      const hasEmergencyContact =
        formData.emergencyContactName.trim() ||
        formData.emergencyContactPhone.trim() ||
        formData.emergencyContactRelationship.trim();

      const payload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        dateOfBirth: dob,
        gender: formData.gender,
        phone: formData.phone,
        email: formData.email || undefined,
        address: formData.address || undefined,
        state: formData.state,
        lga: formData.lga || undefined,
        bloodGroup: formData.bloodGroup || undefined,
        genotype: formData.genotype || undefined,
        allergies: formData.allergies,
        patientAllergies: formData.patientAllergies,
        chronicConditions: formData.chronicConditions,
        pastSurgicalHistory: formData.pastSurgicalHistory || undefined,
        emergencyContact: hasEmergencyContact ? {
          name: formData.emergencyContactName,
          phone: formData.emergencyContactPhone,
          relationship: formData.emergencyContactRelationship,
        } : undefined,
        patientType: formData.patientType,
        hmoProvider: formData.patientType === 'HMO'
          ? (formData.hmoProvider === 'OTHER' ? formData.hmoProviderOther : formData.hmoProvider)
          : undefined,
        hmoNumber: formData.patientType === 'HMO' ? formData.hmoNumber : undefined,
        nhisNumber: formData.nhisNumber || undefined,
        consentGiven: formData.consentGiven,
      };

      // Generated up front so it can double as the idempotency key if this
      // request fails and gets queued for offline replay (see
      // sync.controller.ts's applyCreate) — the same id is used whether the
      // create succeeds immediately or only after reconnecting later, so a
      // chained offline triage record can safely reference it right away.
      const entityId = globalThis.crypto?.randomUUID
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const res = await offlineFetch(
        `${window.location.protocol}//${window.location.hostname}:3000/api/patients`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ...payload, id: entityId }),
        },
        { entityType: 'PATIENT', entityId, operation: 'CREATE' }
      );
      const data = await res.json();

      if (data.queued) {
        registrationDraft.clear();
        setShowModal(false);
        setFormData(EMPTY_FORM);
        toast.success(
          'Saved offline',
          `${formData.firstName} ${formData.lastName} will be registered automatically once your connection returns. A Patient ID will be assigned then.`
        );
        // The record doesn't exist server-side yet, so there's nothing for
        // PatientDetailView to fetch — skip navigating into it. Triage can
        // still be queued right away against the same pre-generated id; it
        // will replay in order right after this create.
        const userStr = localStorage.getItem('user');
        const user = userStr ? JSON.parse(userStr) : null;
        if (user?.role === 'NURSE') {
          setTriagePromptPatient({ id: entityId, fullName: `${formData.firstName} ${formData.lastName}` });
        }
      } else if (res.ok) {
        toast.success('Patient Registered Successfully!', `Patient ID: ${data.data.patientId} has been created.`);
        registrationDraft.clear();
        setShowModal(false);
        setFormData(EMPTY_FORM);
        // Land on the new record immediately — the toast alone isn't enough
        // to hand a Patient ID off to a nurse before it auto-dismisses.
        setSelectedPatient({ id: data.data.id } as Patient);
        // Prompt for immediate triage only for nurses
        const userStr = localStorage.getItem('user');
        const user = userStr ? JSON.parse(userStr) : null;

        if (user?.role === 'NURSE') {
          setTriagePromptPatient({
            id: data.data.id,
            fullName: `${data.data.firstName} ${data.data.lastName}`
          });
        }
      } else {
        toast.error('Registration Failed', data.message || 'Please try again.');
      }
    } catch {
      toast.error('Registration Failed', 'Check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Patients</h2>
        {canRegisterPatients && (
          <button className="btn btn-primary flex items-center" onClick={openRegistrationModal}>
            <Plus className="w-5 h-5 mr-2" /> Register New Patient
          </button>
        )}
      </div>

      {/* Search */}
      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search patients by name, phone, or patient ID (min 3 characters)..."
            className="input pl-10 w-full"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={() => searchQuery.length >= 3 && setShowResults(true)}
          />
          {isSearching && (
            <div className="absolute right-3 top-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
            </div>
          )}
        </div>

        {showResults && searchQuery.length >= 3 && (
          <div className="absolute z-10 mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto">
            {searchResults.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {searchResults.map(patient => (
                  <div key={patient.id} onClick={() => { setSelectedPatient(patient); setShowResults(false); }}
                    className="p-4 hover:bg-gray-50 cursor-pointer transition-colors">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="font-semibold text-gray-900">{patient.fullName}</span>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">{patient.patientId}</span>
                      {patient.hasAllergies && <AlertCircle className="w-4 h-4 text-red-500" title="Has allergies" />}
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-sm text-gray-600 ml-6">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{patient.age} yrs</span>
                      <span>{patient.gender}</span>
                      <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{patient.phone}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <Search className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No patients found matching &quot;{searchQuery}&quot;</p>
                <p className="text-sm mt-1">Try name, phone number, or patient ID</p>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedPatient ? (
        <PatientDetailView patientId={selectedPatient.id} onBack={() => setSelectedPatient(null)} />
      ) : (
        <div className="card">
          <p className="text-gray-600 text-center py-8">
            {searchQuery ? 'Search for a patient above to view details' : 'Use the search bar above to find patients by name, phone, or patient ID'}
          </p>
        </div>
      )}

      {/* Registration Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">

            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center z-10 rounded-t-lg">
              <div>
                <h3 className="text-2xl font-bold flex items-center gap-2">
                  <User className="w-6 h-6 text-purple-600" /> Register New Patient
                </h3>
                <p className="text-sm text-gray-600 mt-1">Complete the form below to register a new patient</p>
              </div>
              <button type="button" onClick={closeRegistrationModal} className="text-gray-400 hover:text-gray-600">
                <Plus className="w-6 h-6 transform rotate-45" />
              </button>
            </div>

            {error && (
              <div className="px-6 pt-4">
                <ErrorAlert message={error} severity="error" onDismiss={() => setError('')} />
              </div>
            )}

            <form onSubmit={handleSubmit} className="p-6">

              {/* Personal Information */}
              <div className="mb-6">
                <h4 className="font-semibold mb-3 text-lg border-b pb-2">Personal Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  <div>
                    <label className="block text-sm font-medium mb-1">First Name *</label>
                    <input type="text" name="firstName" value={formData.firstName} onChange={handleInputChange} className="input w-full" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Last Name *</label>
                    <input type="text" name="lastName" value={formData.lastName} onChange={handleInputChange} className="input w-full" required />
                  </div>

                  {/* DOB with unknown escape hatch */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">Date of Birth *</label>
                    <div className="flex items-center gap-2 mb-2">
                      <input type="checkbox" name="dobUnknown" id="dobUnknown" checked={formData.dobUnknown} onChange={handleInputChange} />
                      <label htmlFor="dobUnknown" className="text-sm text-gray-600">
                        Date of birth unknown — enter approximate year instead
                      </label>
                    </div>
                    {formData.dobUnknown ? (
                      <input type="number" name="approximateYear" value={formData.approximateYear} onChange={handleInputChange}
                        placeholder="e.g. 1965" min="1900" max={new Date().getFullYear()} className="input w-full" required />
                    ) : (
                      <input type="date" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleInputChange} className="input w-full" required />
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Gender *</label>
                    <Dropdown name="gender" value={formData.gender} onChange={handleInputChange} className="input w-full" required>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </Dropdown>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Phone *</label>
                    <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange}
                      placeholder="08012345678 or +2348012345678" className="input w-full" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Email</label>
                    <input type="email" name="email" value={formData.email} onChange={handleInputChange} className="input w-full" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">Address</label>
                    <input type="text" name="address" value={formData.address} onChange={handleInputChange} className="input w-full" />
                  </div>

                  {/* State → LGA dynamic dropdown */}
                  <div>
                    <label className="block text-sm font-medium mb-1">State *</label>
                    <Dropdown name="state" value={formData.state} onChange={handleInputChange} className="input w-full" required>
                      <option value="">Select state...</option>
                      {NIGERIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </Dropdown>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">LGA</label>
                    <Dropdown name="lga" value={formData.lga} onChange={handleInputChange} className="input w-full" disabled={!formData.state}>
                      <option value="">{formData.state ? 'Select LGA...' : 'Select state first'}</option>
                      {availableLGAs.map(lga => <option key={lga} value={lga}>{lga}</option>)}
                    </Dropdown>
                  </div>

                </div>
              </div>

              {/* Live duplicate-patient detection — fires as name/phone/email are typed */}
              {!duplicateWarningDismissed && (isCheckingDuplicates || duplicateCandidates.length > 0) && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-lg">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-amber-900">
                          {isCheckingDuplicates ? 'Checking for existing patients...' : 'Possible existing patient found'}
                        </h4>
                        {!isCheckingDuplicates && (
                          <p className="text-sm text-amber-700 mt-0.5">
                            Someone with a matching name, phone, or email is already registered. Double-check before continuing.
                          </p>
                        )}
                      </div>
                    </div>
                    <button type="button" onClick={() => setDuplicateWarningDismissed(true)} className="text-amber-400 hover:text-amber-600 flex-shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {duplicateCandidates.length > 0 && (
                    <div className="mt-3 divide-y divide-amber-200 border border-amber-200 rounded-lg bg-white overflow-hidden">
                      {duplicateCandidates.map(patient => (
                        <div key={patient.id} className="p-3 flex items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-gray-400" />
                              <span className="font-semibold text-gray-900">{patient.fullName}</span>
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">{patient.patientId}</span>
                              {patient.hasAllergies && <AlertCircle className="w-4 h-4 text-red-500" title="Has allergies" />}
                            </div>
                            <div className="mt-1 flex items-center gap-4 text-sm text-gray-600 ml-6">
                              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{patient.age} yrs</span>
                              <span>{patient.gender}</span>
                              <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{patient.phone}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => { closeRegistrationModal(); setSelectedPatient(patient); }}
                            className="btn btn-secondary text-sm px-3 py-1.5 flex-shrink-0"
                          >
                            View This Record
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Medical History */}
              <div className="mb-6">
                <h4 className="font-semibold mb-3 text-lg border-b pb-2">Medical History</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Blood Group</label>
                    <Dropdown name="bloodGroup" value={formData.bloodGroup} onChange={handleInputChange} className="input w-full">
                      <option value="">Select...</option>
                      {BLOOD_GROUPS.map(bg => <option key={bg.value} value={bg.value}>{bg.label}</option>)}
                    </Dropdown>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Genotype</label>
                    <Dropdown name="genotype" value={formData.genotype} onChange={handleInputChange} className="input w-full">
                      <option value="">Select...</option>
                      {['AA','AS','SS','AC','SC'].map(g => <option key={g} value={g}>{g}</option>)}
                    </Dropdown>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-2">Structured Allergies</label>
                    
                    <div className="bg-gray-50 p-3 rounded border border-gray-200 mb-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input type="text" placeholder="Allergen (e.g. Penicillin)" className="input text-sm" value={newAllergy.allergen} onChange={e => setNewAllergy({...newAllergy, allergen: e.target.value})} />
                        <input type="text" placeholder="Reaction (e.g. Hives, Anaphylaxis)" className="input text-sm" value={newAllergy.reactionType} onChange={e => setNewAllergy({...newAllergy, reactionType: e.target.value})} />
                        <div className="flex gap-2">
                          <Dropdown className="input text-sm flex-1" value={newAllergy.severity} onChange={e => setNewAllergy({...newAllergy, severity: e.target.value})}>
                            <option value="MILD">Mild</option>
                            <option value="MODERATE">Moderate</option>
                            <option value="SEVERE">Severe</option>
                            <option value="LIFE_THREATENING">Life Threatening</option>
                          </Dropdown>
                          <button type="button" onClick={() => {
                            if (newAllergy.allergen && newAllergy.reactionType) {
                              setFormData(prev => ({ ...prev, patientAllergies: [...prev.patientAllergies, newAllergy] }));
                              setNewAllergy({ allergen: '', reactionType: '', severity: 'MILD' });
                            }
                          }} className="btn btn-secondary text-sm px-3">+</button>
                        </div>
                      </div>
                    </div>

                    {formData.patientAllergies.length > 0 && (
                      <div className="space-y-2 mb-4">
                        {formData.patientAllergies.map((alg, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-red-50 p-2 rounded text-sm text-red-800 border border-red-100">
                            <div>
                              <strong>{alg.allergen}</strong> — {alg.reactionType} <span className="ml-2 text-xs font-bold uppercase">({alg.severity})</span>
                            </div>
                            <button type="button" onClick={() => setFormData(prev => ({ ...prev, patientAllergies: prev.patientAllergies.filter((_, i) => i !== idx) }))} className="text-red-500 hover:text-red-700 font-bold">&times;</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">
                      Chronic Conditions{' '}
                      <span className="text-gray-400 font-normal">(type and press Enter or comma to add)</span>
                    </label>
                    <TagInput
                      tags={formData.chronicConditions}
                      onChange={tags => setFormData(prev => ({ ...prev, chronicConditions: tags }))}
                      placeholder="e.g. Diabetes, Hypertension, Asthma..."
                      chipColor="yellow"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">Past Surgical History / Major Procedures</label>
                    <textarea name="pastSurgicalHistory" value={formData.pastSurgicalHistory} onChange={handleInputChange}
                      placeholder="e.g. Appendectomy (2018), Cesarean Section (2020)" className="input w-full" rows={3} />
                  </div>
                </div>
              </div>

              {/* Insurance & Billing Details */}
              <div className="mb-6">
                <h4 className="font-semibold mb-3 text-lg border-b pb-2">Insurance & Billing Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-2">Patient Type *</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer bg-white border rounded p-3 flex-1 hover:border-primary-500">
                        <input type="radio" name="patientType" value="PRIVATE" checked={formData.patientType === 'PRIVATE'} onChange={handleInputChange} className="text-primary-600 focus:ring-primary-500" />
                        <span className="font-medium text-gray-700">Private Patient (Out of pocket)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer bg-white border rounded p-3 flex-1 hover:border-primary-500">
                        <input type="radio" name="patientType" value="HMO" checked={formData.patientType === 'HMO'} onChange={handleInputChange} className="text-primary-600 focus:ring-primary-500" />
                        <span className="font-medium text-gray-700">HMO / Insurance</span>
                      </label>
                    </div>
                  </div>
                  
                  {formData.patientType === 'HMO' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium mb-1">HMO Provider Name *</label>
                        <Dropdown name="hmoProvider" value={formData.hmoProvider} onChange={handleInputChange} className="input w-full" required={formData.patientType === 'HMO'}>
                          <option value="">Select HMO provider...</option>
                          {hmoProviders.filter(p => p.type === 'HMO' || p.type === 'NHIA').map(p => (
                            <option key={p.id} value={p.name}>{p.name}</option>
                          ))}
                          <option value="OTHER">Other (specify)</option>
                        </Dropdown>
                        {formData.hmoProvider === 'OTHER' && (
                          <input type="text" name="hmoProviderOther" value={formData.hmoProviderOther} onChange={handleInputChange}
                            className="input w-full mt-2" placeholder="Enter HMO provider name" required />
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">HMO ID / Enrollee Number *</label>
                        <input type="text" name="hmoNumber" value={formData.hmoNumber} onChange={handleInputChange} className="input w-full" placeholder="e.g. HYG-123456" required={formData.patientType === 'HMO'} />
                      </div>
                    </>
                  )}
                  
                  <div className={formData.patientType === 'PRIVATE' ? 'md:col-span-2' : ''}>
                    <label className="block text-sm font-medium mb-1">NHIS Number <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input type="text" name="nhisNumber" value={formData.nhisNumber} onChange={handleInputChange} className="input w-full" placeholder="National Health Insurance Number" />
                  </div>
                </div>
              </div>

              {/* Emergency Contact — optional */}
              <div className="mb-6">
                <h4 className="font-semibold mb-1 text-lg border-b pb-2">
                  Emergency Contact <span className="text-sm font-normal text-gray-400">(optional)</span>
                </h4>
                <p className="text-xs text-gray-500 mb-3">Can be added later from the patient record if not available now.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Name</label>
                    <input type="text" name="emergencyContactName" value={formData.emergencyContactName} onChange={handleInputChange} className="input w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Relationship</label>
                    <input type="text" name="emergencyContactRelationship" value={formData.emergencyContactRelationship} onChange={handleInputChange} className="input w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Phone</label>
                    <input type="tel" name="emergencyContactPhone" value={formData.emergencyContactPhone} onChange={handleInputChange} placeholder="08012345678" className="input w-full" />
                  </div>
                </div>
              </div>

              {/* Consent — NDPR only */}
              <div className="mb-6">
                <h4 className="font-semibold mb-3 text-lg border-b pb-2">Data Processing Consent</h4>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <h5 className="font-semibold text-sm mb-2 text-blue-900">Consent to Data Processing</h5>
                  <p className="text-sm text-blue-800 mb-2">
                    By providing your consent, you agree to allow St. Stephen&apos;s Medical Centre to collect, store,
                    and process your personal and medical information for the following purposes:
                  </p>
                  <ul className="text-sm text-blue-800 list-disc list-inside space-y-1 ml-2">
                    <li>Providing medical care and treatment</li>
                    <li>Maintaining your medical records</li>
                    <li>Billing and insurance purposes</li>
                    <li>Legal and regulatory compliance</li>
                    <li>Quality improvement and patient safety</li>
                  </ul>
                  <p className="text-xs text-blue-700 mt-3">
                    Your data will be protected in accordance with the Nigeria Data Protection Regulation (NDPR).
                    You have the right to access, modify, or request deletion of your data at any time.
                  </p>
                  <p className="text-xs text-blue-600 mt-2 font-medium">
                    Consent Version: 1.0 | Effective Date: {new Date().toLocaleDateString()}
                  </p>
                </div>
                <label className="flex items-start">
                  <input type="checkbox" name="consentGiven" checked={formData.consentGiven} onChange={handleInputChange} className="mr-2 mt-1" required />
                  <span className="text-sm">
                    <strong>I have read and understood the above information.</strong> I consent to the collection,
                    storage, and processing of my personal and medical data by St. Stephen&apos;s Medical Centre as described above. *
                  </span>
                </label>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <button type="button" onClick={closeRegistrationModal} className="btn btn-secondary" disabled={isSubmitting}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Registering...' : 'Register Patient'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {newPatientTriage && (
        <TriageAssessmentModal
          isOpen={!!newPatientTriage}
          onClose={() => setNewPatientTriage(null)}
          patientId={newPatientTriage.id}
          patientName={newPatientTriage.fullName}
          onSuccess={() => {
            setNewPatientTriage(null);
            toast.success('Triage Completed', 'Patient vitals recorded successfully.');
          }}
        />
      )}


      <ConfirmDialog
        isOpen={confirmIsOpen}
        onClose={handleCancel}
        onConfirm={handleConfirm}
        title={confirmOptions.title}
        message={confirmOptions.message}
        confirmText={confirmOptions.confirmText}
        cancelText={confirmOptions.cancelText}
        variant={confirmOptions.variant}
        loading={confirmLoading}
      />

      {/* Custom Triage Prompt Modal */}
      {triagePromptPatient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 transform transition-all">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mx-auto mb-4">
              <User className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-center mb-2 text-gray-900">Patient Registered Successfully!</h3>
            <p className="text-gray-600 text-center mb-6">
              Would you like to take vitals (Triage) for <span className="font-semibold text-gray-800">{triagePromptPatient.fullName}</span> now?
            </p>
            <div className="flex justify-center gap-3">
              <button 
                type="button" 
                className="btn btn-secondary px-6" 
                onClick={() => setTriagePromptPatient(null)}
              >
                No, Later
              </button>
              <button 
                type="button" 
                className="btn btn-primary px-6" 
                onClick={() => {
                  setNewPatientTriage(triagePromptPatient);
                  setTriagePromptPatient(null);
                }}
              >
                Yes, Take Vitals
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientsPage;