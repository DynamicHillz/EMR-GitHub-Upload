/**
 * Billing Dashboard
 * Main dashboard for the billing module with all key features
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Receipt, ClipboardList } from 'lucide-react';
import {
  Invoice,
  OutstandingInvoice,
  Payment,
  Refund,
  AgingAnalysis,
} from '../../types/billing.types';
import billingService from '../../services/billing.service';
import GenerateInvoiceModal from '../../components/billing/GenerateInvoiceModal';

const BillingDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [stats, setStats] = useState({
    totalOutstanding: 0,
    totalInvoices: 0,
    totalPayments: 0,
    pendingRefunds: 0,
  });
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [recentPayments, setRecentPayments] = useState<Payment[]>([]);
  const [outstandingInvoices, setOutstandingInvoices] = useState<OutstandingInvoice[]>([]);
  const [agingAnalysis, setAgingAnalysis] = useState<AgingAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      const [invoicesResult, payments, outstandingResult, aging, refunds] = await Promise.all([
        billingService.getInvoices({ limit: 5 }),
        billingService.getPayments({}),
        billingService.getOutstandingInvoices({ limit: 5 }),
        billingService.getAgingAnalysis(),
        billingService.getRefunds({ status: 'PENDING' }),
      ]);
      const { invoices, total: totalInvoices } = invoicesResult;
      const { invoices: outstanding } = outstandingResult;

      // aging.totalOutstanding is the real total across every outstanding
      // invoice (computed server-side) — outstanding here is only the first
      // page, so summing its balances would understate the true figure.
      const totalOutstanding = aging.totalOutstanding;
      const totalPaymentsAmount = payments.reduce((sum, pay) => sum + pay.amount, 0);

      setStats({
        totalOutstanding,
        totalInvoices,
        totalPayments: totalPaymentsAmount,
        pendingRefunds: refunds.length,
      });

      setRecentInvoices(invoices.slice(0, 5));
      setRecentPayments(payments.slice(0, 5));
      setOutstandingInvoices(outstanding.slice(0, 5));
      setAgingAnalysis(aging);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-NG', {
      year: 'numeric', month: 'short', day: 'numeric',
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Billing Dashboard</h1>
        <p className="text-gray-600 mt-1">Overview of billing and payments</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Outstanding</p>
              <p className="text-2xl font-bold text-red-600 mt-2">
                {formatCurrency(stats.totalOutstanding)}
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Invoices</p>
              <p className="text-2xl font-bold text-blue-600 mt-2">{stats.totalInvoices}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Payments</p>
              <p className="text-2xl font-bold text-green-600 mt-2">
                {formatCurrency(stats.totalPayments)}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Refunds</p>
              <p className="text-2xl font-bold text-orange-600 mt-2">{stats.pendingRefunds}</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-full">
              <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Aging Analysis */}
      {agingAnalysis && agingAnalysis.buckets && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Accounts Receivable Aging</h2>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {agingAnalysis.buckets.map((bucket, index) => {
              const colors = ['text-green-600', 'text-blue-600', 'text-yellow-600', 'text-orange-600', 'text-red-600'];
              return (
                <div key={bucket.period} className="text-center">
                  <p className="text-sm text-gray-600">{bucket.period}</p>
                  <p className={`text-lg font-bold mt-1 ${colors[index] || 'text-gray-600'}`}>
                    {formatCurrency(bucket.totalAmount)}
                  </p>
                  <p className="text-xs text-gray-500">{bucket.invoiceCount} invoices</p>
                </div>
              );
            })}
            <div className="text-center bg-gray-50 rounded-md p-2">
              <p className="text-sm text-gray-600 font-medium">Total</p>
              <p className="text-lg font-bold text-gray-900 mt-1">
                {formatCurrency(agingAnalysis.totalOutstanding)}
              </p>
              <p className="text-xs text-gray-500">
                {agingAnalysis.buckets.reduce((sum, b) => sum + b.invoiceCount, 0)} invoices
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Invoices */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">Recent Invoices</h2>
            <Link to="/billing/invoices" className="text-sm text-blue-600 hover:text-blue-800">
              View All →
            </Link>
          </div>
          <div className="space-y-3">
            {recentInvoices.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No invoices yet</p>
            ) : (
              recentInvoices.map((invoice) => (
                <div key={invoice.id}
                  className="flex justify-between items-center p-3 border border-gray-200 rounded-md hover:bg-gray-50">
                  <div>
                    <p className="font-medium text-gray-900">{invoice.invoiceNumber}</p>
                    <p className="text-sm text-gray-500">
                      {invoice.patient?.firstName} {invoice.patient?.lastName}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">{formatCurrency(invoice.totalAmount)}</p>
                    <p className="text-xs text-gray-500">{formatDate(invoice.invoiceDate)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Outstanding Invoices */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">Outstanding Balances</h2>
            <Link to="/billing/outstanding" className="text-sm text-blue-600 hover:text-blue-800">
              View All →
            </Link>
          </div>
          <div className="space-y-3">
            {outstandingInvoices.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No outstanding balances</p>
            ) : (
              outstandingInvoices.map((invoice) => (
                <div key={invoice.invoiceId}
                  className="flex justify-between items-center p-3 border border-gray-200 rounded-md hover:bg-gray-50">
                  <div>
                    <p className="font-medium text-gray-900">{invoice.invoiceNumber}</p>
                    <p className="text-sm text-gray-500">{invoice.patientName}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-red-600">{formatCurrency(invoice.balance)}</p>
                    {invoice.daysOverdue && invoice.daysOverdue > 0 && (
                      <p className="text-xs text-red-500">{invoice.daysOverdue} days overdue</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 bg-blue-50 rounded-lg p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Link to="/billing/insurance"
            className="flex items-center justify-center p-4 bg-white rounded-md shadow hover:shadow-md transition-shadow border-2 border-blue-500">
            <div className="text-center">
              <svg className="w-8 h-8 text-blue-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <p className="text-sm font-medium">Insurance Claims</p>
            </div>
          </Link>

          <Link to="/billing/unbilled"
            className="flex items-center justify-center p-4 bg-white rounded-md shadow hover:shadow-md transition-shadow border-2 border-green-500">
            <div className="text-center">
              <ClipboardList className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-sm font-medium">Unbilled Queue</p>
            </div>
          </Link>

          <Link to="/billing/services"
            className="flex items-center justify-center p-4 bg-white rounded-md shadow hover:shadow-md transition-shadow">
            <div className="text-center">
              <svg className="w-8 h-8 text-blue-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-sm font-medium">Services</p>
            </div>
          </Link>

          {/* Generate Invoice — pulls dispensed prescriptions, lab tests, consultations automatically */}
          <button
            onClick={() => setShowGenerateModal(true)}
            className="flex items-center justify-center p-4 bg-white rounded-md shadow hover:shadow-md transition-shadow"
          >
            <div className="text-center">
              <Receipt className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-sm font-medium">Generate Invoice</p>
            </div>
          </button>

          <Link to="/billing/invoices/new"
            className="flex items-center justify-center p-4 bg-white rounded-md shadow hover:shadow-md transition-shadow">
            <div className="text-center">
              <svg className="w-8 h-8 text-amber-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <p className="text-sm font-medium">Custom Charge</p>
              <p className="text-xs text-gray-400 mt-0.5">Free-typed pricing</p>
            </div>
          </Link>

          <Link to="/billing/payments"
            className="flex items-center justify-center p-4 bg-white rounded-md shadow hover:shadow-md transition-shadow">
            <div className="text-center">
              <svg className="w-8 h-8 text-blue-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <p className="text-sm font-medium">Payments</p>
            </div>
          </Link>

          <Link to="/billing/refunds"
            className="flex items-center justify-center p-4 bg-white rounded-md shadow hover:shadow-md transition-shadow">
            <div className="text-center">
              <svg className="w-8 h-8 text-blue-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              <p className="text-sm font-medium">Refunds</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Generate Invoice Modal */}
      {showGenerateModal && (
        <GenerateInvoiceModal
          onClose={() => setShowGenerateModal(false)}
          onSuccess={(invoiceId) => {
            setShowGenerateModal(false);
            navigate(`/billing/invoices/${invoiceId}`);
          }}
        />
      )}
    </div>
  );
};

export default BillingDashboard;