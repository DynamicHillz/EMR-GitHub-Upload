import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import InvoiceDetail from '../../components/billing/InvoiceDetail';
import PaymentForm from '../../components/billing/PaymentForm';
import billingService from '../../services/billing.service';
import { Invoice } from '../../types/billing.types';

const InvoiceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [invoice, setInvoice] = useState<Invoice | null>(null);

  const handleRecordPayment = async () => {
    if (id) {
      try {
        const invoiceData = await billingService.getInvoiceById(id);
        setInvoice(invoiceData);
        setShowPaymentModal(true);
      } catch (err) {
        console.error('Error loading invoice:', err);
      }
    }
  };

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false);
    setInvoice(null);
    window.location.reload();
  };

  if (!id) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Invalid invoice ID</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <InvoiceDetail invoiceId={id} onRecordPayment={handleRecordPayment} />

      {/* Payment Modal */}
      {showPaymentModal && invoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full my-8">
            <div className="p-6">
              <PaymentForm
                invoice={invoice}
                onSuccess={handlePaymentSuccess}
                onCancel={() => {
                  setShowPaymentModal(false);
                  setInvoice(null);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceDetailPage;
