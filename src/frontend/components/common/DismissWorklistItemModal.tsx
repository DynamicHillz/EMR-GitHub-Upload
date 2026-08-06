import React, { useState } from 'react';
import { X } from 'lucide-react';
import Dropdown from './Dropdown';

interface DismissWorklistItemModalProps {
  title: string;
  onClose: () => void;
  onDismiss: (reason: string, reasonNotes: string) => Promise<void>;
}

// Shared by ImmunizationDuePage.tsx and PostnatalDuePage.tsx — resolves a
// false-positive "due" item (dose/contact happened elsewhere, patient
// declined/transferred/deceased) without fabricating a record that never
// happened. See WorklistDismissal in schema.prisma.
const DismissWorklistItemModal: React.FC<DismissWorklistItemModalProps> = ({ title, onClose, onDismiss }) => {
  const [reason, setReason] = useState('GIVEN_ELSEWHERE');
  const [reasonNotes, setReasonNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onDismiss(reason, reasonNotes);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Dismiss: {title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
            <Dropdown required className="input w-full" value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="GIVEN_ELSEWHERE">Already given/completed elsewhere</option>
              <option value="DECLINED">Patient/family declined</option>
              <option value="TRANSFERRED_OUT">Transferred to another facility</option>
              <option value="DECEASED">Patient deceased</option>
              <option value="OTHER">Other</option>
            </Dropdown>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea rows={2} className="input w-full" value={reasonNotes} onChange={(e) => setReasonNotes(e.target.value)} />
          </div>
          <div className="pt-2 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-gray-700 rounded-md hover:bg-gray-800" disabled={loading}>
              {loading ? 'Dismissing...' : 'Dismiss'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DismissWorklistItemModal;
