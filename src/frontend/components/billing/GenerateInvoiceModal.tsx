/**
 * Generate Invoice Modal
 *
 * Allows cashier to auto-generate an invoice for a patient by pulling in:
 * - Dispensed prescriptions (priced from batch selling price)
 * - Completed/reviewed lab tests (priced from service catalog)
 * - Finalized consultations (priced from service catalog)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, Search, Receipt, Pill, TestTube, FileText, AlertCircle } from 'lucide-react';
import { useToast } from '../ToastContainer';

interface Patient {
  id: string;
  patientId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  age: number;
  phone: string;
}

interface BillableItem {
  id: string;
  type: 'PRESCRIPTION' | 'LAB_TEST' | 'CONSULTATION';
  description: string;
  detail: string;
  quantity: number;
  unitPrice: number;
  total: number;
  selected: boolean;
}

interface GenerateInvoiceModalProps {
  onClose: () => void;
  onSuccess: (invoiceId: string) => void;
}

const GenerateInvoiceModal: React.FC<GenerateInvoiceModalProps> = ({ onClose, onSuccess }) => {
  const toast = useToast();

  const [step, setStep] = useState<'search' | 'preview'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [billableItems, setBillableItems] = useState<BillableItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState(0);
  const [error, setError] = useState('');

  const searchPatients = useCallback(async (query: string) => {
    if (query.length < 2) { setSearchResults([]); return; }
    setIsSearching(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `http://localhost:3000/api/patients/search?query=${encodeURIComponent(query)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      setSearchResults(res.ok ? (data.data || []) : []);
    } catch { setSearchResults([]); }
    finally { setIsSearching(false); }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => searchPatients(searchQuery), 300);
    return () => clearTimeout(id);
  }, [searchQuery, searchPatients]);

  const fetchBillableItems = async (patient: Patient) => {
    setIsLoadingItems(true);
    setError('');
    const token = localStorage.getItem('token');

    try {
      // Fetch dispensed prescriptions, completed lab tests, finalized consultations in parallel
      const [presRes, labRes, conRes] = await Promise.all([
        fetch(`http://localhost:3000/api/pharmacy/prescriptions?status=DISPENSED&patientId=${patient.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`http://localhost:3000/api/lab/tests?status=COMPLETED&patientId=${patient.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`http://localhost:3000/api/consultations/patient/${patient.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const [presData, labData, conData] = await Promise.all([
        presRes.json(),
        labRes.json(),
        conRes.json(),
      ]);

      const items: BillableItem[] = [];

      // Dispensed prescriptions
      const prescriptions = presData.data || [];
      for (const p of prescriptions) {
        const unitPrice = p.batchSellingPrice || 0;
        const qty = p.quantityDispensed || p.quantity || 1;
        items.push({
          id: p.id,
          type: 'PRESCRIPTION',
          description: p.medicationName,
          detail: `${p.dosage} — ${p.frequency} × ${qty} units`,
          quantity: qty,
          unitPrice,
          total: unitPrice * qty,
          selected: true,
        });
      }

      // Completed lab tests
      const labTests = labData.data || labData.tests || [];
      for (const l of labTests) {
        const unitPrice = l.price || 2000;
        items.push({
          id: l.id,
          type: 'LAB_TEST',
          description: l.testName,
          detail: `Lab test — ${l.status}`,
          quantity: 1,
          unitPrice,
          total: unitPrice,
          selected: true,
        });
      }

      // Finalized consultations
      const consultations = conData.data || [];
      for (const c of consultations) {
        if (c.status !== 'FINALIZED') continue;
        const unitPrice = 5000; // pulled from service catalog in backend
        items.push({
          id: c.id,
          type: 'CONSULTATION',
          description: 'Doctor Consultation',
          detail: c.assessment || 'Consultation visit',
          quantity: 1,
          unitPrice,
          total: unitPrice,
          selected: true,
        });
      }

      setBillableItems(items);
      if (items.length === 0) {
        setError('No unbilled services found for this patient. Prescriptions must be dispensed, lab tests completed, and consultations finalized before generating an invoice.');
      }
    } catch (err) {
      setError('Failed to load billable items. Please try again.');
    } finally {
      setIsLoadingItems(false);
    }
  };

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setSearchQuery('');
    setSearchResults([]);
    setStep('preview');
    fetchBillableItems(patient);
  };

  const toggleItem = (id: string) => {
    setBillableItems(prev =>
      prev.map(item => item.id === id ? { ...item, selected: !item.selected } : item)
    );
  };

  const selectedItems = billableItems.filter(i => i.selected);
  const subtotal = selectedItems.reduce((sum, i) => sum + i.total, 0);
  const total = Math.max(0, subtotal - discount);

  const handleGenerate = async () => {
    if (selectedItems.length === 0) {
      toast.error('No Items Selected', 'Please select at least one item to invoice.');
      return;
    }

    setIsGenerating(true);
    try {
      const token = localStorage.getItem('token');

      const prescriptionIds = selectedItems
        .filter(i => i.type === 'PRESCRIPTION').map(i => i.id);
      const labTestIds = selectedItems
        .filter(i => i.type === 'LAB_TEST').map(i => i.id);
      const consultationIds = selectedItems
        .filter(i => i.type === 'CONSULTATION').map(i => i.id);

      const res = await fetch('http://localhost:3000/api/billing/invoices/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          patientId: selectedPatient!.id,
          prescriptionIds: prescriptionIds.length ? prescriptionIds : undefined,
          labTestIds: labTestIds.length ? labTestIds : undefined,
          consultationIds: consultationIds.length ? consultationIds : undefined,
          discount: discount || undefined,
          notes: notes || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
              // Backend wraps response — unwrap it
                    const invoice = data.data || data.invoice || data;
                    toast.success('Invoice Generated', `Invoice ${invoice.invoiceNumber} created successfully.`);
                    onSuccess(invoice.id);
          }else {
        toast.error('Failed', data.message || 'Could not generate invoice.');
      }
    } catch {
      toast.error('Error', 'Network error. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

  const typeIcon = (type: BillableItem['type']) => {
    if (type === 'PRESCRIPTION') return <Pill className="w-4 h-4 text-blue-500" />;
    if (type === 'LAB_TEST') return <TestTube className="w-4 h-4 text-purple-500" />;
    return <FileText className="w-4 h-4 text-green-500" />;
  };

  const typeBadge = (type: BillableItem['type']) => {
    if (type === 'PRESCRIPTION') return 'bg-blue-100 text-blue-700';
    if (type === 'LAB_TEST') return 'bg-purple-100 text-purple-700';
    return 'bg-green-100 text-green-700';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center z-10">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Receipt className="w-5 h-5 text-blue-600" />
              Generate Invoice
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Auto-pull dispensed prescriptions, lab tests, and consultations
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">

          {/* Step 1: Patient Search */}
          {step === 'search' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Patient
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Name, patient ID, or phone..."
                  className="input pl-9 w-full"
                  autoFocus
                />
                {isSearching && (
                  <div className="absolute right-3 top-3">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                  </div>
                )}
              </div>

              {searchResults.length > 0 && (
                <div className="mt-2 border border-gray-200 rounded-lg divide-y overflow-hidden">
                  {searchResults.map(patient => (
                    <div
                      key={patient.id}
                      onClick={() => handleSelectPatient(patient)}
                      className="p-3 hover:bg-gray-50 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{patient.fullName}</span>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                          {patient.patientId}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{patient.phone}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Preview & Generate */}
          {step === 'preview' && selectedPatient && (
            <div>
              {/* Patient Info */}
              <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
                <div>
                  <p className="text-sm text-gray-500">Patient</p>
                  <p className="font-semibold">{selectedPatient.fullName}</p>
                  <p className="text-sm text-gray-500">{selectedPatient.patientId}</p>
                </div>
                <button
                  onClick={() => { setStep('search'); setBillableItems([]); setError(''); }}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Change
                </button>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-800">{error}</p>
                </div>
              )}

              {/* Loading */}
              {isLoadingItems && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
                  <p className="text-gray-500 mt-3 text-sm">Loading billable items...</p>
                </div>
              )}

              {/* Billable Items */}
              {!isLoadingItems && billableItems.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Select items to include in this invoice:
                  </p>
                  <div className="space-y-2">
                    {billableItems.map(item => (
                      <label
                        key={item.id}
                        className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                          item.selected
                            ? 'border-blue-300 bg-blue-50'
                            : 'border-gray-200 bg-white'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={() => toggleItem(item.id)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {typeIcon(item.type)}
                            <span className="font-medium text-sm">{item.description}</span>
                            <span className={`text-xs px-2 py-0.5 rounded ${typeBadge(item.type)}`}>
                              {item.type === 'PRESCRIPTION' ? 'Drug' : item.type === 'LAB_TEST' ? 'Lab' : 'Consult'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5 truncate">{item.detail}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-semibold text-sm">{formatCurrency(item.total)}</p>
                          {item.quantity > 1 && (
                            <p className="text-xs text-gray-400">{formatCurrency(item.unitPrice)} × {item.quantity}</p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Discount & Notes */}
              {!isLoadingItems && billableItems.length > 0 && (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Discount (₦)
                      </label>
                      <input
                        type="number"
                        value={discount || ''}
                        onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                        min="0"
                        placeholder="0"
                        className="input w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Notes
                      </label>
                      <input
                        type="text"
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="Optional notes..."
                        className="input w-full"
                      />
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="border-t pt-3 space-y-1 mb-4">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Subtotal ({selectedItems.length} items)</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Discount</span>
                        <span>-{formatCurrency(discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-base pt-1 border-t">
                      <span>Total</span>
                      <span>{formatCurrency(total)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="btn btn-secondary">Cancel</button>
          {step === 'preview' && !isLoadingItems && selectedItems.length > 0 && (
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="btn btn-primary flex items-center gap-2"
            >
              <Receipt className="w-4 h-4" />
              {isGenerating ? 'Generating...' : `Generate Invoice (${formatCurrency(total)})`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GenerateInvoiceModal;