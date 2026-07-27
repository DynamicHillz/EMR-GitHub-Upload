import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import billingService from '../../services/billing.service';
import { getErrorMessage } from '../../utils/errorHandler';
import {
  Invoice,
  AgingAnalysis,
  AgingBucket,
} from '../../types/billing.types';

interface OutstandingBalancesListProps {
  onRecordPayment?: (invoice: Invoice) => void;
}

const OutstandingBalancesList: React.FC<OutstandingBalancesListProps> = ({
  onRecordPayment,
}) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [agingAnalysis, setAgingAnalysis] = useState<AgingAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadOutstandingBalances();
  }, []);

  const loadOutstandingBalances = async () => {
    try {
      setLoading(true);
      setError(null);
      const [outstandingInvoices, aging] = await Promise.all([
        billingService.getOutstandingInvoices(),
        billingService.getAgingAnalysis(),
      ]);

      // Transform backend data to frontend format
      const transformedInvoices = outstandingInvoices.map((inv: any) => ({
        id: inv.invoiceId,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        dueDate: inv.daysOverdue > 0 ? new Date(new Date(inv.invoiceDate).getTime() + (inv.daysOverdue * 24 * 60 * 60 * 1000)).toISOString() : inv.invoiceDate,
        totalAmount: inv.totalAmount,
        paidAmount: inv.paidAmount,
        balance: inv.balance,
        patient: {
          firstName: inv.patientName.split(' ')[0],
          lastName: inv.patientName.split(' ').slice(1).join(' '),
          phone: inv.patientPhone
        }
      }));

      setInvoices(transformedInvoices);
      setAgingAnalysis(aging);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to load outstanding balances'));
      console.error('Error loading outstanding balances:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateDaysOverdue = (dueDate?: string): number => {
    if (!dueDate) return 0;
    const due = new Date(dueDate);
    const today = new Date();
    const diffTime = today.getTime() - due.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const getAgingBucket = (daysOverdue: number): string => {
    if (daysOverdue === 0) return 'Current';
    if (daysOverdue <= 30) return '1-30 Days';
    if (daysOverdue <= 60) return '31-60 Days';
    if (daysOverdue <= 90) return '61-90 Days';
    return '90+ Days';
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

  const getDaysOverdueClass = (days: number): string => {
    if (days === 0) return 'text-gray-600';
    if (days <= 30) return 'text-yellow-600';
    if (days <= 60) return 'text-orange-600';
    return 'text-red-600';
  };

  const filteredInvoices = invoices.filter((invoice) => {
    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        invoice.invoiceNumber.toLowerCase().includes(term) ||
        invoice.patient?.firstName?.toLowerCase().includes(term) ||
        invoice.patient?.lastName?.toLowerCase().includes(term) ||
        invoice.patient?.phone?.toLowerCase().includes(term);
      if (!matchesSearch) return false;
    }

    // Filter by aging bucket
    if (selectedBucket) {
      const daysOverdue = calculateDaysOverdue(invoice.dueDate);
      const bucket = getAgingBucket(daysOverdue);
      if (bucket !== selectedBucket) return false;
    }

    return true;
  });

  const totalOutstanding = filteredInvoices.reduce((sum, inv) => sum + inv.balance, 0);

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
          onClick={loadOutstandingBalances}
          className="mt-2 text-red-600 hover:text-red-800 font-medium"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Aging Analysis */}
      {agingAnalysis && (
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-4">Aging Analysis</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {agingAnalysis.buckets.map((bucket: AgingBucket) => (
              <button
                key={bucket.period}
                onClick={() =>
                  setSelectedBucket(selectedBucket === bucket.period ? null : bucket.period)
                }
                className={`bg-white rounded-lg shadow p-4 text-left transition-all hover:shadow-md ${
                  selectedBucket === bucket.period ? 'ring-2 ring-blue-500' : ''
                }`}
              >
                <div className="text-xs text-gray-600 mb-1">{bucket.period}</div>
                <div className="text-lg font-bold text-gray-900">
                  {formatCurrency(bucket.totalAmount)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {bucket.invoiceCount} invoice{bucket.invoiceCount !== 1 ? 's' : ''}
                </div>
              </button>
            ))}
          </div>
          <div className="mt-4 bg-blue-50 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Total Outstanding</span>
              <span className="text-2xl font-bold text-blue-600">
                {formatCurrency(agingAnalysis.totalOutstanding)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center space-x-4">
          {/* Search */}
          <div className="flex-1">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by invoice #, patient name, phone..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Clear Filters */}
          {(searchTerm || selectedBucket) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedBucket(null);
              }}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
        {selectedBucket && (
          <div className="mt-2 text-sm text-gray-600">
            Showing invoices in: <span className="font-medium">{selectedBucket}</span>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">Outstanding Invoices</div>
          <div className="text-2xl font-bold text-gray-900">
            {filteredInvoices.length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">Total Outstanding</div>
          <div className="text-2xl font-bold text-red-600">
            {formatCurrency(totalOutstanding)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">Average Balance</div>
          <div className="text-2xl font-bold text-gray-900">
            {filteredInvoices.length > 0
              ? formatCurrency(totalOutstanding / filteredInvoices.length)
              : formatCurrency(0)}
          </div>
        </div>
      </div>

      {/* Outstanding Invoices Table */}
      {filteredInvoices.length === 0 ? (
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
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            No outstanding balances found
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm || selectedBucket
              ? 'Try adjusting your filters'
              : 'All invoices are fully paid!'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Invoice #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Invoice Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Due Date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Paid
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Balance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Days Overdue
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Aging
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredInvoices.map((invoice) => {
                  const daysOverdue = calculateDaysOverdue(invoice.dueDate);
                  const agingBucket = getAgingBucket(daysOverdue);

                  return (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          to={`/billing/invoices/${invoice.id}`}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {invoice.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {invoice.patient?.firstName} {invoice.patient?.lastName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {invoice.patient?.phone}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(invoice.invoiceDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {invoice.dueDate ? formatDate(invoice.dueDate) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right text-gray-900">
                        {formatCurrency(invoice.totalAmount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600">
                        {formatCurrency(invoice.paidAmount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-right text-red-600">
                        {formatCurrency(invoice.balance)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-medium ${getDaysOverdueClass(daysOverdue)}`}>
                          {daysOverdue === 0 ? 'Current' : `${daysOverdue} days`}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            daysOverdue === 0
                              ? 'bg-gray-100 text-gray-800'
                              : daysOverdue <= 30
                              ? 'bg-yellow-100 text-yellow-800'
                              : daysOverdue <= 60
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {agingBucket}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => onRecordPayment?.(invoice)}
                          className="text-green-600 hover:text-green-900"
                          title="Record Payment"
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
                              d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                            />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default OutstandingBalancesList;
