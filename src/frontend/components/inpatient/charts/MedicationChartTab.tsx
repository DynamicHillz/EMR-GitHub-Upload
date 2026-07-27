import React, { useState } from 'react';
import InpatientService from '../../../services/InpatientService';
import Dropdown from '../../common/Dropdown';

interface Props {
  data: any[];
  activePrescriptions?: any[];
  admissionId: string;
  onReload: () => void;
  isReadonly?: boolean;
}

const formatRelativeTime = (isoDate: string) => {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
};

const getRouteLabels = (route: string) => {
  switch (route) {
    case 'TOPICAL':
      return { dosageLabel: 'Application Amount', dosagePlaceholder: 'e.g., Apply thin layer' };
    case 'OPHTHALMIC':
    case 'OTIC':
      return { dosageLabel: 'Drops per Dose', dosagePlaceholder: 'e.g., 2 drops' };
    case 'INTRAVENOUS':
    case 'INTRAMUSCULAR':
    case 'SUBCUTANEOUS':
      return { dosageLabel: 'Dose', dosagePlaceholder: 'e.g., 1g, 500mg' };
    case 'INHALATION':
      return { dosageLabel: 'Puffs/Dose', dosagePlaceholder: 'e.g., 2 puffs' };
    case 'RECTAL':
    case 'VAGINAL':
      return { dosageLabel: 'Dose', dosagePlaceholder: 'e.g., 1 suppository' };
    default:
      return { dosageLabel: 'Dose', dosagePlaceholder: 'e.g., 500mg, 10ml' };
  }
};

