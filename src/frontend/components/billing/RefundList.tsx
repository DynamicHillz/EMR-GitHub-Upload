import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import billingService from '../../services/billing.service';
import {
  Refund,
  RefundStatus,
  RefundFilters,
} from '../../types/billing.types';
import ErrorAlert from '../common/ErrorAlert';
import Dropdown from '../common/Dropdown';
import { getErrorMessage } from '../../utils/errorHandler';

interface RefundListProps {
  onApprove?: (refund: Refund) => void;
  onReject?: (refund: Refund) => void;
}

const RefundList: React.FC<RefundListProps> = ({ onApprove, onReject }) => {
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string>('');
  const [filters, setFilters] = useState<RefundFilters>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRefund, setSelectedRefund] = useState<Refund | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject' | 'process' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadRefunds();
  }, [filters]);

  const loadRefunds = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await billingService.getRefunds(filters);
      setRefunds(data);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to load refunds'));
      console.error('Error loading refunds:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveClick = (refund: Refund) => {
    setSelectedRefund(refund);
    setApprovalAction('approve');
    setShowApprovalModal(true);
  };

  const handleRejectClick = (refund: Refund) => {
    setSelectedRefund(refund);
    setApprovalAction('reject');
    setRejectionReason('');
    setShowApprovalModal(true);
  };

  const handleProcessClick = (refund: Refund) => {
    setSelectedRefund(refund);
    setApprovalAction('process');
    setShowApprovalModal(true);
  };

  const handleConfirmAction = async () => {
    if (!selectedRefund || !approvalAction) return;

    try {
      setActionLoading(true);
      setActionError('');

      if (approvalAction === 'approve') {
        await billingService.approveRefund(selectedRefund.id, {});
        onApprove?.(selectedRefund);
      } else if (approvalAction === 'reject') {
        if (!rejectionReason.trim()) {
          setActionError('Please provide a reason for rejection');
          setActionLoading(false);
          return;
        }
        await billingService.rejectRefund(selectedRefund.id, { rejectionReason });
        onReject?.(selectedRefund);
      } else {
        // process — money actually leaves at this step
        await billingService.processRefund(selectedRefund.id);
      }

      setShowApprovalModal(false);
      setSelectedRefund(null);
      setApprovalAction(null);
      setRejectionReason('');
      loadRefunds();
    } catch (err: any) {
      setActionError(err.response?.data?.message || getErrorMessage(err, `Failed to ${approvalAction} refund`));
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadgeClass = (status: RefundStatus) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'APPROVED':
        return 'bg-blue-100 text-blue-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'CANCELLED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredRefunds = refunds.filter((refund) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      refund.referenceNumber?.toLowerCase().includes(term) ||
      refund.invoice?.invoiceNumber?.toLowerCase().includes(term) ||
      refund.patient?.firstName?.toLowerCase().includes(term) ||
      refund.patient?.lastName?.toLowerCase().includes(term)
    );
  });

  const pendingRefunds = filteredRefunds.filter((r) => r.status === 'PENDING');
  const approvedRefunds = filteredRefunds.filter((r) => r.status === 'APPROVED');
  const totalRefundAmount = filteredRefunds.reduce(
    (sum, refund) => sum + refund.amount,
    0
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
        <button
          onClick={loadRefunds}
          className="mt-2 text-red-600 hover:text-red-800 font-medium"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Payment ref, invoice #, patient..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <Dropdown
              value={filters.status || ''}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  status: e.target.value as RefundStatus | undefined,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </Dropdown>
          </div>

          {/* Clear Filters */}
          <div className="flex items-end">
            <button
              onClick={() => {
                setFilters({});
                setSearchTerm('');
              }}
              className="w-full px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">Total Refunds</div>
          <div className="text-2xl font-bold text-gray-900">
            {filteredRefunds.length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">Pending Approval</div>
          <div className="text-2xl font-bold text-yellow-600">
            {pendingRefunds.length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">Awaiting Processing</div>
          <div className="text-2xl font-bold text-blue-600">
            {approvedRefunds.length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">Total Amount</div>
          <div className="text-2xl font-bold text-red-600">
            {formatCurrency(totalRefundAmount)}
          </div>
        </div>
      </div>

      {/* Refunds Table */}
      {filteredRefunds.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No refunds found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm || filters.status
              ? 'Try adjusting your filters'
              : 'No refund requests have been made yet'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Request Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment/Invoice
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reason
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Method
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRefunds.map((refund) => (
                  <tr key={refund.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(refund.requestedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        {refund.referenceNumber && (
                          <div className="font-medium text-gray-900">
                            Ref: {refund.referenceNumber}
                          </div>
                        )}
                        {refund.invoice?.invoiceNumber && (
                          <Link
                            to={`/billing/invoices/${refund.invoiceId}`}
                            className="text-blue-600 hover:text-blue-800 text-xs"
                          >
                            {refund.invoice.invoiceNumber}
                          </Link>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {refund.patient ? (
                        <div className="text-sm font-medium text-gray-900">
                          {refund.patient.firstName} {refund.patient.lastName}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right text-red-600">
                      {formatCurrency(refund.amount)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {refund.reason}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {refund.refundMethod?.replace('_', ' ') || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(
                          refund.status
                        )}`}
                      >
                        {refund.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {refund.status === 'PENDING' && (
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleApproveClick(refund)}
                            className="text-green-600 hover:text-green-900"
                            title="Approve Refund"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleRejectClick(refund)}
                            className="text-red-600 hover:text-red-900"
                            title="Reject Refund"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>
                      )}
                      {refund.status === 'APPROVED' && (
                        <button
                          onClick={() => handleProcessClick(refund)}
                          className="text-blue-600 hover:text-blue-900 text-xs font-medium px-2 py-1 border border-blue-300 rounded"
                          title="Process Refund — money leaves at this step"
                        >
                          Process Refund
                        </button>
                      )}
                      {refund.status === 'REJECTED' && refund.rejectionReason && (
                        <div className="text-xs text-red-600 max-w-xs truncate">
                          {refund.rejectionReason}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Approval/Rejection Modal */}
      {showApprovalModal && selectedRefund && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {approvalAction === 'approve' ? 'Approve Refund' : approvalAction === 'reject' ? 'Reject Refund' : 'Process Refund'}
            </h3>
            {approvalAction === 'process' && (
              <p className="text-sm text-gray-600 mb-4">
                This is the final step — confirming will mark the refund as completed. Make sure the money has actually been returned to the patient before confirming.
              </p>
            )}

            {/* Action Error Alert */}
            {actionError && (
              <div className="mb-4">
                <ErrorAlert
                  message={actionError}
                  severity="error"
                  onDismiss={() => setActionError('')}
                />
              </div>
            )}

            <div className="mb-4 p-4 bg-gray-50 rounded-md">
              <div className="text-sm space-y-2">
                <div>
                  <span className="text-gray-600">Amount:</span>{' '}
                  <span className="font-medium">
                    {formatCurrency(selectedRefund.amount)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Reason:</span>{' '}
                  <span className="font-medium">{selectedRefund.reason}</span>
                </div>
              </div>
            </div>

            {approvalAction === 'reject' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rejection Reason *
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why this refund is being rejected..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  required
                />
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowApprovalModal(false);
                  setSelectedRefund(null);
                  setApprovalAction(null);
                  setRejectionReason('');
                }}
                disabled={actionLoading}
                className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAction}
                disabled={actionLoading}
                className={`px-4 py-2 text-white rounded-md transition-colors disabled:opacity-50 ${
                  approvalAction === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : approvalAction === 'reject'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {actionLoading
                  ? 'Processing...'
                  : approvalAction === 'approve'
                  ? 'Approve'
                  : approvalAction === 'reject'
                  ? 'Reject'
                  : 'Confirm Processed'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RefundList;
