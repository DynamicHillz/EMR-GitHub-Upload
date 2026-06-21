/**
 * Prescription Modal Component
 *
 * UI for creating prescriptions with allergy checking
 * REQ-CLIN-3: E-prescribing
 * REQ-CLIN-7: Allergy checking
 */

import React, { useState } from 'react';
import { X, AlertTriangle, Pill } from 'lucide-react';
import ConfirmDialog from '../common/ConfirmDialog';
import { useConfirm } from '../../hooks/useConfirm';
import { useToast } from '../ToastContainer';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  allergies: string[];
}

interface PrescriptionModalProps {
  consultationId: string;
  patient: Patient;
  onClose: () => void;
  onSuccess: () => void;
}

interface PrescriptionFormData {
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  quantity: number;
}

const PrescriptionModal: React.FC<PrescriptionModalProps> = ({
  consultationId,
  patient,
  onClose,
  onSuccess,
}) => {
  const toast = useToast();
  const { confirm, isOpen, options, loading: confirmLoading, handleConfirm, handleCancel } = useConfirm();

  const [formData, setFormData] = useState<PrescriptionFormData>({
    medicationName: '',
    dosage: '',
    frequency: '',
    duration: '',
    instructions: '',
    quantity: 0,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allergyWarning, setAllergyWarning] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'quantity' ? parseInt(value) || 0 : value,
    }));

    // Check for allergies when medication name changes
    if (name === 'medicationName' && value && patient.allergies.length > 0) {
      const medLower = value.toLowerCase();
      const matchingAllergies = patient.allergies.filter((allergy) => {
        const allergyLower = allergy.toLowerCase();
        return medLower.includes(allergyLower) || allergyLower.includes(medLower);
      });

      if (matchingAllergies.length > 0) {
        setAllergyWarning(
          `WARNING: Patient is allergic to ${matchingAllergies.join(', ')}`
        );
      } else {
        setAllergyWarning(null);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.medicationName || !formData.dosage || !formData.frequency) {
      toast.error('Validation Error', 'Please fill in all required fields');
      return;
    }

    // Confirm if there's an allergy warning
    if (allergyWarning) {
      const confirmed = await confirm({
        title: 'Allergy Warning',
        message: `${allergyWarning}\n\nAre you sure you want to prescribe this medication?`,
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
      const response = await fetch(
        `http://localhost:3000/api/consultations/${consultationId}/prescriptions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            patientId: patient.id,
            medicationName: formData.medicationName,
            dosage: formData.dosage,
            frequency: formData.frequency,
            duration: formData.duration,
            instructions: formData.instructions,
            quantity: formData.quantity,
          }),
        }
      );

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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Pill className="w-6 h-6 text-blue-600" />
              New Prescription
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

        {/* Patient Allergies Warning */}
        {patient.allergies.length > 0 && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
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
        <form onSubmit={handleSubmit} className="p-6">
          {/* Real-time Allergy Warning */}
          {allergyWarning && (
            <div className="mb-6 p-4 bg-red-100 border-2 border-red-500 rounded-lg animate-pulse">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-6 h-6 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-bold text-red-900 text-lg">ALLERGY ALERT</h4>
                  <p className="text-red-800 mt-1">{allergyWarning}</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {/* Medication Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Medication Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="medicationName"
                value={formData.medicationName}
                onChange={handleChange}
                required
                className="input w-full"
                placeholder="e.g., Amoxicillin"
              />
            </div>

            {/* Dosage and Frequency */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dosage <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="dosage"
                  value={formData.dosage}
                  onChange={handleChange}
                  required
                  className="input w-full"
                  placeholder="e.g., 500mg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Frequency <span className="text-red-500">*</span>
                </label>
                <select
                  name="frequency"
                  value={formData.frequency}
                  onChange={handleChange}
                  required
                  className="input w-full"
                >
                  <option value="">Select frequency</option>
                  <option value="Once daily">Once daily</option>
                  <option value="Twice daily">Twice daily</option>
                  <option value="Three times daily">Three times daily</option>
                  <option value="Four times daily">Four times daily</option>
                  <option value="Every 4 hours">Every 4 hours</option>
                  <option value="Every 6 hours">Every 6 hours</option>
                  <option value="Every 8 hours">Every 8 hours</option>
                  <option value="Every 12 hours">Every 12 hours</option>
                  <option value="As needed">As needed (PRN)</option>
                </select>
              </div>
            </div>

            {/* Duration and Quantity */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration
                </label>
                <input
                  type="text"
                  name="duration"
                  value={formData.duration}
                  onChange={handleChange}
                  className="input w-full"
                  placeholder="e.g., 7 days, 2 weeks"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  name="quantity"
                  value={formData.quantity || ''}
                  onChange={handleChange}
                  min="0"
                  className="input w-full"
                  placeholder="e.g., 30"
                />
              </div>
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
                placeholder="e.g., Take with food, Avoid alcohol"
              />
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
              {isSubmitting ? 'Creating...' : 'Create Prescription'}
            </button>
          </div>
        </form>
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
