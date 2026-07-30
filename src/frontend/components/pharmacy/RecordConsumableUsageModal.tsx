/**
 * Record Consumable Usage Modal
 *
 * Single-step logging of a consumable (syringe, gloves, gauze, cannula,
 * oxygen, etc.) used on a patient — deducts stock and creates an unbilled
 * charge for invoice generation to pick up later. No prescription/allergy
 * checks, since these aren't drugs.
 *
 * Self-fetches the consumable catalog/inventory (rather than taking them as
 * props) so it can be dropped in anywhere as a quick action — Triage,
 * Consultation, Ward Rounds — not just from the main Consumables page.
 * `patientId`/`patientLabel` pre-fill the patient (skipping the search step)
 * when opened from a screen that already has one selected; `admissionId`/
 * `consultationId` thread through so the usage record is correctly linked
 * to that context; `lockToCategory` (e.g. "Oxygen") pre-filters the
 * consumable picker and reveals the extra clinical fields (flow rate,
 * delivery method, SpO2 before/after) that only make sense for that
 * category.
 */

import React, { useState, useEffect } from 'react';
import { X, Package, Search } from 'lucide-react';
import Dropdown from '../common/Dropdown';
import { getErrorMessage } from '../../utils/errorHandler';
import { Consumable, ConsumableInventoryItem } from '../../types/pharmacy';

interface PatientResult {
  id: string;
  name: string;
  patientNumber: string;
}

const DELIVERY_METHODS = ['Nasal Cannula', 'Face Mask', 'Non-Rebreather Mask', 'CPAP/BiPAP'];

interface RecordConsumableUsageModalProps {
  /** Only meaningful for the default 'modal' variant — 'inline' callers
   * control mounting themselves (see ConsultationModal.tsx's Prescription/
   * LabTest quick actions for the same pattern) and can omit this. */
  isOpen?: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** Pre-fill the patient (skips the search step) — id + display label. */
  patientId?: string;
  patientLabel?: string;
  admissionId?: string;
  consultationId?: string;
  /** e.g. "Oxygen" — pre-filters the consumable picker to that category. */
  lockToCategory?: string;
  /** 'modal' (default): fixed full-screen overlay. 'inline': an embedded
   * panel rendered in normal page flow — matches PrescriptionModal/
   * LabTestModal's inline variant, used when this is a quick action inside
   * another already-open modal (e.g. Consultation) rather than its own
   * popup stacked on top. */
  variant?: 'modal' | 'inline';
}

function isBatchExpired(expiryDate: string | null): boolean {
  return !!expiryDate && new Date(expiryDate).getTime() < Date.now();
}

