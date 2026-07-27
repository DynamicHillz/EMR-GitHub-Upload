/**
 * Generate Invoice Modal
 *
 * Allows cashier to auto-generate an invoice for a patient by pulling in:
 * - Dispensed prescriptions (priced from batch selling price)
 * - Completed/reviewed lab tests (priced from service catalog)
 * - Finalized consultations (priced from service catalog)
 * - Unbilled inpatient admissions (room charge + administered medications)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, Search, Receipt, Pill, TestTube, FileText, AlertCircle, BedDouble, Package, Plus, Trash2 } from 'lucide-react';
import { useToast } from '../ToastContainer';
import ConfirmDialog from '../common/ConfirmDialog';
import { useConfirm } from '../../hooks/useConfirm';
import { billingService } from '../../services/billing.service';
import { getErrorMessage } from '../../utils/errorHandler';

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
  type: 'PRESCRIPTION' | 'LAB_TEST' | 'CONSULTATION' | 'ADMISSION' | 'CONSUMABLE' | 'TRANSFUSION' | 'SURGERY' | 'LABOR';
  description: string;
  detail: string;
  quantity: number;
  unitPrice: number;
  total: number;
  selected: boolean;
}

interface ManualItem {
  id: string;
  serviceName: string;
  quantity: number;
  unitPrice: number;
}

interface GenerateInvoiceModalProps {
  onClose: () => void;
  onSuccess: (invoiceId: string) => void;
  initialPatient?: Patient;
}

const GenerateInvoiceModal: React.FC<GenerateInvoiceModalProps> = ({ onClose, onSuccess, initialPatient }) => {
  const toast = useToast();
  const { confirm, isOpen: confirmIsOpen, options: confirmOptions, loading: confirmLoading, handleConfirm, handleCancel } = useConfirm();

  const [step, setStep] = useState<'search' | 'preview'>(initialPatient ? 'preview' : 'search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(initialPatient || null);
  const [billableItems, setBillableItems] = useState<BillableItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState(0);
  const [error, setError] = useState('');

  // Extra, not-tracked-elsewhere charges (e.g. a documentation fee, a
  // one-off procedure) the cashier adds directly onto this invoice —
  // separate from the auto-pulled prescriptions/labs/consultations/etc.
  const [manualItems, setManualItems] = useState<ManualItem[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('1');
  const [newItemPrice, setNewItemPrice] = useState('');

  const addManualItem = () => {
    const quantity = parseInt(newItemQty, 10);
    const unitPrice = parseFloat(newItemPrice);
    if (!newItemName.trim() || !quantity || quantity < 1 || !unitPrice || unitPrice <= 0) return;

    setManualItems(prev => [
      ...prev,
      { id: `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`, serviceName: newItemName.trim(), quantity, unitPrice },
    ]);
    setNewItemName('');
    setNewItemQty('1');
    setNewItemPrice('');
  };

  const removeManualItem = (id: string) => {
    setManualItems(prev => prev.filter(i => i.id !== id));
  };

  const searchPatients = useCallback(async (query: string) => {
    if (query.length < 2) { setSearchResults([]); return; }
    setIsSearching(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${window.location.protocol}//${window.location.hostname}:3000/api/patients/search?query=${encodeURIComponent(query)}&lite=true`,
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

  useEffect(() => {
    if (initialPatient) {
      fetchBillableItems(initialPatient);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchBillableItems = async (patient: Patient) => {
    setIsLoadingItems(true);
    setError('');
    const token = localStorage.getItem('token');
    const API_BASE_URL = `${window.location.protocol}//${window.location.hostname}:3000/api`;

    try {
      // Fetch dispensed prescriptions, completed lab tests, finalized consultations,
      // unbilled inpatient admissions (room + administered drugs), unbilled
      // consumable usage (syringes, gloves, gauze, etc.), and unbilled
      // transfusions/surgeries/deliveries in parallel
      const [presRes, labRes, conRes, admRes, consumableRes, transfusionRes, operationRes, laborRes] = await Promise.all([
        fetch(`${API_BASE_URL}/pharmacy/prescriptions?billingStatus=UNBILLED&patientId=${patient.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/lab/tests?billingStatus=UNBILLED&status=ALL&patientId=${patient.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/consultations/patient/${patient.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/inpatients/admissions/billable?patientId=${patient.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/pharmacy/consumables/usage?billingStatus=UNBILLED&patientId=${patient.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/inpatients/transfusions/billable?patientId=${patient.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/inpatients/operation-notes/billable?patientId=${patient.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/labor/records/billable?patientId=${patient.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const [presData, labData, conData, admData, consumableData, transfusionData, operationData, laborData] = await Promise.all([
        presRes.json(),
        labRes.json(),
        conRes.json(),
        admRes.json(),
        consumableRes.json(),
        transfusionRes.json(),
        operationRes.json(),
        laborRes.json(),
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

      // Unbilled lab tests
      const labTests = labData.data || labData.tests || [];
      const labOrdersMap = new Map<string, any>();
      
      for (const l of labTests) {
        const orderId = l.orderId || l.id;
        const unitPrice = l.price || l.unitPrice || 2000;
        
        if (labOrdersMap.has(orderId)) {
          const existing = labOrdersMap.get(orderId);
          existing.description += `, ${l.testName}`;
          existing.unitPrice += unitPrice;
          existing.total += unitPrice;
        } else {
          labOrdersMap.set(orderId, {
            id: orderId,
            type: 'LAB_TEST',
            description: l.testName,
            detail: `Lab Order — ${l.status}`,
            quantity: 1,
            unitPrice,
            total: unitPrice,
            selected: true,
          });
        }
      }
      
      items.push(...Array.from(labOrdersMap.values()));

      // Finalized consultations
      const consultations = conData.data || [];
      for (const c of consultations) {
        if (c.status !== 'COMPLETED' || c.billingStatus !== 'UNBILLED') continue;
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

      // Unbilled admissions — aggregate the room + administered-drug lines
      // getBillableAdmissions returns per admissionId into a single selectable
      // item, since the invoice is generated per-admission on the backend.
      const admissionLines = admData.data || [];
      const admissionsMap = new Map<string, { description: string; total: number }>();
      for (const line of admissionLines) {
        const existing = admissionsMap.get(line.admissionId);
        if (existing) {
          existing.total += line.total;
        } else {
          admissionsMap.set(line.admissionId, {
            description: line.type === 'INPATIENT_ROOM' ? line.description : `Admission ${line.admissionId.slice(0, 8)}`,
            total: line.total,
          });
        }
      }
      for (const [admissionId, summary] of admissionsMap.entries()) {
        items.push({
          id: admissionId,
          type: 'ADMISSION',
          description: summary.description,
          detail: 'Room charge + administered medications for this stay',
          quantity: 1,
          unitPrice: summary.total,
          total: summary.total,
          selected: true,
        });
      }

      // Unbilled consumable usage (syringes, gloves, gauze, cannula, etc.)
      const consumableUsage = consumableData.data || [];
      for (const u of consumableUsage) {
        items.push({
          id: u.id,
          type: 'CONSUMABLE',
          description: u.consumableName,
          detail: `${u.quantityUsed} ${u.unit} used`,
          quantity: u.quantityUsed,
          unitPrice: u.unitPrice,
          total: u.total,
          selected: true,
        });
      }

      // Unbilled blood transfusions (one row = one unit/bag already)
      const transfusions = transfusionData.data || [];
      for (const t of transfusions) {
        items.push({
          id: t.id,
          type: 'TRANSFUSION',
          description: t.description,
          detail: t.detail,
          quantity: t.quantity,
          unitPrice: t.unitPrice,
          total: t.total,
          selected: true,
        });
      }

      // Unbilled surgeries (Operation Notes)
      const operations = operationData.data || [];
      for (const op of operations) {
        items.push({
          id: op.id,
          type: 'SURGERY',
          description: op.description,
          detail: op.detail,
          quantity: op.quantity,
          unitPrice: op.unitPrice,
          total: op.total,
          selected: true,
        });
      }

      // Unbilled labour & delivery (only delivered records are billable)
      const laborRecords = laborData.data || [];
      for (const l of laborRecords) {
        items.push({
          id: l.id,
          type: 'LABOR',
          description: l.description,
          detail: l.detail,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          total: l.total,
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
  const manualItemsTotal = manualItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const subtotal = selectedItems.reduce((sum, i) => sum + i.total, 0) + manualItemsTotal;
  const total = Math.max(0, subtotal - discount);
  const totalItemCount = selectedItems.length + manualItems.length;

  const handleGenerate = async () => {
    if (totalItemCount === 0) {
      toast.error('No Items Selected', 'Please select at least one item, or add a charge, to invoice.');
      return;
    }

    const confirmed = await confirm({
      title: 'Generate Invoice',
      message: `Create an invoice for ${selectedPatient?.fullName} totaling ${formatCurrency(total)} across ${totalItemCount} item(s)? This creates a real financial record.`,
      confirmText: 'Generate Invoice',
      cancelText: 'Review Again',
      variant: 'warning',
    });
    if (!confirmed) return;

    setIsGenerating(true);
    try {
      const prescriptionIds = selectedItems
        .filter(i => i.type === 'PRESCRIPTION').map(i => i.id);
      const labTestIds = selectedItems
        .filter(i => i.type === 'LAB_TEST').map(i => i.id);
      const consultationIds = selectedItems
        .filter(i => i.type === 'CONSULTATION').map(i => i.id);
      const admissionIds = selectedItems
        .filter(i => i.type === 'ADMISSION').map(i => i.id);
      const consumableUsageIds = selectedItems
        .filter(i => i.type === 'CONSUMABLE').map(i => i.id);
      const transfusionChartIds = selectedItems
        .filter(i => i.type === 'TRANSFUSION').map(i => i.id);
      const operationNoteIds = selectedItems
        .filter(i => i.type === 'SURGERY').map(i => i.id);
      const laborRecordIds = selectedItems
        .filter(i => i.type === 'LABOR').map(i => i.id);

      const invoice = await billingService.generateInvoice({
        patientId: selectedPatient!.id,
        prescriptionIds: prescriptionIds.length ? prescriptionIds : undefined,
        labTestIds: labTestIds.length ? labTestIds : undefined,
        consultationIds: consultationIds.length ? consultationIds : undefined,
        admissionIds: admissionIds.length ? admissionIds : undefined,
        consumableUsageIds: consumableUsageIds.length ? consumableUsageIds : undefined,
        transfusionChartIds: transfusionChartIds.length ? transfusionChartIds : undefined,
        operationNoteIds: operationNoteIds.length ? operationNoteIds : undefined,
        laborRecordIds: laborRecordIds.length ? laborRecordIds : undefined,
        additionalItems: manualItems.length
          ? manualItems.map(i => ({ serviceName: i.serviceName, quantity: i.quantity, unitPrice: i.unitPrice }))
          : undefined,
        discount: discount || undefined,
        notes: notes || undefined,
      });

      toast.success('Invoice Generated', `Invoice ${invoice.invoiceNumber} created successfully.`);
      onSuccess(invoice.id);
    } catch (err: any) {
      toast.error('Failed', getErrorMessage(err, 'Could not generate invoice. Please try again.'));
    } finally {
      setIsGenerating(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

  const typeIcon = (type: BillableItem['type']) => {
    if (type === 'PRESCRIPTION') return <Pill className="w-4 h-4 text-blue-500" />;
    if (type === 'LAB_TEST') return <TestTube className="w-4 h-4 text-purple-500" />;
    if (type === 'ADMISSION') return <BedDouble className="w-4 h-4 text-orange-500" />;
    if (type === 'CONSUMABLE') return <Package className="w-4 h-4 text-teal-500" />;
    return <FileText className="w-4 h-4 text-green-500" />;
  };

  const typeBadge = (type: BillableItem['type']) => {
    if (type === 'PRESCRIPTION') return 'bg-blue-100 text-blue-700';
    if (type === 'LAB_TEST') return 'bg-purple-100 text-purple-700';
    if (type === 'ADMISSION') return 'bg-orange-100 text-orange-700';
    if (type === 'CONSUMABLE') return 'bg-teal-100 text-teal-700';
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
              Auto-pull dispensed prescriptions, lab tests, consultations, and admissions
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
                  onClick={() => { setStep('search'); setBillableItems([]); setError(''); setManualItems([]); setDiscount(0); setNotes(''); }}
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
                              {item.type === 'PRESCRIPTION' ? 'Drug' : item.type === 'LAB_TEST' ? 'Lab' : item.type === 'ADMISSION' ? 'Admission' : item.type === 'CONSUMABLE' ? 'Consumable' : 'Consult'}
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

              {/* Additional Charges — manual line items not pulled from any
                  other module (e.g. a documentation fee, a one-off procedure) */}
              {!isLoadingItems && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Additional charges:</p>

                  {manualItems.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {manualItems.map(item => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg bg-white"
                        >
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-sm">{item.serviceName}</span>
                            <p className="text-xs text-gray-400">{formatCurrency(item.unitPrice)} × {item.quantity}</p>
                          </div>
                          <p className="font-semibold text-sm flex-shrink-0">
                            {formatCurrency(item.quantity * item.unitPrice)}
                          </p>
                          <button
                            type="button"
                            onClick={() => removeManualItem(item.id)}
                            className="text-gray-400 hover:text-red-600 flex-shrink-0"
                            aria-label="Remove charge"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-end gap-2 p-3 border border-dashed border-gray-300 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                      <input
                        type="text"
                        value={newItemName}
                        onChange={e => setNewItemName(e.target.value)}
                        placeholder="e.g., Documentation fee"
                        className="input w-full text-sm"
                      />
                    </div>
                    <div className="w-16">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Qty</label>
                      <input
                        type="number"
                        value={newItemQty}
                        onChange={e => setNewItemQty(e.target.value)}
                        min="1"
                        className="input w-full text-sm"
                      />
                    </div>
                    <div className="w-28">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Unit Price (₦)</label>
                      <input
                        type="number"
                        value={newItemPrice}
                        onChange={e => setNewItemPrice(e.target.value)}
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        className="input w-full text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={addManualItem}
                      className="btn btn-secondary flex items-center gap-1 flex-shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </button>
                  </div>
                </div>
              )}

              {/* Discount & Notes */}
              {!isLoadingItems && (billableItems.length > 0 || manualItems.length > 0) && (
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
                      <span>Subtotal ({totalItemCount} items)</span>
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
          {step === 'preview' && !isLoadingItems && totalItemCount > 0 && (
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

      <ConfirmDialog
        isOpen={confirmIsOpen}
        onClose={handleCancel}
        onConfirm={handleConfirm}
        title={confirmOptions.title}
        message={confirmOptions.message}
        confirmText={confirmOptions.confirmText}
        cancelText={confirmOptions.cancelText}
        variant={confirmOptions.variant}
        loading={confirmLoading}
      />
    </div>
  );
};

export default GenerateInvoiceModal;