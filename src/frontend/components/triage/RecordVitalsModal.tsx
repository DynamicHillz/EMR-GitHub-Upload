import React, { useState } from 'react';
import { X, Activity } from 'lucide-react';
import outpatientVitalService from '../../services/outpatient-vital.service';
import { getErrorMessage } from '../../utils/errorHandler';

interface RecordVitalsModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
  appointmentId?: string;
  onSuccess: () => void;
}

const RecordVitalsModal: React.FC<RecordVitalsModalProps> = ({
  isOpen,
  onClose,
  patientId,
  patientName,
  appointmentId,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    systolicBP: '',
    diastolicBP: '',
    heartRate: '',
    respiratoryRate: '',
    temperature: '',
    weight: '',
    height: '',
    spO2: '',
    notes: ''
  });

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await outpatientVitalService.recordVitals({
        patientId,
        appointmentId,
        ...formData,
        // Send combined string for backward compatibility until backend service is fully migrated
        bloodPressure: formData.systolicBP && formData.diastolicBP ? `${formData.systolicBP}/${formData.diastolicBP}` : undefined
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to record vitals'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden my-8">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50 sticky top-0 z-10">
          <div className="flex items-center">
            <Activity className="w-5 h-5 text-primary-600 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Record Vitals for {patientName}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Systolic BP (mmHg)</label>
                <input
                  type="number"
                  name="systolicBP"
                  placeholder="e.g. 120"
                  value={formData.systolicBP}
                  onChange={handleChange}
                  min="60"
                  max="300"
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Diastolic BP (mmHg)</label>
                <input
                  type="number"
                  name="diastolicBP"
                  placeholder="e.g. 80"
                  value={formData.diastolicBP}
                  onChange={handleChange}
                  min="30"
                  max="200"
                  className="input"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pulse Rate (bpm)</label>
                <input
                  type="number"
                  name="heartRate"
                  placeholder="e.g. 72"
                  value={formData.heartRate}
                  onChange={handleChange}
                  className="input"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Respiratory Rate (bpm)</label>
                <input
                  type="number"
                  name="respiratoryRate"
                  placeholder="e.g. 16"
                  value={formData.respiratoryRate}
                  onChange={handleChange}
                  className="input"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Temperature (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  name="temperature"
                  placeholder="e.g. 37.2"
                  value={formData.temperature}
                  onChange={handleChange}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  name="weight"
                  placeholder="e.g. 70.5"
                  value={formData.weight}
                  onChange={handleChange}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Height (cm)</label>
                <input
                  type="number"
                  step="0.1"
                  name="height"
                  placeholder="e.g. 175"
                  value={formData.height}
                  onChange={handleChange}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SpO2 (%)</label>
                <input
                  type="number"
                  name="spO2"
                  placeholder="e.g. 98"
                  value={formData.spO2}
                  onChange={handleChange}
                  className="input"
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Clinical Notes (Optional)</label>
              <textarea
                name="notes"
                rows={3}
                value={formData.notes}
                onChange={handleChange}
                className="input"
                placeholder="Any triage observations..."
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save Vitals'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RecordVitalsModal;