const RecordConsumableUsageModal: React.FC<RecordConsumableUsageModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  patientId: initialPatientId,
  patientLabel: initialPatientLabel,
  admissionId,
  consultationId,
  lockToCategory,
  variant = 'modal',
}) => {
  const isInline = variant === 'inline';
  // Inline callers control mounting themselves (rendered via `{show && <.../>}`,
  // same as PrescriptionModal/LabTestModal), so there's no separate "closed"
  // state to gate on the way the modal variant's `isOpen` prop does.
  const active = isInline || !!isOpen;
  const [consumables, setConsumables] = useState<Consumable[]>([]);
  const [inventory, setInventory] = useState<ConsumableInventoryItem[]>([]);

  const [patientSearch, setPatientSearch] = useState('');
  const [patients, setPatients] = useState<PatientResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [patientId, setPatientId] = useState('');

  const [consumableId, setConsumableId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [quantityUsed, setQuantityUsed] = useState<number>(1);
  const [notes, setNotes] = useState('');
  const [flowRateLpm, setFlowRateLpm] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState('');
  const [spO2Before, setSpO2Before] = useState('');
  const [spO2After, setSpO2After] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const availableBatches = inventory.find((i) => i.consumableId === consumableId)?.batches || [];
  const selectedBatch = availableBatches.find((b) => b.id === batchId);
  const selectedBatchExpired = !!selectedBatch && isBatchExpired(selectedBatch.expiryDate);
  const selectedConsumable = consumables.find((c) => c.id === consumableId);
  const isOxygen = (selectedConsumable?.category || lockToCategory) === 'Oxygen';
  const filteredConsumables = lockToCategory ? consumables.filter((c) => c.category === lockToCategory) : consumables;

  useEffect(() => {
    if (active) {
      fetchConsumables();
      fetchInventory();
      setPatientId(initialPatientId || '');
      setPatientSearch(initialPatientLabel || '');
    } else {
      // Reset on close so the next open starts fresh
      setPatientSearch('');
      setPatients([]);
      setPatientId('');
      setConsumableId('');
      setBatchId('');
      setQuantityUsed(1);
      setNotes('');
      setFlowRateLpm('');
      setDeliveryMethod('');
      setSpO2Before('');
      setSpO2After('');
      setError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const fetchConsumables = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${window.location.protocol}//${window.location.hostname}:3000/api/pharmacy/consumables`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const result = await response.json();
        setConsumables(result.data || []);
      }
    } catch (err) {
      console.error('Error fetching consumables:', err);
    }
  };

  const fetchInventory = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${window.location.protocol}//${window.location.hostname}:3000/api/pharmacy/consumables/inventory`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const result = await response.json();
        setInventory(result.data || []);
      }
    } catch (err) {
      console.error('Error fetching consumable inventory:', err);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => searchPatients(patientSearch), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientSearch]);

  const searchPatients = async (query: string) => {
    if (query.length < 2 || patientId) {
      setPatients([]);
      return;
    }
    setIsSearching(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${window.location.protocol}//${window.location.hostname}:3000/api/patients/search?query=${encodeURIComponent(query)}&lite=true`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.ok) {
        const result = await response.json();
        setPatients(
          (result.data || []).map((p: any) => ({
            id: p.id,
            name: `${p.firstName} ${p.lastName}`,
            patientNumber: p.patientId,
          }))
        );
      }
    } catch (err) {
      console.error('Error searching patients:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleConsumableChange = (id: string) => {
    setConsumableId(id);
    const batches = inventory.find((i) => i.consumableId === id)?.batches || [];
    // Auto-select first non-expired batch with sufficient quantity — same
    // FEFO-ordered pattern as DispenseModal for medications.
    const available = batches.find((b) => b.quantity >= quantityUsed && !isBatchExpired(b.expiryDate));
    setBatchId(available ? available.id : '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!patientId) {
      setError('Please select a patient');
      return;
    }
    if (!consumableId || !batchId) {
      setError(`Please select ${lockToCategory ? lockToCategory.toLowerCase() : 'a consumable'} and a batch`);
      return;
    }
    if (quantityUsed <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }
    if (selectedBatch && quantityUsed > selectedBatch.quantity) {
      setError(`Insufficient stock. Available: ${selectedBatch.quantity}`);
      return;
    }
    if (selectedBatchExpired) {
      setError('This batch has expired and cannot be used. Please select a different batch.');
      return;
    }
    if (isOxygen && (spO2Before !== '' && (Number(spO2Before) < 0 || Number(spO2Before) > 100))) {
      setError('SpO2 Before must be between 0 and 100');
      return;
    }
    if (isOxygen && (spO2After !== '' && (Number(spO2After) < 0 || Number(spO2After) > 100))) {
      setError('SpO2 After must be between 0 and 100');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${window.location.protocol}//${window.location.hostname}:3000/api/pharmacy/consumables/usage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          patientId,
          consumableId,
          batchId,
          quantityUsed,
          admissionId: admissionId || undefined,
          consultationId: consultationId || undefined,
          notes: notes || undefined,
          ...(isOxygen && {
            flowRateLpm: flowRateLpm ? parseFloat(flowRateLpm) : undefined,
            deliveryMethod: deliveryMethod || undefined,
            spO2Before: spO2Before ? parseInt(spO2Before) : undefined,
            spO2After: spO2After ? parseInt(spO2After) : undefined,
          }),
        }),
      });

      const result = await response.json();

      if (response.ok) {
        onSuccess();
        onClose();
      } else {
        setError(result.message || 'Failed to record usage');
      }
    } catch (err: any) {
      setError(getErrorMessage(err, 'An error occurred'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!active) return null;

  const outerClass = isInline
    ? 'mt-4 p-4 border border-sky-200 bg-sky-50 rounded-lg'
    : 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
  const cardClass = isInline ? '' : 'bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto';

  return (
    <div className={outerClass}>
      <div className={cardClass}>
        {isInline ? (
          <div className="flex items-center justify-between mb-4">
            <h5 className="font-medium text-sky-900 text-sm flex items-center gap-2">
              <Package className="w-4 h-4" />
              {lockToCategory ? `Record ${lockToCategory} Administration` : 'Record Consumable Usage'}
            </h5>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Package className="w-6 h-6 text-purple-600" />
              {lockToCategory ? `Record ${lockToCategory} Administration` : 'Record Consumable Usage'}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className={isInline ? 'space-y-4' : 'p-6 space-y-4'}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>
          )}

          {/* Patient */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Patient <span className="text-red-500">*</span>
            </label>
            {initialPatientId ? (
              <div className="p-2 border border-gray-200 rounded-md bg-gray-50 text-sm font-medium">
                {patientSearch}
              </div>
            ) : patientId ? (
              <div className="flex items-center justify-between p-2 border border-gray-200 rounded-md bg-gray-50">
                <span className="text-sm font-medium">{patientSearch}</span>
                <button
                  type="button"
                  onClick={() => { setPatientId(''); setPatientSearch(''); }}
                  className="text-xs text-primary-600 hover:underline"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder="Search by name or patient number..."
                  className="input pl-9 w-full"
                />
                {isSearching && (
                  <div className="absolute right-3 top-3">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600" />
                  </div>
                )}
                {patients.length > 0 && (
                  <div className="mt-1 border border-gray-200 rounded-md max-h-40 overflow-y-auto">
                    {patients.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setPatientId(p.id);
                          setPatientSearch(`${p.name} (${p.patientNumber})`);
                          setPatients([]);
                        }}
                        className="p-2 hover:bg-gray-50 cursor-pointer text-sm border-b last:border-b-0"
                      >
                        <span className="font-medium">{p.name}</span>{' '}
                        <span className="text-gray-500">({p.patientNumber})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Consumable */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {lockToCategory || 'Consumable'} <span className="text-red-500">*</span>
            </label>
            <Dropdown
              value={consumableId}
              onChange={(e) => handleConsumableChange(e.target.value)}
              required
              className="input w-full"
            >
              <option value="">Select {lockToCategory ? lockToCategory.toLowerCase() : 'consumable'}...</option>
              {filteredConsumables.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.unit})
                </option>
              ))}
            </Dropdown>
            {lockToCategory && filteredConsumables.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">
                No catalog items found with category "{lockToCategory}" — add one from the Consumables page first.
              </p>
            )}
          </div>

          {/* Batch */}
          {consumableId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Batch <span className="text-red-500">*</span>
              </label>
              {availableBatches.length === 0 ? (
                <p className="text-sm text-red-600">No stock available for this consumable.</p>
              ) : (
                <div className="space-y-1">
                  {availableBatches.map((b) => {
                    const expired = isBatchExpired(b.expiryDate);
                    return (
                      <label
                        key={b.id}
                        className={`flex items-center justify-between p-2 border rounded-md text-sm ${
                          expired ? 'opacity-50 cursor-not-allowed border-gray-200' : 'cursor-pointer ' + (batchId === b.id ? 'border-primary-400 bg-primary-50' : 'border-gray-200')
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="batchId"
                            checked={batchId === b.id}
                            disabled={expired}
                            onChange={() => setBatchId(b.id)}
                          />
                          {b.batchNumber}
                          {b.expiryDate && (
                            <span className={expired ? 'text-red-600' : 'text-gray-500'}>
                              {expired ? ' (expired)' : ` (exp. ${new Date(b.expiryDate).toLocaleDateString()})`}
                            </span>
                          )}
                        </span>
                        <span className="text-gray-500">{b.quantity} in stock</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantity Used <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              value={quantityUsed}
              onChange={(e) => setQuantityUsed(parseInt(e.target.value) || 0)}
              required
              className="input w-full"
            />
          </div>

          {/* Oxygen-specific clinical detail */}
          {isOxygen && (
            <div className="grid grid-cols-2 gap-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Flow Rate (L/min)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={flowRateLpm}
                  onChange={(e) => setFlowRateLpm(e.target.value)}
                  placeholder="e.g. 4"
                  className="input w-full text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Delivery Method</label>
                <Dropdown
                  value={deliveryMethod}
                  onChange={(e) => setDeliveryMethod(e.target.value)}
                  className="input w-full text-sm"
                >
                  <option value="">Select...</option>
                  {DELIVERY_METHODS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </Dropdown>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">SpO2 Before (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={spO2Before}
                  onChange={(e) => setSpO2Before(e.target.value)}
                  placeholder="e.g. 88"
                  className="input w-full text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">SpO2 After (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={spO2After}
                  onChange={(e) => setSpO2After(e.target.value)}
                  placeholder="e.g. 96"
                  className="input w-full text-sm"
                />
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional — e.g. indication / procedure this was used for"
              className="input w-full"
            />
          </div>

          <div className={isInline ? 'flex justify-end gap-3 pt-2' : 'flex justify-end gap-3 pt-4 border-t'}>
            <button type="button" onClick={onClose} className="btn btn-secondary" disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Recording...' : 'Record Usage'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RecordConsumableUsageModal;
