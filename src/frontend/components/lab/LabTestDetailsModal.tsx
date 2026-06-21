/**
 * Lab Test Details Modal
 *
 * Comprehensive modal for managing lab test workflow
 * REQ-LAB-2: Update test status
 * REQ-LAB-3: Structured result entry
 * REQ-LAB-4: Auto-flag abnormal results
 * REQ-LAB-7: Specimen tracking
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Beaker,
  User,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
} from 'lucide-react';
import ErrorAlert from '../common/ErrorAlert';

interface LabTest {
  id: string;
  patientId: string;
  patientName: string;
  patientAge: number;
  patientGender: string;
  patientAllergies: string[];
  patientChronicConditions: string[];
  testName: string;
  testCode: string | null;
  clinicalIndication: string | null;
  urgency: string;
  status: string;
  orderedBy: string;
  orderedByName: string;
  consultationId: string | null;
  specimenType: string | null;
  specimenQuality: string | null;
  collectedAt: string | null;
  rejectionReason: string | null;
  results: LabResultItem[] | null;
  resultNotes: string | null;
  abnormalFlags: AbnormalFlag[] | null;
  referenceRanges: any;
  reviewedBy: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface LabResultItem {
  parameter: string;
  value: string;
  unit: string;
  referenceMin?: number;
  referenceMax?: number;
  referenceRange?: string;
}

interface AbnormalFlag {
  parameter: string;
  value: string;
  referenceRange: string;
  severity: 'HIGH' | 'LOW' | 'CRITICAL_HIGH' | 'CRITICAL_LOW' | 'ABNORMAL';
}

interface LabTestDetailsModalProps {
  testId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const LabTestDetailsModal: React.FC<LabTestDetailsModalProps> = ({
  testId,
  onClose,
  onSuccess,
}) => {
  const [labTest, setLabTest] = useState<LabTest | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'specimen' | 'results' | 'review'>(
    'details'
  );
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Specimen tracking state
  const [specimenType, setSpecimenType] = useState('');
  const [specimenQuality, setSpecimenQuality] = useState('');
  const [collectedAt, setCollectedAt] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  // Results entry state
  const [resultItems, setResultItems] = useState<LabResultItem[]>([]);
  const [resultNotes, setResultNotes] = useState('');

  // Review state
  const [reviewNotes, setReviewNotes] = useState('');
  const [approved, setApproved] = useState(true);

  useEffect(() => {
    fetchLabTestDetails();
  }, [testId]);

  const fetchLabTestDetails = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/api/lab/tests/${testId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        const test = result.data;
        setLabTest(test);

        // Initialize specimen fields
        setSpecimenType(test.specimenType || '');
        setSpecimenQuality(test.specimenQuality || '');
        setCollectedAt(test.collectedAt ? test.collectedAt.split('T')[0] : '');
        setRejectionReason(test.rejectionReason || '');

        // Initialize results
        if (test.results) {
          setResultItems(test.results);
        } else {
          // Initialize with common test parameters based on test code
          setResultItems(getDefaultParameters(test.testCode));
        }

        setResultNotes(test.resultNotes || '');
        setReviewNotes(test.reviewNotes || '');
      }
    } catch (error) {
      console.error('Error fetching lab test details:', error);
      alert('Failed to load lab test details');
    } finally {
      setLoading(false);
    }
  };

  const getDefaultParameters = (testCode: string | null): LabResultItem[] => {
    // Common test parameters
    const commonTests: Record<string, LabResultItem[]> = {
      CBC: [
        { parameter: 'WBC', value: '', unit: 'x10³/µL', referenceMin: 4.5, referenceMax: 11 },
        { parameter: 'RBC', value: '', unit: 'x10⁶/µL', referenceMin: 4.5, referenceMax: 5.5 },
        { parameter: 'Hemoglobin', value: '', unit: 'g/dL', referenceMin: 13, referenceMax: 17 },
        { parameter: 'Hematocrit', value: '', unit: '%', referenceMin: 38, referenceMax: 50 },
        { parameter: 'Platelets', value: '', unit: 'x10³/µL', referenceMin: 150, referenceMax: 400 },
      ],
      BMP: [
        { parameter: 'Sodium', value: '', unit: 'mmol/L', referenceMin: 136, referenceMax: 145 },
        { parameter: 'Potassium', value: '', unit: 'mmol/L', referenceMin: 3.5, referenceMax: 5.1 },
        { parameter: 'Chloride', value: '', unit: 'mmol/L', referenceMin: 98, referenceMax: 107 },
        { parameter: 'Glucose', value: '', unit: 'mg/dL', referenceMin: 70, referenceMax: 100 },
        { parameter: 'Creatinine', value: '', unit: 'mg/dL', referenceMin: 0.7, referenceMax: 1.3 },
      ],
      LIPID: [
        { parameter: 'Total Cholesterol', value: '', unit: 'mg/dL', referenceMax: 200 },
        { parameter: 'LDL', value: '', unit: 'mg/dL', referenceMax: 100 },
        { parameter: 'HDL', value: '', unit: 'mg/dL', referenceMin: 40 },
        { parameter: 'Triglycerides', value: '', unit: 'mg/dL', referenceMax: 150 },
      ],
    };

    return (
      commonTests[testCode || ''] || [
        { parameter: 'Result', value: '', unit: '', referenceRange: '' },
      ]
    );
  };

  const handleUpdateStatus = async (newStatus: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/api/lab/tests/${testId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        alert(`Status updated to ${newStatus}`);
        fetchLabTestDetails();
        onSuccess();
      } else {
        const result = await response.json();
        alert(`Error: ${result.message}`);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    }
  };

  const handleUpdateSpecimen = async (e: React.FormEvent) => {
    e.preventDefault();

    if (specimenQuality === 'REJECTED' && !rejectionReason) {
      alert('Please provide a rejection reason');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/api/lab/tests/${testId}/specimen`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          specimenType,
          specimenQuality,
          collectedAt: collectedAt ? new Date(collectedAt).toISOString() : undefined,
          rejectionReason: specimenQuality === 'REJECTED' ? rejectionReason : undefined,
        }),
      });

      if (response.ok) {
        alert('Specimen details updated successfully');
        fetchLabTestDetails();
        onSuccess();
      } else {
        const result = await response.json();
        alert(`Error: ${result.message}`);
      }
    } catch (error) {
      console.error('Error updating specimen:', error);
      alert('Failed to update specimen details');
    }
  };

  const handleSubmitResults = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all results have values
    const emptyResults = resultItems.filter((item) => !item.value);
    if (emptyResults.length > 0) {
      alert('Please fill in all result values');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/api/lab/tests/${testId}/results`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          results: resultItems,
          resultNotes,
        }),
      });

      if (response.ok) {
        alert('Results submitted successfully! Abnormal values have been flagged automatically.');
        fetchLabTestDetails();
        onSuccess();
        setActiveTab('review');
      } else {
        const result = await response.json();
        alert(`Error: ${result.message}`);
      }
    } catch (error) {
      console.error('Error submitting results:', error);
      alert('Failed to submit results');
    }
  };

  const handleReviewResults = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/api/lab/tests/${testId}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reviewNotes,
          approved,
        }),
      });

      if (response.ok) {
        alert(approved ? 'Results approved and finalized' : 'Review notes saved');
        fetchLabTestDetails();
        onSuccess();
        if (approved) {
          onClose();
        }
      } else {
        const result = await response.json();
        alert(`Error: ${result.message}`);
      }
    } catch (error) {
      console.error('Error reviewing results:', error);
      alert('Failed to review results');
    }
  };

  const updateResultItem = (index: number, field: keyof LabResultItem, value: any) => {
    const updated = [...resultItems];
    updated[index] = { ...updated[index], [field]: value };
    setResultItems(updated);
  };

  const addResultItem = () => {
    setResultItems([
      ...resultItems,
      { parameter: '', value: '', unit: '', referenceRange: '' },
    ]);
  };

  const removeResultItem = (index: number) => {
    setResultItems(resultItems.filter((_, i) => i !== index));
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL_HIGH':
      case 'CRITICAL_LOW':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'HIGH':
      case 'LOW':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'ABNORMAL':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <Beaker className="w-16 h-16 text-purple-600 mx-auto animate-pulse" />
          <p className="mt-4 text-gray-600">Loading test details...</p>
        </div>
      </div>
    );
  }

  if (!labTest) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Beaker className="w-6 h-6 text-purple-600" />
              {labTest.testName}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Patient: {labTest.patientName} ({labTest.patientAge}y, {labTest.patientGender})
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex px-6">
            <button
              onClick={() => setActiveTab('details')}
              className={`py-3 px-4 font-medium border-b-2 transition-colors ${
                activeTab === 'details'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Details
            </button>
            <button
              onClick={() => setActiveTab('specimen')}
              className={`py-3 px-4 font-medium border-b-2 transition-colors ${
                activeTab === 'specimen'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Specimen
            </button>
            <button
              onClick={() => setActiveTab('results')}
              className={`py-3 px-4 font-medium border-b-2 transition-colors ${
                activeTab === 'results'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              disabled={labTest.status === 'PENDING'}
            >
              Results
            </button>
            <button
              onClick={() => setActiveTab('review')}
              className={`py-3 px-4 font-medium border-b-2 transition-colors ${
                activeTab === 'review'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              disabled={labTest.status !== 'COMPLETED' && labTest.status !== 'REVIEWED'}
            >
              Review
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* Patient Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Patient Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Name</p>
                    <p className="font-medium">{labTest.patientName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Age / Gender</p>
                    <p className="font-medium">
                      {labTest.patientAge}y / {labTest.patientGender}
                    </p>
                  </div>
                  {labTest.patientAllergies.length > 0 && (
                    <div className="col-span-2">
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                        Allergies
                      </p>
                      <p className="font-medium text-red-700">
                        {labTest.patientAllergies.join(', ')}
                      </p>
                    </div>
                  )}
                  {labTest.patientChronicConditions.length > 0 && (
                    <div className="col-span-2">
                      <p className="text-sm text-gray-600">Chronic Conditions</p>
                      <p className="font-medium">
                        {labTest.patientChronicConditions.join(', ')}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Test Info */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Test Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Test Code</p>
                    <p className="font-medium">{labTest.testCode || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Urgency</p>
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                        labTest.urgency === 'STAT'
                          ? 'bg-red-100 text-red-800'
                          : labTest.urgency === 'URGENT'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {labTest.urgency}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <p className="font-medium">{labTest.status}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Ordered By</p>
                    <p className="font-medium">{labTest.orderedByName}</p>
                  </div>
                  {labTest.clinicalIndication && (
                    <div className="col-span-2">
                      <p className="text-sm text-gray-600">Clinical Indication</p>
                      <p className="font-medium">{labTest.clinicalIndication}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-600">Created</p>
                    <p className="font-medium">
                      {new Date(labTest.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Updated</p>
                    <p className="font-medium">
                      {new Date(labTest.updatedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Status Actions */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Status Actions</h3>
                <div className="flex gap-3">
                  {labTest.status === 'PENDING' && (
                    <button
                      onClick={() => handleUpdateStatus('IN_PROGRESS')}
                      className="btn btn-primary"
                    >
                      Start Processing
                    </button>
                  )}
                  {labTest.status === 'IN_PROGRESS' && (
                    <button
                      onClick={() => setActiveTab('results')}
                      className="btn btn-primary"
                    >
                      Enter Results
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Specimen Tab */}
          {activeTab === 'specimen' && (
            <form onSubmit={handleUpdateSpecimen} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Specimen Type
                </label>
                <select
                  value={specimenType}
                  onChange={(e) => setSpecimenType(e.target.value)}
                  className="input w-full"
                >
                  <option value="">Select specimen type</option>
                  <option value="Blood">Blood</option>
                  <option value="Urine">Urine</option>
                  <option value="Stool">Stool</option>
                  <option value="Sputum">Sputum</option>
                  <option value="Swab">Swab</option>
                  <option value="Tissue">Tissue</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Specimen Quality
                </label>
                <select
                  value={specimenQuality}
                  onChange={(e) => setSpecimenQuality(e.target.value)}
                  className="input w-full"
                >
                  <option value="">Select quality</option>
                  <option value="GOOD">Good</option>
                  <option value="ACCEPTABLE">Acceptable</option>
                  <option value="POOR">Poor</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Collection Date/Time
                </label>
                <input
                  type="datetime-local"
                  value={collectedAt}
                  onChange={(e) => setCollectedAt(e.target.value)}
                  className="input w-full"
                />
              </div>

              {specimenQuality === 'REJECTED' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rejection Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={3}
                    className="input w-full"
                    placeholder="Explain why the specimen was rejected..."
                  />
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button type="button" onClick={onClose} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Update Specimen Details
                </button>
              </div>
            </form>
          )}

          {/* Results Tab */}
          {activeTab === 'results' && (
            <form onSubmit={handleSubmitResults} className="space-y-6">
              {/* Abnormal Flags Display */}
              {labTest.abnormalFlags && labTest.abnormalFlags.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <h4 className="font-semibold text-orange-900 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    Abnormal Results Detected
                  </h4>
                  <div className="space-y-2">
                    {labTest.abnormalFlags.map((flag, index) => (
                      <div
                        key={index}
                        className={`p-2 rounded border ${getSeverityColor(flag.severity)}`}
                      >
                        <p className="font-semibold">
                          {flag.parameter}: {flag.value}
                        </p>
                        <p className="text-sm">
                          Reference: {flag.referenceRange} | Severity: {flag.severity}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Result Items */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-lg">Test Parameters</h3>
                  <button
                    type="button"
                    onClick={addResultItem}
                    className="btn btn-secondary text-sm"
                    disabled={labTest.status === 'COMPLETED' || labTest.status === 'REVIEWED'}
                  >
                    + Add Parameter
                  </button>
                </div>

                <div className="space-y-3">
                  {resultItems.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-3">
                        <input
                          type="text"
                          value={item.parameter}
                          onChange={(e) =>
                            updateResultItem(index, 'parameter', e.target.value)
                          }
                          placeholder="Parameter"
                          className="input w-full text-sm"
                          disabled={labTest.status === 'COMPLETED' || labTest.status === 'REVIEWED'}
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="text"
                          value={item.value}
                          onChange={(e) => updateResultItem(index, 'value', e.target.value)}
                          placeholder="Value"
                          className="input w-full text-sm"
                          disabled={labTest.status === 'COMPLETED' || labTest.status === 'REVIEWED'}
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="text"
                          value={item.unit}
                          onChange={(e) => updateResultItem(index, 'unit', e.target.value)}
                          placeholder="Unit"
                          className="input w-full text-sm"
                          disabled={labTest.status === 'COMPLETED' || labTest.status === 'REVIEWED'}
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          value={item.referenceMin || ''}
                          onChange={(e) =>
                            updateResultItem(
                              index,
                              'referenceMin',
                              parseFloat(e.target.value) || undefined
                            )
                          }
                          placeholder="Min"
                          className="input w-full text-sm"
                          step="0.01"
                          disabled={labTest.status === 'COMPLETED' || labTest.status === 'REVIEWED'}
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          value={item.referenceMax || ''}
                          onChange={(e) =>
                            updateResultItem(
                              index,
                              'referenceMax',
                              parseFloat(e.target.value) || undefined
                            )
                          }
                          placeholder="Max"
                          className="input w-full text-sm"
                          step="0.01"
                          disabled={labTest.status === 'COMPLETED' || labTest.status === 'REVIEWED'}
                        />
                      </div>
                      <div className="col-span-1">
                        <button
                          type="button"
                          onClick={() => removeResultItem(index)}
                          className="text-red-600 hover:text-red-800"
                          disabled={labTest.status === 'COMPLETED' || labTest.status === 'REVIEWED'}
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Result Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Result Notes
                </label>
                <textarea
                  value={resultNotes}
                  onChange={(e) => setResultNotes(e.target.value)}
                  rows={3}
                  className="input w-full"
                  placeholder="Additional observations or notes..."
                  disabled={labTest.status === 'COMPLETED' || labTest.status === 'REVIEWED'}
                />
              </div>

              {labTest.status !== 'COMPLETED' && labTest.status !== 'REVIEWED' && (
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={onClose} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Submit Results
                  </button>
                </div>
              )}
            </form>
          )}

          {/* Review Tab */}
          {activeTab === 'review' && (
            <form onSubmit={handleReviewResults} className="space-y-6">
              {/* Results Summary */}
              {labTest.results && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-lg mb-3">Test Results</h3>
                  <div className="space-y-2">
                    {labTest.results.map((result, index) => (
                      <div key={index} className="grid grid-cols-4 gap-4 text-sm">
                        <div className="font-medium">{result.parameter}</div>
                        <div className="font-bold">{result.value} {result.unit}</div>
                        <div className="text-gray-600 col-span-2">
                          Ref: {result.referenceMin || '-'} - {result.referenceMax || '-'} {result.unit}
                        </div>
                      </div>
                    ))}
                  </div>
                  {labTest.resultNotes && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-sm text-gray-600">Notes:</p>
                      <p className="text-sm">{labTest.resultNotes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Review Form */}
              {labTest.status === 'COMPLETED' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Review Notes
                    </label>
                    <textarea
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      rows={4}
                      className="input w-full"
                      placeholder="Doctor's review comments..."
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="approved"
                      checked={approved}
                      onChange={(e) => setApproved(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <label htmlFor="approved" className="font-medium">
                      Approve and finalize these results
                    </label>
                  </div>

                  <div className="flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="btn btn-secondary">
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      <CheckCircle className="w-4 h-4 inline mr-1" />
                      {approved ? 'Approve & Finalize' : 'Save Review'}
                    </button>
                  </div>
                </>
              )}

              {/* Already Reviewed */}
              {labTest.status === 'REVIEWED' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    Results Reviewed and Approved
                  </h4>
                  <div className="text-sm space-y-1">
                    <p>
                      <span className="font-medium">Reviewed By:</span>{' '}
                      {labTest.reviewedByName}
                    </p>
                    <p>
                      <span className="font-medium">Reviewed At:</span>{' '}
                      {labTest.reviewedAt &&
                        new Date(labTest.reviewedAt).toLocaleString()}
                    </p>
                    {labTest.reviewNotes && (
                      <div className="mt-2 pt-2 border-t border-green-200">
                        <p className="font-medium">Review Notes:</p>
                        <p>{labTest.reviewNotes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default LabTestDetailsModal;
