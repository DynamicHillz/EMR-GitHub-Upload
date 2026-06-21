import React, { useState } from 'react';
import OutstandingBalancesList from '../../components/billing/OutstandingBalancesList';
import PaymentForm from '../../components/billing/PaymentForm';
import { Invoice } from '../../types/billing.types';

const OutstandingBalancesPage: React.FC = () => {
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const handleRecordPayment = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false);
    setSelectedInvoice(null);
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Outstanding Balances</h1>
        <p className="text-gray-600 mt-1">
          Accounts receivable and aging analysis
        </p>
      </div>

      {/* Outstanding Balances List */}
      <OutstandingBalancesList onRecordPayment={handleRecordPayment} />

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

export default OutstandingBalancesPage;
