/**
 * Payment Form Component
 * Record manual and gateway payments for invoices
 */

import React, { useState, useEffect } from 'react';
import {
  RecordPaymentDto,
  InitiateGatewayPaymentDto,
  PaymentMethod,
  PaymentGateway,
  Invoice,
} from '../../types/billing.types';
import billingService from '../../services/billing.service';
import Dropdown from '../common/Dropdown';

interface PaymentFormProps {
  invoice: Invoice;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const PaymentForm: React.FC<PaymentFormProps> = ({ invoice, onSuccess, onCancel }) => {
  const [paymentType, setPaymentType] = useState<'manual' | 'gateway'>('manual');
  const [manualData, setManualData] = useState<RecordPaymentDto>({
    invoiceId: invoice.id,
    amount: invoice.balance,
    paymentMethod: PaymentMethod.CASH,
  });
  const [gatewayData, setGatewayData] = useState<InitiateGatewayPaymentDto>({
    invoiceId: invoice.id,
    amount: invoice.balance,
    gateway: PaymentGateway.FLUTTERWAVE,
    customerEmail: invoice.patient?.email || '',
    customerName: `${invoice.patient?.firstName} ${invoice.patient?.lastName}`,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approverName, setApproverName] = useState('');
  // Real system-generated receipts now exist, so this requirement is
  // tenant-configurable rather than always mandatory for cash — defaults
  // to true (current behavior) until the setting loads.
  const [requireReceiptPhotoForCash, setRequireReceiptPhotoForCash] = useState(true);
  // Approval thresholds are tenant-configurable — these defaults match the
  // schema defaults and only apply until the real settings load.
  const [approvalThresholds, setApprovalThresholds] = useState({
    cash: 50000,
    bankTransfer: 100000,
    mobileMoney: 75000,
  });

  useEffect(() => {
    billingService
      .getFraudPreventionSettings()
      .then((settings) => {
        setRequireReceiptPhotoForCash(settings.requireReceiptPhotoForCash);
        setApprovalThresholds({
          cash: settings.cashApprovalThreshold,
          bankTransfer: settings.bankTransferApprovalThreshold,
          mobileMoney: settings.mobileMoneyApprovalThreshold,
        });
      })
      .catch(() => {
        // Keep the safe defaults if the setting can't be fetched
      });
  }, []);

  const approvalThresholdForMethod = (method: PaymentMethod): number | null => {
    if (method === 'CASH') return approvalThresholds.cash;
    if (method === 'BANK_TRANSFER') return approvalThresholds.bankTransfer;
    if (method === 'MOBILE_MONEY') return approvalThresholds.mobileMoney;
    return null;
  };

  const threshold = approvalThresholdForMethod(manualData.paymentMethod);
  const requiresApproval = threshold !== null && manualData.amount >= threshold;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amount);
  };

  const handleManualPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (manualData.amount <= 0) {
      setError('Payment amount must be greater than zero.');
      return;
    }
    if (manualData.amount > invoice.balance) {
      setError(`Payment amount cannot exceed the outstanding balance (${formatCurrency(invoice.balance)}).`);
      return;
    }
    if (requiresApproval && !approverName.trim()) {
      setError('This payment exceeds the approval threshold — enter the approving supervisor\'s name before recording it.');
      return;
    }

    setIsSubmitting(true);

