import React, { useState } from 'react';
import { X } from 'lucide-react';
import InpatientService from '../../services/InpatientService';
import { useToast } from '../ToastContainer';
import { Admission } from '../../types/inpatient';

interface AdmissionTabSettingsModalProps {
  admission: Admission;
  onClose: () => void;
  onSuccess: () => void;
}

const AdmissionTabSettingsModal: React.FC<AdmissionTabSettingsModalProps> = ({
  admission,
  onClose,
  onSuccess
}) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [showOperationNote, setShowOperationNote] = useState(admission.showOperationNote);
  const [showPartograph, setShowPartograph] = useState(admission.showPartograph);
  const [showOxygen, setShowOxygen] = useState(admission.showOxygen);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await InpatientService.updateAdmissionSettings(admission.id, { showOperationNote, showPartograph, showOxygen });
      toast.success('Tab settings updated');
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to update tab settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Tab Settings</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Turn on extra tabs and actions for this admission — e.g. if surgery becomes necessary partway through a Medical admission, or oxygen is needed.
            This admission's type is <span className="font-medium">{admission.admissionType}</span>.
          </p>

          <div className="space-y-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                checked={showOperationNote}
                onChange={e => setShowOperationNote(e.target.checked)}
              />
              <span className="ml-2 text-sm text-gray-900">Show Operation Note tab</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                checked={showPartograph}
                onChange={e => setShowPartograph(e.target.checked)}
              />
              <span className="ml-2 text-sm text-gray-900">Show Partograph tab</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                checked={showOxygen}
                onChange={e => setShowOxygen(e.target.checked)}
              />
              <span className="ml-2 text-sm text-gray-900">Show "Record Oxygen" action</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdmissionTabSettingsModal;
