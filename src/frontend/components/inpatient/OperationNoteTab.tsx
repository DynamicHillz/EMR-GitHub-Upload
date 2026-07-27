import React, { useState, useEffect } from 'react';
import { Pill } from 'lucide-react';
import InpatientService from '../../services/InpatientService';
import { OperationNote } from '../../types/inpatient';
import PrescriptionModal from '../consultations/PrescriptionModal';
import VoidRecordModal from './charts/VoidRecordModal';
import TypeaheadTextField from '../common/TypeaheadTextField';

interface OperationNotePatient {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  allergies: string[];
}

interface Props {
  admissionId: string;
  patient: OperationNotePatient;
  isReadonly?: boolean;
}

const emptyForm = {
  surgicalProcedure: '',
  indication: '',
  surgeons: '',
  assistants: '',
  anaesthetics: '',
  anaesthetist: '',
  anaesthesis: '',
  incision: '',
  findings: '',
  procedure: '',
  plan: '',
  others: '',
};

const OperationNoteTab: React.FC<Props> = ({ admissionId, patient, isReadonly = false }) => {
  const [notes, setNotes] = useState<OperationNote[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);

  const loadNotes = async () => {
    try {
      setLoading(true);
      const data = await InpatientService.getOperationNotes(admissionId);
      setNotes(data);
    } catch (error) {
      console.error('Failed to load operation notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPrescriptions = async () => {
    try {
      const token = localStorage.getItem('token');
      const apiBaseUrl = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`;
      const res = await fetch(`${apiBaseUrl}/api/prescriptions?admissionId=${admissionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const result = await res.json();
        setPrescriptions(Array.isArray(result.data) ? result.data : []);
      }
    } catch (error) {
      console.error('Failed to load postop medications:', error);
    }
  };

  useEffect(() => {
    loadNotes();
    loadPrescriptions();
  }, [admissionId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.surgicalProcedure || !formData.surgeons) {
      alert('Surgical Procedure and Surgeons are required');
      return;
    }
    if (!formData.plan) {
      alert('Plan is required');
      return;
    }
    try {
      setSaving(true);
      await InpatientService.addOperationNote(admissionId, formData);
      setFormData(emptyForm);
      loadNotes();
    } catch (err) {
      alert('Failed to save operation note');
    } finally {
      setSaving(false);
    }
  };

  const fields: Array<{ key: keyof typeof emptyForm; label: string; required?: boolean; textarea?: boolean }> = [
    { key: 'surgicalProcedure', label: 'Surgical Procedure', required: true },
    { key: 'indication', label: 'Indication' },
    { key: 'surgeons', label: 'Surgeon(s)', required: true },
    { key: 'assistants', label: 'Assistant(s)' },
    { key: 'anaesthetics', label: 'Anaesthetics' },
    { key: 'anaesthetist', label: 'Anaesthetist' },
    { key: 'anaesthesis', label: 'Anaesthesis' },
    { key: 'incision', label: 'Incision' },
    { key: 'findings', label: 'Findings', textarea: true },
    { key: 'procedure', label: 'Procedure', textarea: true },
    { key: 'plan', label: 'Plan', required: true, textarea: true },
    { key: 'others', label: 'Others', textarea: true },
  ];

  return (
    <div className="space-y-6">
      {!isReadonly && (
        <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <h3 className="font-medium text-gray-800 mb-4">Record Operation Note</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map((field) => (
              <div key={field.key} className={field.textarea ? 'md:col-span-2' : ''}>
                <label className="block text-xs font-medium text-gray-700">
                  {field.label}
                  {field.required && <span className="text-red-500"> *</span>}
                </label>
                {field.textarea ? (
                  <TypeaheadTextField
                    name={field.key}
                    rows={field.key === 'plan' ? 4 : 3}
                    required={field.required}
                    className="mt-1 block w-full px-3 py-2 rounded-md border-2 border-gray-300 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none sm:text-sm"
                    value={formData[field.key]}
                    onChange={handleChange}
                  />
                ) : (
                  <TypeaheadTextField
                    name={field.key}
                    required={field.required}
                    className="mt-1 block w-full px-3 py-2 rounded-md border-2 border-gray-300 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none sm:text-sm"
                    value={formData[field.key]}
                    onChange={handleChange}
                  />
                )}
              </div>
            ))}
          </div>
          <button
            type="submit"
            disabled={saving}
            className="mt-4 px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700"
          >
            {saving ? 'Saving...' : 'Save Operation Note'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="p-4 text-center text-gray-500">Loading operation notes...</div>
      ) : notes.length === 0 ? (
        <div className="p-4 text-center text-gray-500">No operation notes recorded for this admission.</div>
      ) : (
        <div className="space-y-4">
          {notes.map((note) => (
            <div key={note.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold text-gray-900">{note.surgicalProcedure}</h4>
                <span className="text-xs text-gray-500">{new Date(note.operationDate).toLocaleString()}</span>
              </div>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                {note.indication && <div><dt className="inline font-medium text-gray-600">Indication: </dt><dd className="inline text-gray-800">{note.indication}</dd></div>}
                <div><dt className="inline font-medium text-gray-600">Surgeon(s): </dt><dd className="inline text-gray-800">{note.surgeons}</dd></div>
                {note.assistants && <div><dt className="inline font-medium text-gray-600">Assistant(s): </dt><dd className="inline text-gray-800">{note.assistants}</dd></div>}
                {note.anaesthetics && <div><dt className="inline font-medium text-gray-600">Anaesthetics: </dt><dd className="inline text-gray-800">{note.anaesthetics}</dd></div>}
                {note.anaesthetist && <div><dt className="inline font-medium text-gray-600">Anaesthetist: </dt><dd className="inline text-gray-800">{note.anaesthetist}</dd></div>}
                {note.anaesthesis && <div><dt className="inline font-medium text-gray-600">Anaesthesis: </dt><dd className="inline text-gray-800">{note.anaesthesis}</dd></div>}
                {note.incision && <div><dt className="inline font-medium text-gray-600">Incision: </dt><dd className="inline text-gray-800">{note.incision}</dd></div>}
                {note.findings && <div className="md:col-span-2"><dt className="inline font-medium text-gray-600">Findings: </dt><dd className="inline text-gray-800">{note.findings}</dd></div>}
                {note.procedure && <div className="md:col-span-2"><dt className="inline font-medium text-gray-600">Procedure: </dt><dd className="inline text-gray-800">{note.procedure}</dd></div>}
                {note.plan && <div className="md:col-span-2"><dt className="inline font-medium text-gray-600">Plan: </dt><dd className="inline text-gray-800">{note.plan}</dd></div>}
                {note.others && <div className="md:col-span-2"><dt className="inline font-medium text-gray-600">Others: </dt><dd className="inline text-gray-800">{note.others}</dd></div>}
              </dl>
              <div className="flex justify-between items-center mt-2">
                <p className="text-xs text-gray-400">
                  Recorded by {note.recordedBy?.firstName} {note.recordedBy?.lastName}
                </p>
                {!isReadonly && (
                  <button onClick={() => setVoidingId(note.id)} className="inline-flex items-center px-2.5 py-1 border border-red-300 rounded text-xs font-medium text-red-700 bg-white hover:bg-red-50">
                    Void
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {voidingId && (
        <VoidRecordModal
          title="Void Operation Note"
          onClose={() => setVoidingId(null)}
          onConfirm={async (reason) => {
            await InpatientService.voidOperationNote(admissionId, voidingId, reason);
            setVoidingId(null);
            loadNotes();
          }}
        />
      )}

      {/* Postop Medications */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-medium text-gray-800">Add Medication</h3>
          {!isReadonly && !showPrescriptionModal && (
            <button
              type="button"
              onClick={() => setShowPrescriptionModal(true)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm flex items-center gap-1.5"
            >
              <Pill className="w-4 h-4" /> Add Medication
            </button>
          )}
        </div>

        {showPrescriptionModal && (
          <PrescriptionModal
            variant="inline"
            context={{ type: 'admission', admissionId }}
            patient={patient}
            onClose={() => setShowPrescriptionModal(false)}
            onSuccess={() => {
              setShowPrescriptionModal(false);
              loadPrescriptions();
            }}
          />
        )}

        {prescriptions.length === 0 ? (
          <p className="text-gray-500 italic text-sm">No medications added yet.</p>
        ) : (
          <div className="space-y-2">
            {prescriptions.map((rx) => (
              <div key={rx.id} className="border border-gray-100 p-3 rounded-md flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{rx.medicationName}</p>
                  <p className="text-xs text-gray-500">{rx.dosage} - {rx.frequency}</p>
                </div>
                <span className="text-xs font-medium text-gray-700 bg-gray-100 px-2 py-1 rounded-full">{rx.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OperationNoteTab;
