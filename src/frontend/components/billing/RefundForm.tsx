import React, { useState } from 'react';
import billingService from '../../services/billing.service';
import {
  Payment,
  PaymentMethod,
  RequestRefundDto,
} from '../../types/billing.types';
import Dropdown from '../common/Dropdown';

interface RefundFormProps {
  payment: Payment;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const RefundForm: React.FC<RefundFormProps> = ({
  payment,
  onSuccess,
  onCancel,
}) => {
  const [formData, setFormData] = useState<RequestRefundDto>({
    invoiceId: payment.invoiceId,
    paymentId: payment.id,
    amount: payment.amount,
    reason: '',
    refundMethod: payment.paymentMethod,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (formData.amount <= 0) {
      setError('Refund amount must be greater than 0');
      return;
    }

    if (formData.amount > payment.amount) {
      setError('Refund amount cannot exceed payment amount');
      return;
    }

    if (!formData.reason.trim()) {
      setError('Please provide a reason for the refund');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await billingService.requestRefund(formData);
      onSuccess?.();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to request refund');
      console.error('Error requesting refund:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-6">Request Refund</h3>

      {/* Payment Information */}
      <div className="mb-6 p-4 bg-gray-50 rounded-md">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Payment Details</h4>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-600">Payment Date:</span>
            <div className="font-medium">{formatDate(payment.paymentDate)}</div>
          </div>
          <div>
            <span className="text-gray-600">Payment Method:</span>
            <div className="font-medium">
              {payment.paymentMethod.replace('_', ' ')}
            </div>
          </div>
          <div>
            <span className="text-gray-600">Reference Number:</span>
            <div className="font-medium">{payment.referenceNumber || '-'}</div>
          </div>
          <div>
            <span className="text-gray-600">Amount Paid:</span>
            <div className="font-medium text-green-600">
              {formatCurrency(payment.amount)}
            </div>
          </div>
          {payment.invoice && (
            <>
              <div>
                <span className="text-gray-600">Invoice:</span>
                <div className="font-medium">{payment.invoice.invoiceNumber}</div>
              </div>
              <div>
                <span className="text-gray-600">Patient:</span>
                <div className="font-medium">
                  {payment.invoice.patient?.firstName}{' '}
                  {payment.invoice.patient?.lastName}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Refund Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Refund Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Refund Amount *
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2 text-gray-500">₦</span>
            <input
              type="number"
              value={formData.amount}
              onChange={(e) =>
                setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })
              }
              min="0"
              max={payment.amount}
              step="0.01"
              required
              className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Maximum refundable amount: {formatCurrency(payment.amount)}
          </p>
        </div>

        {/* Refund Method */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Refund Method *
          </label>
          <Dropdown
            value={formData.refundMethod}
            onChange={(e) =>
              setFormData({ ...formData, refundMethod: e.target.value as PaymentMethod })
            }
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={payment.paymentMethod}>
              Original Payment Method ({payment.paymentMethod.replace('_', ' ')})
            </option>
            {payment.paymentMethod !== PaymentMethod.CASH && (
              <option value={PaymentMethod.CASH}>Cash</option>
            )}
            {payment.paymentMethod !== PaymentMethod.BANK_TRANSFER && (
              <option value={PaymentMethod.BANK_TRANSFER}>Bank Transfer</option>
            )}
          </Dropdown>
        </div>

        {/* Bank Details (if Bank Transfer selected) */}
        {formData.refundMethod === PaymentMethod.BANK_TRANSFER && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800 mb-2">
              Bank transfer refund selected. Please collect patient's bank details:
            </p>
            <ul className="text-sm text-blue-700 list-disc list-inside space-y-1">
              <li>Account Name</li>
              <li>Account Number</li>
              <li>Bank Name</li>
            </ul>
          </div>
        )}

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reason for Refund *
          </label>
          <textarea
            value={formData.reason}
            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            placeholder="Please provide a detailed reason for requesting this refund..."
            rows={4}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Explain why this refund is necessary (e.g., overpayment, duplicate payment,
            service not rendered, patient request, etc.)
          </p>
        </div>

        {/* Important Notice */}
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="flex">
            <svg
              className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div className="text-sm text-yellow-800">
              <p className="font-medium mb-1">Important:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>This refund request requires approval before processing</li>
                <li>You will be notified once the request is reviewed</li>
                <li>Processing time may vary depending on the refund method</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
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
            className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Submitting...
              </>
            ) : (
              'Submit Refund Request'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default RefundForm;
