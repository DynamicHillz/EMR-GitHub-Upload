/**
 * Dispense Medication Modal
 *
 * Modal for dispensing medication with batch selection and allergy warnings
 * REQ-PHARM-2: Record dispensing with batch number, quantity, and expiration date
 * REQ-PHARM-3: Automatically deduct from inventory
 * REQ-PHARM-7: Prevent dispensing if medication matches patient allergy
 */

import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Pill, Package, Calendar, AlertCircle } from 'lucide-react';
import { matchesDrugClassGroup } from '../../utils/drugClassGroups';

interface MedicationBatch {
  id: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  medicationName: string;
}

interface Prescription {
  id: string;
  patientId: string;
  patientName: string;
  patientAge: number;
  patientGender: string;
  patientDob: string;
  allergies: string[];
  medicationName: string;
  dosage: string;
  frequency: string;
  quantity: number | null;
  allergyWarning: boolean;
  interactionWarning: boolean;
}

function isBatchExpired(expiryDate: string): boolean {
  return new Date(expiryDate).getTime() < Date.now();
}

interface DispenseModalProps {
  prescription: Prescription;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const DispenseModal: React.FC<DispenseModalProps> = ({
  prescription,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [batches, setBatches] = useState<MedicationBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [quantityToDispense, setQuantityToDispense] = useState<number>(
    prescription.quantity || 1
  );
  const [pharmacistNotes, setPharmacistNotes] = useState('');
  const [drugInteractions, setDrugInteractions] = useState<any>(null);
  const [showInteractionWarning, setShowInteractionWarning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const matchingAllergies = (prescription.allergies || []).filter((allergy) => {
    const allergyLower = allergy.toLowerCase();
    const medLower = prescription.medicationName.toLowerCase();
    return (
      medLower.includes(allergyLower) ||
      allergyLower.includes(medLower) ||
      matchesDrugClassGroup(allergy, prescription.medicationName)
    );
  });

  const selectedBatch = batches.find((b) => b.id === selectedBatchId);
  const selectedBatchExpired = !!selectedBatch && isBatchExpired(selectedBatch.expiryDate);

  useEffect(() => {
    if (isOpen) {
      fetchAvailableBatches();
      checkDrugInteractions();
    }
  }, [isOpen, prescription.medicationName]);

  const checkDrugInteractions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${window.location.protocol}//${window.location.hostname}:3000/api/pharmacy/interactions/check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          patientId: prescription.patientId,
          medicationName: prescription.medicationName,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.data.hasInteractions) {
          setDrugInteractions(result.data);
          setShowInteractionWarning(true);
        }
      }
    } catch (err) {
      console.error('Error checking drug interactions:', err);
    }
  };

  const fetchAvailableBatches = async () => {
    setIsLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${window.location.protocol}//${window.location.hostname}:3000/api/pharmacy/batches?medicationName=${encodeURIComponent(
          prescription.medicationName
        )}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        setBatches(result.data || []);

        // Auto-select first non-expired batch with sufficient quantity
        // (batches already come back FEFO-ordered from the API, so this is
        // still the earliest-expiring valid batch, just never an expired one)
        const availableBatch = result.data.find(
          (b: MedicationBatch) => b.quantity >= quantityToDispense && !isBatchExpired(b.expiryDate)
        );
        if (availableBatch) {
          setSelectedBatchId(availableBatch.id);
        }
      } else {
        setError('Failed to load available batches');
      }
    } catch (err) {
      console.error('Error fetching batches:', err);
      setError('Error loading medication batches');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDispense = async () => {
    if (!selectedBatchId) {
      setError('Please select a medication batch');
      return;
    }

    if (quantityToDispense <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }

    const chosenBatch = batches.find((b) => b.id === selectedBatchId);
    if (chosenBatch && quantityToDispense > chosenBatch.quantity) {
      setError(`Insufficient stock. Available: ${chosenBatch.quantity}`);
      return;
    }
    if (chosenBatch && isBatchExpired(chosenBatch.expiryDate)) {
      setError('This batch has expired and cannot be dispensed. Please select a different batch.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${window.location.protocol}//${window.location.hostname}:3000/api/pharmacy/dispense`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          prescriptionId: prescription.id,
          batchId: selectedBatchId,
          quantityDispensed: quantityToDispense,
          pharmacistNotes: pharmacistNotes || undefined,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        onSuccess();
        onClose();
      } else {
        // Handle specific error responses
        if (response.status === 403) {
          setError(result.message || 'Allergy warning: Dispensing blocked');
        } else {
          setError(result.message || 'Failed to dispense medication');
        }
      }
    } catch (err) {
      console.error('Error dispensing medication:', err);
      setError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatExpiryDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const daysUntilExpiry = Math.floor(
      (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    const formatted = date.toLocaleDateString();

    if (daysUntilExpiry < 0) {
      return <span className="text-red-600 font-semibold">Expired ({formatted})</span>;
    } else if (daysUntilExpiry < 30) {
      return (
        <span className="text-orange-600 font-semibold">
          {formatted} ({daysUntilExpiry}d left)
        </span>
      );
    } else {
      return formatted;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center z-10">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Pill className="w-6 h-6 text-purple-600" />
              Dispense Medication
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {prescription.patientName} - {prescription.patientAge}y /{' '}
              {prescription.patientGender}
              {prescription.patientDob && (
                <> · DOB {new Date(prescription.patientDob).toLocaleDateString()}</>
              )}
            </p>
            <p className="text-xs text-gray-400 font-mono mt-0.5">Patient ID: {prescription.patientId}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Warnings */}
        {(prescription.allergyWarning || prescription.interactionWarning || showInteractionWarning) && (
          <div className="px-6 py-4 space-y-3">
            {prescription.allergyWarning && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-900">Allergy Warning</p>
                  <p className="text-sm text-red-700">
                    {matchingAllergies.length > 0
                      ? `Patient is allergic to ${matchingAllergies.join(', ')}. Dispensing may be blocked.`
                      : 'Patient has a documented allergy to this medication or its components. Dispensing may be blocked.'}
                  </p>
                  {prescription.allergies.length > 0 && (
                    <p className="text-xs text-red-600 mt-1">
                      All documented allergies: {prescription.allergies.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            )}

            {prescription.interactionWarning && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-orange-900">Drug Interaction Warning</p>
                  <p className="text-sm text-orange-700">
                    Potential drug interaction detected. Please review carefully.
                  </p>
                </div>
              </div>
            )}

            {showInteractionWarning && drugInteractions && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-3 mb-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-yellow-900">
                      {drugInteractions.interactions.length} Drug Interaction(s) Detected (REQ-PHARM-6)
                    </p>
                  </div>
                </div>
                <div className="space-y-2 ml-8">
                  {drugInteractions.interactions.map((interaction: any, idx: number) => (
                    <div key={idx} className="text-sm">
                      <p className="font-medium text-yellow-900">
                        {interaction.drug1} + {interaction.drug2} (
                        <span className={
                          interaction.severity === 'SEVERE' || interaction.severity === 'MAJOR'
                            ? 'text-red-600'
                            : 'text-orange-600'
                        }>
                          {interaction.severity}
                        </span>)
                      </p>
                      <p className="text-yellow-700">{interaction.description}</p>
                      {interaction.management && (
                        <p className="text-yellow-600 mt-1">
                          <strong>Management:</strong> {interaction.management}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Prescription Details */}
        <div className="px-6 py-4 bg-gray-50 border-y border-gray-200">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Medication</p>
              <p className="font-semibold">{prescription.medicationName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Dosage & Frequency</p>
              <p className="font-semibold">
                {prescription.dosage} - {prescription.frequency}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Prescribed Quantity</p>
              <p className="font-semibold">{prescription.quantity || 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="px-6 py-4 space-y-4">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Batch Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Package className="w-4 h-4 inline mr-1" />
              Select Batch
            </label>
            {isLoading ? (
              <div className="text-center py-4">
                <p className="text-gray-500">Loading available batches...</p>
              </div>
            ) : batches.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  No batches available for {prescription.medicationName}. Please add stock
                  first.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {batches.map((batch) => {
                  const expired = isBatchExpired(batch.expiryDate);
                  return (
                    <label
                      key={batch.id}
                      className={`block p-4 border rounded-lg transition-colors ${
                        expired
                          ? 'cursor-not-allowed opacity-60 border-red-200 bg-red-50'
                          : 'cursor-pointer ' + (selectedBatchId === batch.id
                              ? 'border-purple-500 bg-purple-50'
                              : 'border-gray-300 hover:border-purple-300')
                      }`}
                    >
                      <div className="flex items-center">
                        <input
                          type="radio"
                          name="batch"
                          value={batch.id}
                          checked={selectedBatchId === batch.id}
                          onChange={() => !expired && setSelectedBatchId(batch.id)}
                          disabled={expired}
                          className="mr-3"
                        />
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">Batch: {batch.batchNumber}</p>
                              <p className="text-sm text-gray-600">
                                Available: {batch.quantity} units
                              </p>
                              {expired && (
                                <p className="text-xs text-red-700 font-medium mt-1">
                                  Expired — cannot be dispensed
                                </p>
                              )}
                            </div>
                            <div className="text-right text-sm">
                              <p className="text-gray-500 flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                Expiry:
                              </p>
                              <p>{formatExpiryDate(batch.expiryDate)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quantity to Dispense */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quantity to Dispense
            </label>
            <input
              type="number"
              min="1"
              value={quantityToDispense}
              onChange={(e) => setQuantityToDispense(parseInt(e.target.value) || 0)}
              className="input w-full"
            />
          </div>

          {/* Pharmacist Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pharmacist Notes (Optional)
            </label>
            <textarea
              value={pharmacistNotes}
              onChange={(e) => setPharmacistNotes(e.target.value)}
              rows={3}
              placeholder="Add any special instructions or notes..."
              className="input w-full"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="btn btn-secondary" disabled={isSubmitting}>
            Cancel
          </button>
          <button
            onClick={handleDispense}
            disabled={isSubmitting || batches.length === 0 || !selectedBatchId || selectedBatchExpired}
            className="btn btn-primary"
          >
            {isSubmitting ? 'Dispensing...' : 'Dispense Medication'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DispenseModal;
