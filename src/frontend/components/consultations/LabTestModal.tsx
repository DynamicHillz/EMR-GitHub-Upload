/**
 * Lab Test Order Modal Component
 *
 * UI for ordering lab tests from consultations
 * REQ-CLIN-4: Lab test ordering with clinical indication
 */

import React, { useState } from 'react';
import { X, Beaker } from 'lucide-react';
import { useToast } from '../ToastContainer';

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
}

interface LabTestFormData {
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
}) => {
  const toast = useToast();

  const [formData, setFormData] = useState<LabTestFormData>({
    testName: '',
    testCode: '',
    clinicalIndication: '',
    urgency: 'ROUTINE',
    specimenType: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Common lab tests with codes
  const commonTests = [
    { name: 'Complete Blood Count (CBC)', code: 'CBC', specimen: 'Blood' },
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

    if (!formData.testName || !formData.clinicalIndication) {
      toast.error('Validation Error', 'Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:3000/api/consultations/${consultationId}/lab-tests`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            patientId: patient.id,
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Beaker className="w-6 h-6 text-purple-600" />
              Order Lab Test
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Patient: {patient.fullName}
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
          <div className="space-y-4">
            {/* Common Tests Quick Select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quick Select Common Test
              </label>
              <select
                onChange={handleTestSelect}
                className="input w-full"
              >
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
              {isSubmitting ? 'Ordering...' : 'Order Lab Test'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LabTestModal;
