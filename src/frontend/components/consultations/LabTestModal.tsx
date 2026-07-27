/**
 * Lab Test Order Modal Component
 *
 * UI for ordering lab tests from consultations
 * REQ-CLIN-4: Lab test ordering with clinical indication
 */

import React, { useState, useEffect } from 'react';
import { X, Beaker } from 'lucide-react';
import { useToast } from '../ToastContainer';
import Dropdown from '../common/Dropdown';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
}

interface LabTestModalProps {
  consultationId: string;
  patient: Patient;
  onClose: () => void;
  onSuccess: () => void;
  /** 'modal' (default) is a full-screen overlay; 'inline' renders as an
   * expandable card in place, matching the Add Medication pattern used in
   * WardRoundModal/DischargeModal — no backdrop, no fixed positioning. */
  variant?: 'modal' | 'inline';
}

interface LabTestFormData {
  testId?: string;
  testName: string;
  testCode: string;
  clinicalIndication: string;
  urgency: 'ROUTINE' | 'URGENT' | 'STAT';
  specimenType: string;
}

const LabTestModal: React.FC<LabTestModalProps> = ({
  consultationId,
  patient,
  onClose,
  onSuccess,
  variant = 'modal',
}) => {
  const isInline = variant === 'inline';
  const toast = useToast();

  const [formData, setFormData] = useState<LabTestFormData>({
    testName: '',
    testCode: '',
    clinicalIndication: '',
    urgency: 'ROUTINE',
    specimenType: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dynamic lab dictionary state
  const [commonTests, setCommonTests] = useState<any[]>([]);

  useEffect(() => {
    fetchDictionary();
  }, []);

  const fetchDictionary = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${window.location.protocol}//${window.location.hostname}:3000/api/lab/dictionary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const result = await response.json();
        // The dictionary can list the same test name more than once (e.g.
        // one row per parameter) — dedupe by name so the quick-select
        // list doesn't show the same test repeated.
        const seenNames = new Set<string>();
        const dedupedTests = result.data
          .map((t: any) => ({
            id: t.id,
            name: t.name,
            code: t.loincCode || t.name,
            specimen: 'Blood', // default or map if available
            parameterCount: Array.isArray(t.parameters) ? t.parameters.length : 0,
          }))
          .filter((t: any) => {
            if (seenNames.has(t.name)) return false;
            seenNames.add(t.name);
            return true;
          });
        setCommonTests(dedupedTests);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      // Editing the test name by hand after picking from the dropdown means
      // it may no longer be that catalog entry — drop the stale id so the
      // backend falls back to a name match/custom entry instead of silently
      // reusing the wrong panel's parameters.
      ...(name === 'testName' ? { testId: undefined } : {}),
    }));
  };

  const handleTestSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedTest = commonTests.find((test) => test.name === e.target.value);
    if (selectedTest) {
      setFormData((prev) => ({
        ...prev,
        testId: selectedTest.id,
        testName: selectedTest.name,
        testCode: selectedTest.code,
        specimenType: selectedTest.specimen,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.testName || !formData.clinicalIndication) {
      toast.error('Validation Error', 'Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${window.location.protocol}//${window.location.hostname}:3000/api/consultations/${consultationId}/lab-tests`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            patientId: patient.id,
            testId: formData.testId || undefined,
            testName: formData.testName,
            testCode: formData.testCode || undefined,
            clinicalIndication: formData.clinicalIndication,
            urgency: formData.urgency,
            specimenType: formData.specimenType || undefined,
          }),
        }
      );

      const result = await response.json();

      if (response.ok) {
        toast.success('Success', 'Lab test ordered successfully!');
        onSuccess();
      } else {
        toast.error('Error', result.message || 'Failed to order lab test');
      }
    } catch (error) {
      console.error('Error ordering lab test:', error);
      toast.error('Error', 'Failed to order lab test. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const outerClass = isInline
    ? 'mt-4 p-4 border border-purple-200 bg-purple-50 rounded-lg'
    : 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200';
  const cardClass = isInline
    ? ''
    : 'bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-gray-100';

  return (
    <div className={outerClass}>
      <div className={cardClass}>
        {/* Header */}
        {isInline ? (
          <div className="flex items-center justify-between mb-4">
            <h5 className="font-medium text-purple-900 text-sm flex items-center gap-2">
              <Beaker className="w-4 h-4" />
              Order Lab Test
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
          <div className="bg-gradient-to-r from-purple-600 to-indigo-700 px-6 py-4 flex items-center justify-between text-white flex-shrink-0 shadow-md">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg shadow-inner">
                <Beaker className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-wide">Order Lab Test</h2>
                <p className="text-purple-100 text-sm opacity-90 mt-0.5">
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

        {/* Form */}
        <div className={isInline ? '' : 'overflow-y-auto p-6 bg-gray-50 flex-grow'}>
          <form onSubmit={handleSubmit} className={isInline ? 'space-y-5' : 'space-y-6 bg-white p-6 rounded-xl shadow-sm border border-gray-100'}>
            <div className="space-y-5">
            {/* Common Tests Quick Select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quick Select Common Test
              </label>
              <Dropdown onChange={handleTestSelect} className="input w-full">
                <option value="">-- Select a common test --</option>
                {commonTests.map((test) => (
                  <option key={test.name} value={test.name}>
                    {test.name}{test.code && test.code !== test.name ? ` (${test.code})` : ''}
                    {test.parameterCount > 0 ? ` — ${test.parameterCount} parameter${test.parameterCount === 1 ? '' : 's'} auto-filled` : ''}
                  </option>
                ))}
              </Dropdown>
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
                <Dropdown
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
                </Dropdown>
              </div>
            </div>

            {/* Clinical Indication */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Clinical Indication <span className="text-red-500">*</span>
              </label>
              <textarea
                name="clinicalIndication"
                value={formData.clinicalIndication}
                onChange={handleChange}
                required
                rows={3}
                className="input w-full"
                placeholder="Reason for ordering this test (e.g., Rule out anemia, Monitor diabetes control)"
              />
              <p className="text-xs text-gray-500 mt-1">
                Provide the clinical reason for ordering this test
              </p>
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
                  ? 'bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium py-1.5 px-4 rounded-md disabled:opacity-50 flex items-center gap-2'
                  : 'px-5 py-2.5 text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2'}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Ordering...
                  </>
                ) : 'Submit Order'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LabTestModal;
