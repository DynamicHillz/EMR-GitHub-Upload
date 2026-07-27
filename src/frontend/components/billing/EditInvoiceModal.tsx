import React, { useState } from 'react';
import billingService from '../../services/billing.service';
import { Invoice } from '../../types/billing.types';

interface EditInvoiceModalProps {
  invoice: Invoice;
  onSuccess: (result: { invoice: Invoice | null; queued: boolean }) => void;
  onCancel: () => void;
}

// Only these fields are editable — dueDate/discount/notes — matching exactly
// what update-invoice.use-case.ts accepts. Everything else on an invoice
// (line items, totals derived from them, patient) is generated, not
// hand-edited, once the invoice exists.
const EditInvoiceModal: React.FC<EditInvoiceModalProps> = ({ invoice, onSuccess, onCancel }) => {
  const [dueDate, setDueDate] = useState(invoice.dueDate ? invoice.dueDate.slice(0, 10) : '');
  const [discount, setDiscount] = useState(invoice.discount || 0);
  const [notes, setNotes] = useState(invoice.notes || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalBeforeDiscount = invoice.subtotal + invoice.tax;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (discount < 0) {
      setError('Discount cannot be negative');
      return;
    }
    if (discount > totalBeforeDiscount) {
      setError('Discount cannot exceed the invoice subtotal + tax');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await billingService.updateInvoice(invoice.id, {
        dueDate: dueDate || undefined,
        discount,
        notes: notes || undefined,
        version: invoice.version,
      });
      onSuccess(result);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to update invoice');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-6">Edit Invoice {invoice.invoiceNumber}</h3>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Discount</label>
          <div className="relative">
            <span className="absolute left-3 top-2 text-gray-500">₦</span>
            <input
              type="number"
              value={discount}
              onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
              min="0"
              max={totalBeforeDiscount}
              step="0.01"
              className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Maximum discount (subtotal + tax): {formatCurrency(totalBeforeDiscount)}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-6 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditInvoiceModal;