const MedicationChartTab: React.FC<Props> = ({ data, activePrescriptions = [], admissionId, onReload, isReadonly = false }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    medicationName: '',
    dosage: '',
    route: 'ORAL',
    status: 'COMPLETED',
    omissionReason: '',
    notes: '',
    prescriptionId: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await InpatientService.addMedicationAdministration(admissionId, {
        ...formData,
        prescriptionId: formData.prescriptionId || undefined
      });
      setFormData({ medicationName: '', dosage: '', route: 'ORAL', status: 'COMPLETED', omissionReason: '', notes: '', prescriptionId: '' });
      onReload();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to save medication record');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Active Orders Section */}
      {!isReadonly && activePrescriptions && activePrescriptions.length > 0 && (
        <div className="bg-white p-4 rounded-lg border border-primary-200 shadow-sm">
          <h3 className="font-semibold text-primary-900 mb-3 border-b pb-2 flex items-center">
            <svg className="w-5 h-5 mr-2 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
            Current Active Orders (from Ward Rounds)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activePrescriptions.map(prescription => {
              const ONE_DAY_MS = 24 * 60 * 60 * 1000;
              const now = Date.now();
              const isCancelled = prescription.status === 'CANCELLED';
              const isNew = !isCancelled && prescription.createdAt && now - new Date(prescription.createdAt).getTime() < ONE_DAY_MS;
              const isRecentlyDiscontinued = isCancelled && prescription.updatedAt && now - new Date(prescription.updatedAt).getTime() < ONE_DAY_MS;

              return (
              <div
                key={prescription.id}
                className={`p-3 rounded-lg border flex flex-col justify-between ${
                  isRecentlyDiscontinued
                    ? 'bg-red-100 border-2 border-red-500'
                    : isCancelled
                    ? 'bg-red-50 border-red-200 opacity-75'
                    : isNew
                    ? 'bg-green-50 border-2 border-green-500 animate-pulse'
                    : 'bg-blue-50 border-blue-200'
                }`}
              >
                <div>
                  {isRecentlyDiscontinued && (
                    <div className="-mx-3 -mt-3 mb-2 px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-t-lg flex items-center gap-1">
                      ⚠ DISCONTINUED {formatRelativeTime(prescription.updatedAt)}
                    </div>
                  )}
                  {isNew && (
                    <div className="-mx-3 -mt-3 mb-2 px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-t-lg flex items-center gap-1">
                      ✚ NEW ORDER {formatRelativeTime(prescription.createdAt)}
                    </div>
                  )}
                  <div className="flex justify-between items-start mb-1">
                    <span className={`font-semibold flex flex-wrap items-center gap-2 ${isCancelled ? 'line-through text-red-700' : 'text-blue-900'}`}>
                      {prescription.medicationName}
                      {prescription.type === 'OUTPATIENT' && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-800 font-semibold no-underline">
                          OUTPATIENT
                        </span>
                      )}
                      {prescription.type === 'INPATIENT' && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800 font-semibold no-underline">
                          INPATIENT
                        </span>
                      )}
                    </span>
                    {isCancelled && !isRecentlyDiscontinued && (
                      <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-medium ml-2">Discontinued</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 font-medium">{prescription.dosage} - {prescription.frequency}</p>
                  <p className="text-xs text-gray-500 mt-1">Duration: {prescription.duration}</p>
                  {prescription.instructions && (
                    <p className="text-xs text-gray-600 italic mt-1 bg-white p-1 rounded bg-opacity-50">"{prescription.instructions}"</p>
                  )}
                </div>
                {prescription.status !== 'CANCELLED' && (
                  <button
                    type="button"
                    onClick={() => {
                      // Pre-fill form
                      setFormData({
                        ...formData,
                        medicationName: prescription.medicationName,
                        dosage: prescription.dosage,
                        prescriptionId: prescription.id
                      });
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="mt-3 text-xs bg-white border border-blue-300 text-blue-700 hover:bg-blue-100 py-1.5 px-3 rounded-md transition-colors w-full"
                  >
                    Record Administration
                  </button>
                )}
              </div>
              );
            })}
          </div>
        </div>
      )}

      {!isReadonly && (
        <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h3 className="font-medium text-gray-800 mb-4">Record Medication Administration</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 items-end">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700">Medication Name</label>
            <input type="text" required className="mt-1 block w-full px-3 py-2 rounded-md border-2 border-gray-300 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none sm:text-sm" value={formData.medicationName} onChange={e => setFormData({...formData, medicationName: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">{getRouteLabels(formData.route).dosageLabel}</label>
            <input type="text" placeholder={getRouteLabels(formData.route).dosagePlaceholder} required className="mt-1 block w-full px-3 py-2 rounded-md border-2 border-gray-300 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none sm:text-sm" value={formData.dosage} onChange={e => setFormData({...formData, dosage: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">Route</label>
            <Dropdown required className="mt-1 block w-full px-3 py-2 rounded-md border-2 border-gray-300 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none sm:text-sm" value={formData.route} onChange={e => setFormData({...formData, route: e.target.value})}>
              <option value="ORAL">Oral (Tablet, Syrup)</option>
              <option value="INTRAVENOUS">Intravenous (IV)</option>
              <option value="INTRAMUSCULAR">Intramuscular (IM)</option>
              <option value="SUBCUTANEOUS">Subcutaneous (SC)</option>
              <option value="TOPICAL">Topical (Ointment, Cream)</option>
              <option value="OPHTHALMIC">Ophthalmic (Eye Drops)</option>
              <option value="OTIC">Otic (Ear Drops)</option>
              <option value="INHALATION">Inhalation</option>
              <option value="RECTAL">Rectal (Suppository)</option>
              <option value="SUBLINGUAL">Sublingual</option>
              <option value="NASAL">Nasal</option>
              <option value="VAGINAL">Vaginal</option>
              <option value="OTHER">Other</option>
              {formData.route && !['ORAL','INTRAVENOUS','INTRAMUSCULAR','SUBCUTANEOUS','TOPICAL','OPHTHALMIC','OTIC','INHALATION','RECTAL','SUBLINGUAL','NASAL','VAGINAL','OTHER'].includes(formData.route) && (
                <option value={formData.route}>{formData.route}</option>
              )}
            </Dropdown>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">Status</label>
            <Dropdown className="mt-1 block w-full px-3 py-2 rounded-md border-2 border-gray-300 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none sm:text-sm" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
              <option value="COMPLETED">Given</option>
              <option value="REFUSED">Refused</option>
              <option value="MISSED">Omitted / Missed</option>
            </Dropdown>
          </div>
          <button type="submit" disabled={loading} className="w-full px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700">
            {loading ? 'Saving...' : 'Record'}
          </button>
        </div>
        {formData.status !== 'COMPLETED' && (
          <div className="mt-4 flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700">Reason for omission/refusal</label>
              <input type="text" required className="mt-1 block w-full px-3 py-2 rounded-md border-2 border-gray-300 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none sm:text-sm" value={formData.omissionReason} onChange={e => setFormData({...formData, omissionReason: e.target.value})} />
            </div>
          </div>
        )}
      </form>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date/Time</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Medication</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dose / Route</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Administered By</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((record: any) => (
              <tr key={record.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(record.administeredAt).toLocaleString()}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{record.medicationName}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{record.dosage} / {record.route || 'Oral'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {record.status === 'COMPLETED' ? (
                    <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">Given</span>
                  ) : (
                    <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-800">{record.status}: {record.omissionReason}</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{record.administeredBy?.firstName} {record.administeredBy?.lastName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MedicationChartTab;
