import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FileText, Mail } from 'lucide-react';
import ErrorAlert from '../../components/common/ErrorAlert';
import billingService from '../../services/billing.service';

interface ReceiptData {
  payment: {
    id: string;
    paymentNumber: string;
    amount: number;
    paymentMethod: string;
    paymentDate: string;
    referenceNumber?: string | null;
    transactionId?: string | null;
    cashReceivedByName?: string | null;
    invoice: {
      invoiceNumber: string;
    };
    patient: { firstName: string; lastName: string; patientId: string; email?: string | null };
    processedBy: { firstName: string; lastName: string };
  };
  branding: {
    clinicName?: string;
    address?: string;
    phone?: string;
    logoUrl?: string;
    invoiceFooterText?: string;
  };
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

const ReceiptPrintPage: React.FC = () => {
  const { paymentId } = useParams<{ paymentId: string }>();
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [emailing, setEmailing] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    if (!paymentId) return;
    billingService
      .getPaymentReceipt(paymentId)
      .then((data) => setReceipt(data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load receipt'))
      .finally(() => setLoading(false));
  }, [paymentId]);

  useEffect(() => {
    if (receipt && !loading && paymentId) {
      billingService.markReceiptPrinted(paymentId).catch(() => {});
      setTimeout(() => window.print(), 500);
    }
  }, [receipt, loading, paymentId]);

  const handleEmailReceipt = async () => {
    if (!paymentId) return;
    setEmailing(true);
    try {
      await billingService.emailPaymentReceipt(paymentId);
      setEmailSent(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to email receipt');
    } finally {
      setEmailing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-xl text-gray-500 font-semibold animate-pulse">Loading receipt...</div>
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="p-8">
        <ErrorAlert message={error || 'Receipt not found'} />
      </div>
    );
  }

  const { payment, branding } = receipt;
  const clinicName = branding.clinicName || 'SSMC EMR';

  return (
    <div className="bg-white min-h-screen text-black p-8 font-sans print:p-0 print:m-0">
      <style>
        {`
          @media print {
            @page { margin: 1.5cm; size: A4; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: white !important; }
            .no-print { display: none !important; }
          }
        `}
      </style>

      {/* Action bar for screen only */}
      <div className="no-print mb-8 pb-4 border-b border-gray-200 flex justify-between items-center">
        <div>
          <Link to="/billing/invoices" className="text-sm text-blue-600 hover:text-blue-800 font-medium mb-1 inline-block">
            ← Back to Invoices
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">Print Preview</h1>
          <p className="text-gray-500">Review the receipt before printing.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleEmailReceipt}
            disabled={!payment.patient.email || emailing || emailSent}
            className="bg-white border border-gray-300 text-gray-700 px-6 py-2 rounded-lg font-medium hover:bg-gray-50 shadow-sm flex items-center gap-2 disabled:opacity-50"
            title={!payment.patient.email ? 'Patient has no email on file' : undefined}
          >
            <Mail className="w-5 h-5" />
            {emailSent ? 'Receipt Emailed' : emailing ? 'Sending...' : 'Email Receipt'}
          </button>
          <button
            onClick={() => window.print()}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 shadow-sm flex items-center gap-2"
          >
            <FileText className="w-5 h-5" />
            Print Now
          </button>
        </div>
      </div>

      {/* Receipt Content */}
      <div className="max-w-2xl mx-auto border border-gray-300 p-8 shadow-sm print:border-none print:shadow-none print:p-0">
        {/* Header */}
        <div className="border-b-2 border-blue-900 pb-6 mb-6 flex justify-between items-start">
          <div className="flex items-center gap-3">
            {branding.logoUrl && <img src={branding.logoUrl} alt={clinicName} className="h-12 w-12 object-contain" />}
            <div>
              <h1 className="text-2xl font-bold text-blue-900 tracking-tight uppercase">{clinicName}</h1>
              {branding.address && <p className="text-gray-600 text-sm mt-0.5">{branding.address}</p>}
              {branding.phone && <p className="text-gray-600 text-sm">{branding.phone}</p>}
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-semibold text-gray-800">Receipt</h2>
            <p className="text-gray-500 mt-1 font-mono text-sm">{payment.paymentNumber}</p>
          </div>
        </div>

        {/* Patient & Payment Details */}
        <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
          <div>
            <div className="text-gray-500">Patient</div>
            <div className="font-semibold">{payment.patient.firstName} {payment.patient.lastName}</div>
            <div className="text-xs text-gray-500 font-mono">{payment.patient.patientId}</div>
          </div>
          <div className="text-right">
            <div className="text-gray-500">Date</div>
            <div className="font-semibold">{new Date(payment.paymentDate).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-gray-500">Invoice</div>
            <div className="font-semibold">{payment.invoice.invoiceNumber}</div>
          </div>
          <div className="text-right">
            <div className="text-gray-500">Payment Method</div>
            <div className="font-semibold">{payment.paymentMethod}</div>
          </div>
          {(payment.referenceNumber || payment.transactionId) && (
            <div className="col-span-2">
              <div className="text-gray-500">Reference</div>
              <div className="font-mono text-xs">{payment.referenceNumber || payment.transactionId}</div>
            </div>
          )}
        </div>

        {/* No line-item breakdown by design — same principle as the
            patient-facing bill (see InvoiceDetail.tsx's Generate Bill):
            the itemized service list is an internal clinic record, not
            something handed to the patient. */}
        <div className="text-center py-6 mb-6 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-500 mb-1">Amount Paid</div>
          <div className="text-3xl font-bold text-gray-900">{formatCurrency(payment.amount)}</div>
        </div>

        {/* Signature — for cash, the person who physically took the money
            isn't always who's logged in recording it, so both are shown
            when they're tracked separately. */}
        <div className="mt-12 pt-6 border-t border-gray-300 text-sm grid grid-cols-2 gap-6">
          {payment.paymentMethod === 'CASH' && payment.cashReceivedByName && (
            <div>
              <p className="text-gray-500 mb-1">Cash Received By</p>
              <p className="font-semibold text-gray-800">{payment.cashReceivedByName}</p>
            </div>
          )}
          <div>
            <p className="text-gray-500 mb-1">Recorded By</p>
            <p className="font-semibold text-gray-800">{payment.processedBy.firstName} {payment.processedBy.lastName}</p>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-gray-400 border-t pt-4">
          {branding.invoiceFooterText && <p>{branding.invoiceFooterText}</p>}
          <p className="mt-1">This receipt is electronically generated. {clinicName}</p>
        </div>
      </div>
    </div>
  );
};

export default ReceiptPrintPage;
