/**
 * Unbilled Queue Page
 *
 * Clinic-wide worklist of patients with billable items (dispensed
 * prescriptions, lab orders, finalized consultations) not yet invoiced.
 * Lets a cashier work the backlog without already knowing which patient
 * to search for, reusing the existing GenerateInvoiceModal flow.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Pill, TestTube, FileText, Receipt } from 'lucide-react';
import billingService from '../../services/billing.service';
import GenerateInvoiceModal from '../../components/billing/GenerateInvoiceModal';

interface UnbilledPatient {
  patientDbId: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  prescriptionCount: number;
  labOrderCount: number;
  consultationCount: number;
  itemCount: number;
  oldestItemDate: string;
}

const UnbilledQueuePage: React.FC = () => {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<UnbilledPatient[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [invoicingPatient, setInvoicingPatient] = useState<UnbilledPatient | null>(null);

  const loadQueue = async () => {
    try {
      setLoading(true);
      const result = await billingService.getUnbilledQueue();
      setPatients(result.patients);
      setTotalItems(result.totalItems);
    } catch (err) {
      console.error('Failed to load unbilled queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' });

  const daysWaiting = (dateString: string) => {
    const diff = Date.now() - new Date(dateString).getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-primary-600" />
          Unbilled Queue
        </h1>
        <p className="text-gray-600 mt-1">
          Patients with dispensed prescriptions, lab orders, or finalized consultations awaiting an invoice
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <p className="text-sm text-gray-500">Patients Waiting</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{patients.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <p className="text-sm text-gray-500">Unbilled Items</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalItems}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4 col-span-2 sm:col-span-1">
          <p className="text-sm text-gray-500">Oldest Item</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {patients.length > 0 ? `${daysWaiting(patients[0].oldestItemDate)}d` : '—'}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading queue...</div>
        ) : patients.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Receipt className="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <p>No unbilled items — everything is invoiced.</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unbilled Items</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Waiting Since</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {patients.map((p) => (
                <tr key={p.patientDbId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div
                      className="font-medium text-primary-700 hover:underline cursor-pointer"
                      onClick={() => navigate(`/patients?patientId=${p.patientDbId}`)}
                    >
                      {p.patientName}
                    </div>
                    <div className="text-sm text-gray-500">{p.patientId} · {p.patientPhone}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3 text-sm text-gray-700">
                      {p.prescriptionCount > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Pill className="w-3.5 h-3.5 text-blue-500" /> {p.prescriptionCount}
                        </span>
                      )}
                      {p.labOrderCount > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <TestTube className="w-3.5 h-3.5 text-purple-500" /> {p.labOrderCount}
                        </span>
                      )}
                      {p.consultationCount > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5 text-green-500" /> {p.consultationCount}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={daysWaiting(p.oldestItemDate) >= 3 ? 'text-red-600 font-medium' : 'text-gray-500'}>
                      {formatDate(p.oldestItemDate)} ({daysWaiting(p.oldestItemDate)}d)
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button
                      onClick={() => setInvoicingPatient(p)}
                      className="btn btn-primary text-sm flex items-center gap-1.5 ml-auto"
                    >
                      <Receipt className="w-4 h-4" />
                      Generate Invoice
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {invoicingPatient && (
        <GenerateInvoiceModal
          initialPatient={{
            id: invoicingPatient.patientDbId,
            patientId: invoicingPatient.patientId,
            firstName: invoicingPatient.patientName.split(' ')[0] || invoicingPatient.patientName,
            lastName: invoicingPatient.patientName.split(' ').slice(1).join(' '),
            fullName: invoicingPatient.patientName,
            age: 0,
            phone: invoicingPatient.patientPhone,
          }}
          onClose={() => setInvoicingPatient(null)}
          onSuccess={(invoiceId) => {
            setInvoicingPatient(null);
            navigate(`/billing/invoices/${invoiceId}`);
          }}
        />
      )}
    </div>
  );
};

export default UnbilledQueuePage;
