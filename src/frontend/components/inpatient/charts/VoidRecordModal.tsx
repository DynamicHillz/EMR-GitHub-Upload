import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface VoidRecordModalProps {
  title: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
}

// Small reason-collecting confirm step for voiding a submitted chart entry —
// ConfirmDialog doesn't take free text, and every void endpoint requires a
// deletionReason, so this is the one place that reason gets typed in.
const VoidRecordModal: React.FC<VoidRecordModalProps> = ({ title, onClose, onConfirm }) => {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    if (!reason.trim()) {
      setError('A reason is required to void this record.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onConfirm(reason.trim());
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to void record.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={loading ? undefined : onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md rounded-lg bg-white shadow-xl">
          <button onClick={onClose} disabled={loading} className="absolute right-4 top-4 text-gray-400 hover:text-gray-500 disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
          <div className="p-6">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div className="mt-3 text-center">
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              <p className="mt-1 text-sm text-gray-500">
                This entry will be marked void and hidden from the active record. It stays on file for audit purposes.
              </p>
            </div>
            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-700 mb-1">Reason for voiding</label>
              <textarea
                autoFocus
                rows={3}
                className="input w-full"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Entered against wrong patient / duplicate entry / transcription error"
              />
              {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={loading}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Voiding...' : 'Void Entry'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoidRecordModal;
