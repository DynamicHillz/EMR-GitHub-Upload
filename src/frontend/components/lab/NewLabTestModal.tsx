/**
 * New Lab Test Modal
 *
 * UI for creating standalone lab test orders from the lab module
 * Allows ordering tests without a consultation
 */

import React, { useState, useEffect } from 'react';
import { X, Beaker, Search } from 'lucide-react';
import ErrorAlert from '../common/ErrorAlert';

interface Patient {
  id: string;
  patientId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  age: number;
  gender: string;
}

interface NewLabTestModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface LabTestFormData {
  patientId: string;
  testName: string;
  testCode: string;
  clinicalIndication: string;
  urgency: 'ROUTINE' | 'URGENT' | 'STAT';
  specimenType: string;
}

const NewLabTestModal: React.FC<NewLabTestModalProps> = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState<LabTestFormData>({
    patientId: '',
    testName: '',
    testCode: '',
    clinicalIndication: '',
    urgency: 'ROUTINE',
    specimenType: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Common lab tests
  const commonTests = [
    { name: 'Complete Blood Count', code: 'CBC', specimen: 'Blood' },
    { name: 'Basic Metabolic Panel', code: 'BMP', specimen: 'Blood' },
    { name: 'Comprehensive Metabolic Panel', code: 'CMP', specimen: 'Blood' },
    { name: 'Lipid Panel', code: 'LIPID', specimen: 'Blood' },
    { name: 'Hemoglobin A1C', code: 'HBA1C', specimen: 'Blood' },
    { name: 'Thyroid Stimulating Hormone', code: 'TSH', specimen: 'Blood' },
    { name: 'Urinalysis', code: 'UA', specimen: 'Urine' },
    { name: 'Liver Function Tests', code: 'LFT', specimen: 'Blood' },
    { name: 'Renal Function Tests', code: 'RFT', specimen: 'Blood' },
    { name: 'Prothrombin Time', code: 'PT', specimen: 'Blood' },
    { name: 'International Normalized Ratio', code: 'INR', specimen: 'Blood' },
    { name: 'Blood Culture', code: 'BC', specimen: 'Blood' },
    { name: 'Urine Culture', code: 'UC', specimen: 'Urine' },
    { name: 'Chest X-Ray', code: 'CXR', specimen: 'N/A' },
  ];

  // Debounce patient search
  useEffect(() => {
    if (patientSearch.length < 2) {
      setPatients([]);
      setShowPatientDropdown(false);
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      searchPatients(patientSearch);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [patientSearch]);

  const searchPatients = async (query: string) => {
    setIsSearching(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:3000/api/patients/search?query=${encodeURIComponent(query)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        const patientList = result.data.map((p: any) => ({
          id: p.id,
          patientId: p.patientId,
          firstName: p.firstName,
          lastName: p.lastName,
          fullName: `${p.firstName} ${p.lastName}`,
          age: p.age,
          gender: p.gender,
        }));
        setPatients(patientList);
        setShowPatientDropdown(true);
      }
    } catch (error) {
      console.error('Error searching patients:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handlePatientSelect = (patient: Patient) => {
    setSelectedPatient(patient);
    setPatientSearch(patient.fullName);
    setFormData({ ...formData, patientId: patient.id });
    setShowPatientDropdown(false);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleTestSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedTest = commonTests.find((test) => test.name === e.target.value);
    if (selectedTest) {
      setFormData((prev) => ({
        ...prev,
        testName: selectedTest.name,
        testCode: selectedTest.code,
        specimenType: selectedTest.specimen,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!formData.patientId) {
      setError('Please select a patient');
      return;
    }

    if (!formData.testName) {
      setError('Please enter a test name');
      return;
    }

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/lab/tests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          patientId: formData.patientId,
          testName: formData.testName,
          testCode: formData.testCode || undefined,
          clinicalIndication: formData.clinicalIndication || undefined,
          urgency: formData.urgency,
          specimenType: formData.specimenType || undefined,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setSuccessMessage('Lab test order created successfully!');
        setTimeout(() => {
          setSuccessMessage('');
          onSuccess();
        }, 1500);
      } else {
        setError(`Error: ${result.message || 'Failed to create lab test order'}`);
      }
    } catch (error) {
      console.error('Error creating lab test:', error);
      setError('Failed to create lab test order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center z-10">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Beaker className="w-6 h-6 text-purple-600" />
              New Lab Test Order
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Order a lab test for a patient
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Error/Success Alerts */}
          {error && (
            <div className="mb-4">
              <ErrorAlert
                message={error}
                severity="error"
                onDismiss={() => setError('')}
              />
            </div>
          )}

          {successMessage && (
            <div className="mb-4">
              <ErrorAlert
                message={successMessage}
                severity="info"
                onDismiss={() => setSuccessMessage('')}
              />
            </div>
          )}

          <div className="space-y-4">
            {/* Patient Search */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Patient <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder="Search by name, ID, or phone..."
                  className="input w-full pl-10"
                  disabled={selectedPatient !== null}
                />
                {selectedPatient && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPatient(null);
                      setPatientSearch('');
                      setFormData({ ...formData, patientId: '' });
                    }}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-purple-600 hover:text-purple-800"
                  >
                    Change
                  </button>
                )}
              </div>

              {/* Patient Search Dropdown */}
              {showPatientDropdown && patients.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {patients.map((patient) => (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => handlePatientSelect(patient)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                    >
                      <div className="font-medium">{patient.fullName}</div>
                      <div className="text-sm text-gray-500">
                        {patient.patientId} | {patient.age}y, {patient.gender}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {selectedPatient && (
                <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="font-medium">{selectedPatient.fullName}</div>
                  <div className="text-sm text-gray-600">
                    {selectedPatient.patientId} | {selectedPatient.age}y, {selectedPatient.gender}
                  </div>
                </div>
              )}
            </div>

            {/* Common Tests Quick Select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quick Select Common Test
              </label>
              <select onChange={handleTestSelect} className="input w-full">
                <option value="">-- Select a common test --</option>
                {commonTests.map((test) => (
                  <option key={test.code} value={test.name}>
                    {test.name} ({test.code})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Or enter custom test details below
              </p>
            </div>

            {/* Test Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Test Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="testName"
                value={formData.testName}
                onChange={handleChange}
                required
                className="input w-full"
                placeholder="e.g., Complete Blood Count"
              />
            </div>

            {/* Test Code and Specimen Type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Test Code
                </label>
                <input
                  type="text"
                  name="testCode"
                  value={formData.testCode}
                  onChange={handleChange}
                  className="input w-full"
                  placeholder="e.g., CBC"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Specimen Type
                </label>
                <select
                  name="specimenType"
                  value={formData.specimenType}
                  onChange={handleChange}
                  className="input w-full"
                >
                  <option value="">Select specimen</option>
                  <option value="Blood">Blood</option>
                  <option value="Urine">Urine</option>
                  <option value="Stool">Stool</option>
                  <option value="Sputum">Sputum</option>
                  <option value="Swab">Swab</option>
                  <option value="Tissue">Tissue</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {/* Clinical Indication */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Clinical Indication
              </label>
              <textarea
                name="clinicalIndication"
                value={formData.clinicalIndication}
                onChange={handleChange}
                rows={3}
                className="input w-full"
                placeholder="Reason for ordering this test (e.g., Routine screening, Follow-up)"
              />
            </div>

            {/* Urgency */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Urgency
              </label>
              <div className="grid grid-cols-3 gap-3">
                <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="urgency"
                    value="ROUTINE"
                    checked={formData.urgency === 'ROUTINE'}
                    onChange={handleChange}
                    className="mr-2"
                  />
                  <div>
                    <div className="font-medium">Routine</div>
                    <div className="text-xs text-gray-500">24-48 hours</div>
                  </div>
                </label>

                <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="urgency"
                    value="URGENT"
                    checked={formData.urgency === 'URGENT'}
                    onChange={handleChange}
                    className="mr-2"
                  />
                  <div>
                    <div className="font-medium text-orange-700">Urgent</div>
                    <div className="text-xs text-gray-500">Within 4 hours</div>
                  </div>
                </label>

                <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="urgency"
                    value="STAT"
                    checked={formData.urgency === 'STAT'}
                    onChange={handleChange}
                    className="mr-2"
                  />
                  <div>
                    <div className="font-medium text-red-700">STAT</div>
                    <div className="text-xs text-gray-500">Immediate</div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Lab Test Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewLabTestModal;