    try {
      await billingService.recordPayment({
        ...manualData,
        approverName: requiresApproval ? approverName.trim() : undefined,
      });
      onSuccess?.();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGatewayPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await billingService.initiateGatewayPayment(gatewayData);
      // Redirect to payment gateway
      window.location.href = result.paymentUrl;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to initiate payment');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Record Payment</h2>

      {/* Invoice Info */}
      <div className="bg-blue-50 p-4 rounded-md mb-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Invoice:</span>
            <span className="ml-2 font-medium">{invoice.invoiceNumber}</span>
          </div>
          <div>
            <span className="text-gray-600">Patient:</span>
            <span className="ml-2 font-medium">
              {invoice.patient?.firstName} {invoice.patient?.lastName}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Total Amount:</span>
            <span className="ml-2 font-medium">{formatCurrency(invoice.totalAmount)}</span>
          </div>
          <div>
            <span className="text-gray-600">Balance Due:</span>
            <span className="ml-2 font-medium text-red-600">
              {formatCurrency(invoice.balance)}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
          {error}
        </div>
      )}

      {/* Payment Type Selection */}
      <div className="flex space-x-4 mb-6">
        <button
          type="button"
          onClick={() => setPaymentType('manual')}
          className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
            paymentType === 'manual'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Manual Payment
        </button>
        <button
          type="button"
          onClick={() => setPaymentType('gateway')}
          className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
            paymentType === 'gateway'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Online Payment
        </button>
      </div>

      {/* Manual Payment Form */}
      {paymentType === 'manual' && (
        <form onSubmit={handleManualPayment} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount *
              </label>
              <input
                type="number"
                value={manualData.amount}
                onChange={(e) =>
                  setManualData({ ...manualData, amount: parseFloat(e.target.value) || 0 })
                }
                required
                min="0.01"
                max={invoice.balance}
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Method *
              </label>
              <Dropdown
                value={manualData.paymentMethod}
                onChange={(e) =>
                  setManualData({
                    ...manualData,
                    paymentMethod: e.target.value as PaymentMethod,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
                <option value="INSURANCE">Insurance</option>
              </Dropdown>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reference Number {(manualData.paymentMethod === 'BANK_TRANSFER' ||
                                 manualData.paymentMethod === 'MOBILE_MONEY') &&
                  <span className="text-red-600">*</span>}
              </label>
              <input
                type="text"
                value={manualData.referenceNumber || ''}
                onChange={(e) =>
                  setManualData({ ...manualData, referenceNumber: e.target.value })
                }
                required={manualData.paymentMethod === 'BANK_TRANSFER' ||
                         manualData.paymentMethod === 'MOBILE_MONEY'}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder={
                  manualData.paymentMethod === 'BANK_TRANSFER'
                    ? 'Bank transaction reference'
                    : manualData.paymentMethod === 'MOBILE_MONEY'
                    ? 'Mobile money transaction ID'
                    : 'Optional'
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Transaction ID
              </label>
              <input
                type="text"
                value={manualData.transactionId || ''}
                onChange={(e) =>
                  setManualData({ ...manualData, transactionId: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Optional"
              />
            </div>
          </div>

          {/* Fraud Prevention Fields */}
          <div className="border-t pt-4 mt-4">
            <h3 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Proof of Payment
            </h3>

            {manualData.paymentMethod === 'CASH' && requireReceiptPhotoForCash && (
              <div className="bg-yellow-50 border border-yellow-300 rounded-md p-3 mb-4">
                <p className="text-sm text-yellow-800">
                  <strong>⚠️ Required:</strong> Cash payments require a receipt photo for verification
                </p>
              </div>
            )}
            {manualData.paymentMethod === 'CASH' && !requireReceiptPhotoForCash && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                <p className="text-sm text-blue-800">
                  A system-generated receipt will be available after recording this payment — a photo is optional.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Receipt Photo URL {manualData.paymentMethod === 'CASH' && requireReceiptPhotoForCash && <span className="text-red-600">*</span>}
                </label>
                <input
                  type="url"
                  value={manualData.receiptPhotoUrl || ''}
                  onChange={(e) =>
                    setManualData({ ...manualData, receiptPhotoUrl: e.target.value })
                  }
                  required={manualData.paymentMethod === 'CASH' && requireReceiptPhotoForCash}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://storage.example.com/receipt.jpg"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Upload receipt photo and paste URL here
                  {manualData.paymentMethod === 'CASH' && requireReceiptPhotoForCash && ' (mandatory for cash)'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Additional Proof Document URL
                </label>
                <input
                  type="url"
                  value={manualData.proofDocumentUrl || ''}
                  onChange={(e) =>
                    setManualData({ ...manualData, proofDocumentUrl: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://storage.example.com/proof.pdf"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Bank slip, mobile money confirmation, etc. (optional)
                </p>
              </div>
            </div>
          </div>

          {/* Fraud Prevention Warning — real gate, not just a label: the name
              typed below is required before this form will submit, and the
              backend enforces the same rule independently. */}
          {requiresApproval && (
            <div className="bg-orange-50 border border-orange-300 rounded-md p-3">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-orange-600 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-orange-800">
                    Supervisor Approval Required
                  </p>
                  <p className="text-xs text-orange-700 mt-1">
                    This payment is at or above the {formatCurrency(threshold || 0)} threshold for {manualData.paymentMethod.replace('_', ' ').toLowerCase()}. Name the approving supervisor to continue.
                  </p>
                  <label className="block text-sm font-medium text-orange-900 mt-3 mb-1">
                    Approved By *
                  </label>
                  <input
                    type="text"
                    value={approverName}
                    onChange={(e) => setApproverName(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-orange-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Supervisor's name"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Processing...' : 'Record Payment'}
            </button>
          </div>
        </form>
      )}

      {/* Gateway Payment Form */}
      {paymentType === 'gateway' && (
        <form onSubmit={handleGatewayPayment} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount *
              </label>
              <input
                type="number"
                value={gatewayData.amount}
                onChange={(e) =>
                  setGatewayData({ ...gatewayData, amount: parseFloat(e.target.value) || 0 })
                }
                required
                min="0.01"
                max={invoice.balance}
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Gateway *
              </label>
              <Dropdown
                value={gatewayData.gateway}
                onChange={(e) =>
                  setGatewayData({
                    ...gatewayData,
                    gateway: e.target.value as PaymentGateway,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="FLUTTERWAVE">Flutterwave</option>
                <option value="PAYSTACK">Paystack</option>
                <option value="MONIEPOINT">Moniepoint</option>
              </Dropdown>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer Email *
              </label>
              <input
                type="email"
                value={gatewayData.customerEmail || ''}
                onChange={(e) =>
                  setGatewayData({ ...gatewayData, customerEmail: e.target.value })
                }
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer Name *
              </label>
              <input
                type="text"
                value={gatewayData.customerName || ''}
                onChange={(e) =>
                  setGatewayData({ ...gatewayData, customerName: e.target.value })
                }
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-md">
            <p className="text-sm text-yellow-800">
              You will be redirected to the payment gateway to complete the payment securely.
            </p>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Redirecting...' : 'Proceed to Payment'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default PaymentForm;
