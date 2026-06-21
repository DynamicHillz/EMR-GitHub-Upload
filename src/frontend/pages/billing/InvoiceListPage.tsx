import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import InvoiceList from '../../components/billing/InvoiceList';
import InvoiceDetail from '../../components/billing/InvoiceDetail';
import PaymentForm from '../../components/billing/PaymentForm';
import { Invoice } from '../../types/billing.types';

const InvoiceListPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowDetailModal(true);
  };

  const handleRecordPayment = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false);
    setSelectedInvoice(null);
    // Trigger reload by navigating to the same route
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-600 mt-1">Manage patient invoices and billing</p>
        </div>
        <Link
          to="/billing/invoices/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center"
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Create Invoice
        </Link>
      </div>

      {/* Invoice List */}
      <InvoiceList
        onViewInvoice={handleViewInvoice}
        onRecordPayment={handleRecordPayment}
      />

      {/* Invoice Detail Modal */}
      {showDetailModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full my-8">
            <div className="p-6">
              <InvoiceDetail
                invoiceId={selectedInvoice.id}
                onRecordPayment={() => {
                  setShowDetailModal(false);
                  setShowPaymentModal(true);
                }}
                onClose={() => {
                  setShowDetailModal(false);
                  setSelectedInvoice(null);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full my-8">
            <div className="p-6">
              <PaymentForm
                invoice={selectedInvoice}
                onSuccess={handlePaymentSuccess}
                onCancel={() => {
                  setShowPaymentModal(false);
                  setSelectedInvoice(null);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceListPage;
