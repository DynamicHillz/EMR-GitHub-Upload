import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import billingService from '../../services/billing.service';
import {
  Invoice,
  Payment,
  InvoiceStatus,
  PaymentStatus,
} from '../../types/billing.types';
import ErrorAlert from '../common/ErrorAlert';
import ConfirmDialog from '../common/ConfirmDialog';
import { useConfirm } from '../../hooks/useConfirm';

interface InvoiceDetailProps {
  invoiceId: string;
  onRecordPayment?: () => void;
  onClose?: () => void;
}

const InvoiceDetail: React.FC<InvoiceDetailProps> = ({
  invoiceId,
  onRecordPayment,
  onClose,
}) => {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [branding, setBranding] = useState<any>(null);

  const { confirm, isOpen, options, loading: confirmLoading, handleConfirm, handleCancel } = useConfirm();

  useEffect(() => {
    loadInvoiceDetails();
    fetchBranding();
  }, [invoiceId]);

  const fetchBranding = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/branding', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) setBranding(data.data);
    } catch (err) {
      console.error('Error fetching branding:', err);
    }
  };

  const loadInvoiceDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const [invoiceData, paymentsData] = await Promise.all([
        billingService.getInvoiceById(invoiceId),
        billingService.getPayments({ invoiceId }),
      ]);
      setInvoice(invoiceData);
      setPayments(paymentsData);
    } catch (err: any) {
      setError(err.message || 'Failed to load invoice details');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelInvoice = async () => {
    const confirmed = await confirm({
      title: 'Cancel Invoice',
      message: `Are you sure you want to cancel invoice ${invoice?.invoiceNumber}? This action cannot be undone.`,
      confirmText: 'Cancel Invoice',
      cancelText: 'Keep Invoice',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      setActionError('');
      setSuccessMessage('');
      await billingService.cancelInvoice(invoiceId);
      setSuccessMessage('Invoice cancelled successfully');
      setTimeout(() => { setSuccessMessage(''); onClose?.(); }, 1500);
    } catch (err: any) {
      setActionError(err.message || 'Failed to cancel invoice');
    }
  };

  const handlePrintInvoice = async () => {
    if (!invoice) return;

    let brandingData = branding;
    if (!brandingData) {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:3000/api/branding', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        brandingData = data.data;
        setBranding(brandingData);
      } catch (err) {
        console.error('Could not load branding for print');
      }
    }

    const clinicName = brandingData?.clinicName || 'St. Stephen Medical Centre';
    const clinicAddress = brandingData?.address || '';
    const clinicPhone = brandingData?.phone || '';
    const clinicEmail = brandingData?.email || '';
    const logoUrl = brandingData?.logoUrl || '';

    const verifyUrl = `${window.location.origin}/billing/invoices/${invoice.id}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(verifyUrl)}`;

    const formatCurrencyPrint = (amount: number) =>
      new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

    const formatDatePrint = (dateString: string) =>
      new Date(dateString).toLocaleDateString('en-NG', {
        year: 'numeric', month: 'long', day: 'numeric',
      });

    const lineItemsHtml = (invoice.lineItems || []).map((item: any) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${item.description || item.serviceName || ''}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${item.quantity}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatCurrencyPrint(item.unitPrice)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatCurrencyPrint(item.taxAmount || item.tax || 0)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${formatCurrencyPrint(item.total)}</td>
      </tr>
    `).join('');

    const paymentsHtml = payments.length > 0 ? `
      <div style="margin-top:24px;">
        <h3 style="font-size:13px;font-weight:700;text-transform:uppercase;color:#6b7280;margin-bottom:12px;">Payment History</h3>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:8px 12px;text-align:left;border-bottom:1px solid #e5e7eb;">Date</th>
              <th style="padding:8px 12px;text-align:left;border-bottom:1px solid #e5e7eb;">Method</th>
              <th style="padding:8px 12px;text-align:left;border-bottom:1px solid #e5e7eb;">Reference</th>
              <th style="padding:8px 12px;text-align:right;border-bottom:1px solid #e5e7eb;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${payments.map(p => `
              <tr>
                <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${new Date(p.paymentDate).toLocaleDateString('en-NG')}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${p.paymentMethod.replace('_', ' ')}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${p.referenceNumber || '-'}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:#16a34a;font-weight:600;">${formatCurrencyPrint(p.amount)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : '';

    const printContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoice.invoiceNumber} - ${clinicName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12pt; color: #111; padding: 30px; max-width: 800px; margin: 0 auto; }
    @media print { body { padding: 15px; } }
  </style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:20px;border-bottom:3px solid #1d4ed8;margin-bottom:24px;">
    <div style="display:flex;align-items:center;gap:16px;">
      ${logoUrl ? `<img src="${logoUrl}" alt="${clinicName}" style="max-height:70px;max-width:160px;object-fit:contain;" />` : ''}
      <div>
        <div style="font-size:20pt;font-weight:700;color:#1d4ed8;">${clinicName}</div>
        ${clinicAddress ? `<div style="font-size:10pt;color:#4b5563;margin-top:2px;">${clinicAddress}</div>` : ''}
        ${clinicPhone ? `<div style="font-size:10pt;color:#4b5563;">Tel: ${clinicPhone}</div>` : ''}
        ${clinicEmail ? `<div style="font-size:10pt;color:#4b5563;">Email: ${clinicEmail}</div>` : ''}
      </div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:22pt;font-weight:700;color:#1d4ed8;letter-spacing:2px;">INVOICE</div>
      <div style="font-size:14pt;color:#374151;margin-top:4px;">${invoice.invoiceNumber}</div>
      <div style="margin-top:8px;">
        <span style="background:${invoice.paymentStatus === 'PAID' ? '#dcfce7' : '#fee2e2'};color:${invoice.paymentStatus === 'PAID' ? '#16a34a' : '#dc2626'};padding:4px 12px;border-radius:20px;font-size:10pt;font-weight:700;">
          ${invoice.paymentStatus.replace('_', ' ')}
        </span>
      </div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px;">
    <div>
      <div style="font-size:10pt;font-weight:700;text-transform:uppercase;color:#6b7280;margin-bottom:8px;">Bill To</div>
      <div style="font-size:13pt;font-weight:700;">${invoice.patient?.firstName || ''} ${invoice.patient?.lastName || ''}</div>
      ${invoice.patient?.phone ? `<div style="font-size:10pt;color:#4b5563;">${invoice.patient.phone}</div>` : ''}
      ${invoice.patient?.email ? `<div style="font-size:10pt;color:#4b5563;">${invoice.patient.email}</div>` : ''}
    </div>
    <div>
      <div style="font-size:10pt;font-weight:700;text-transform:uppercase;color:#6b7280;margin-bottom:8px;">Invoice Details</div>
      <table style="font-size:10pt;width:100%;">
        <tr><td style="color:#6b7280;padding:2px 0;">Invoice Date:</td><td style="text-align:right;font-weight:600;">${formatDatePrint(invoice.invoiceDate)}</td></tr>
        ${invoice.dueDate ? `<tr><td style="color:#6b7280;padding:2px 0;">Due Date:</td><td style="text-align:right;font-weight:600;">${formatDatePrint(invoice.dueDate)}</td></tr>` : ''}
        <tr><td style="color:#6b7280;padding:2px 0;">Invoice No:</td><td style="text-align:right;font-weight:600;">${invoice.invoiceNumber}</td></tr>
      </table>
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;font-size:11pt;margin-bottom:24px;">
    <thead>
      <tr style="background:#1d4ed8;color:white;">
        <th style="padding:10px 12px;text-align:left;">Description</th>
        <th style="padding:10px 12px;text-align:right;">Qty</th>
        <th style="padding:10px 12px;text-align:right;">Unit Price</th>
        <th style="padding:10px 12px;text-align:right;">Tax</th>
        <th style="padding:10px 12px;text-align:right;">Total</th>
      </tr>
    </thead>
    <tbody>${lineItemsHtml}</tbody>
  </table>

  <div style="display:flex;justify-content:flex-end;margin-bottom:24px;">
    <table style="width:280px;font-size:11pt;">
      <tr><td style="padding:4px 0;color:#6b7280;">Subtotal:</td><td style="text-align:right;font-weight:600;">${formatCurrencyPrint(invoice.subtotal)}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280;">Tax:</td><td style="text-align:right;font-weight:600;">${formatCurrencyPrint(invoice.taxAmount || invoice.tax || 0)}</td></tr>
      ${invoice.discount > 0 ? `<tr><td style="padding:4px 0;color:#6b7280;">Discount:</td><td style="text-align:right;font-weight:600;color:#dc2626;">-${formatCurrencyPrint(invoice.discount)}</td></tr>` : ''}
      <tr><td colspan="2"><div style="border-top:2px solid #111;margin:6px 0;"></div></td></tr>
      <tr><td style="padding:4px 0;font-size:13pt;font-weight:700;">Total:</td><td style="text-align:right;font-size:13pt;font-weight:700;">${formatCurrencyPrint(invoice.totalAmount)}</td></tr>
      <tr><td style="padding:4px 0;color:#16a34a;">Paid:</td><td style="text-align:right;font-weight:600;color:#16a34a;">${formatCurrencyPrint(invoice.paidAmount || 0)}</td></tr>
      <tr><td style="padding:4px 0;color:#dc2626;font-weight:700;">Balance Due:</td><td style="text-align:right;font-weight:700;color:#dc2626;">${formatCurrencyPrint(invoice.balance)}</td></tr>
    </table>
  </div>

  ${paymentsHtml}

  ${invoice.notes ? `
  <div style="margin-top:24px;padding:12px;background:#f9fafb;border-radius:8px;">
    <div style="font-size:10pt;font-weight:700;text-transform:uppercase;color:#6b7280;margin-bottom:6px;">Notes</div>
    <div style="font-size:10pt;color:#374151;">${invoice.notes}</div>
  </div>` : ''}

  <div style="margin-top:32px;padding-top:20px;border-top:2px solid #e5e7eb;display:flex;justify-content:space-between;align-items:flex-end;">
    <div style="font-size:9pt;color:#6b7280;max-width:500px;">
      <div style="font-weight:700;color:#374151;margin-bottom:4px;">Document Verification</div>
      <div>Scan the QR code to verify this invoice is authentic and unaltered.</div>
      <div style="margin-top:4px;">Document ID: <strong>${invoice.id}</strong></div>
      <div>Generated: ${new Date().toLocaleString('en-NG')}</div>
      <div style="margin-top:8px;font-size:8pt;color:#9ca3af;">
        This document is issued by ${clinicName} and is only valid when verified against the clinic's records.
        Any alteration of this document constitutes fraud.
      </div>
    </div>
    <div style="text-align:center;">
      <img src="${qrUrl}" alt="Verify Invoice" style="width:100px;height:100px;" />
      <div style="font-size:8pt;color:#6b7280;margin-top:4px;">Scan to verify</div>
    </div>
  </div>
</body>
</html>`;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
      printWindow.onafterprint = () => printWindow.close();
    };
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-NG', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

  const formatDateTime = (dateString: string) =>
    new Date(dateString).toLocaleString('en-NG', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  const getStatusBadgeClass = (status: InvoiceStatus) => {
    switch (status) {
      case 'PAID': return 'bg-green-100 text-green-800';
      case 'ISSUED': return 'bg-blue-100 text-blue-800';
      case 'OVERDUE': return 'bg-red-100 text-red-800';
      case 'CANCELLED': return 'bg-gray-100 text-gray-800';
      case 'DRAFT': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusBadgeClass = (status: PaymentStatus) => {
    switch (status) {
      case 'PAID': return 'bg-green-100 text-green-800';
      case 'UNPAID': return 'bg-red-100 text-red-800';
      case 'PARTIALLY_PAID': return 'bg-orange-100 text-orange-800';
      case 'REFUNDED': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error || 'Invoice not found'}</p>
        <button onClick={loadInvoiceDetails} className="mt-2 text-red-600 hover:text-red-800 font-medium">
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {actionError && (
        <div className="mb-4">
          <ErrorAlert message={actionError} severity="error" onDismiss={() => setActionError('')} />
        </div>
      )}
      {successMessage && (
        <div className="mb-4">
          <ErrorAlert message={successMessage} severity="info" onDismiss={() => setSuccessMessage('')} />
        </div>
      )}

      {/* Header Actions */}
      <div className="flex justify-between items-center print:hidden">
        <h2 className="text-2xl font-bold text-gray-900">Invoice Details</h2>
        <div className="flex space-x-3">
          {invoice.balance > 0 && invoice.status !== 'CANCELLED' && (
            <button onClick={onRecordPayment}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors">
              Record Payment
            </button>
          )}
          <button onClick={handlePrintInvoice}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
            Print / Download
          </button>
          {invoice.status !== 'CANCELLED' && invoice.status !== 'PAID' && (
            <button onClick={handleCancelInvoice}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors">
              Cancel Invoice
            </button>
          )}
          {onClose && (
            <button onClick={onClose}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors">
              Close
            </button>
          )}
        </div>
      </div>

      {/* Invoice Header */}
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">INVOICE</h1>
            <p className="text-xl text-gray-600">{invoice.invoiceNumber}</p>
          </div>
          <div className="text-right">
            <div className="mb-2">
              <span className={`px-3 py-1 inline-flex text-sm font-semibold rounded-full ${getStatusBadgeClass(invoice.status)}`}>
                {invoice.status}
              </span>
            </div>
            <div>
              <span className={`px-3 py-1 inline-flex text-sm font-semibold rounded-full ${getPaymentStatusBadgeClass(invoice.paymentStatus)}`}>
                {invoice.paymentStatus.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>

        {/* Invoice Info Grid */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Bill To</h3>
            <div className="text-gray-900">
              <p className="font-semibold text-lg">{invoice.patient?.firstName} {invoice.patient?.lastName}</p>
              {invoice.patient?.email && <p className="text-sm">{invoice.patient.email}</p>}
              <p className="text-sm">{invoice.patient?.phone}</p>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Invoice Details</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Invoice Date:</span>
                <span className="font-medium">{formatDate(invoice.invoiceDate)}</span>
              </div>
              {invoice.dueDate && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Due Date:</span>
                  <span className="font-medium">{formatDate(invoice.dueDate)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">Items</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tax</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invoice.lineItems?.map((item: any, index: number) => (
                  <tr key={index}>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.description || item.serviceName}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">{item.quantity}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">{formatCurrency(item.unitPrice)}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">{formatCurrency(item.taxAmount || item.tax || 0)}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-full md:w-1/2 lg:w-1/3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-medium">{formatCurrency(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Tax:</span>
              <span className="font-medium">{formatCurrency(invoice.taxAmount || invoice.tax || 0)}</span>
            </div>
            {invoice.discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Discount:</span>
                <span className="font-medium text-red-600">-{formatCurrency(invoice.discount)}</span>
              </div>
            )}
            <div className="border-t border-gray-200 pt-2"></div>
            <div className="flex justify-between text-lg font-bold">
              <span>Total:</span>
              <span>{formatCurrency(invoice.totalAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-green-600">Paid:</span>
              <span className="font-medium text-green-600">{formatCurrency(invoice.paidAmount || 0)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span className="text-red-600">Balance Due:</span>
              <span className="text-red-600">{formatCurrency(invoice.balance)}</span>
            </div>
          </div>
        </div>

        {invoice.notes && (
          <div className="mt-8 pt-8 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Notes</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}
      </div>

      {/* Payment History */}
      {payments.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Payment History</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-4 py-3 text-sm text-gray-900">{formatDateTime(payment.paymentDate)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{payment.referenceNumber || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{payment.paymentMethod.replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-green-600">{formatCurrency(payment.amount)}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        {payment.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="print:hidden">
        <Link to="/billing/invoices" className="text-blue-600 hover:text-blue-800 font-medium">
          ← Back to Invoices
        </Link>
      </div>

      {/* Cancel Invoice Confirm Dialog */}
      <ConfirmDialog
        isOpen={isOpen}
        onClose={handleCancel}
        onConfirm={handleConfirm}
        title={options.title}
        message={options.message}
        confirmText={options.confirmText}
        cancelText={options.cancelText}
        variant={options.variant}
        loading={confirmLoading}
      />
    </div>
  );
};

export default InvoiceDetail;