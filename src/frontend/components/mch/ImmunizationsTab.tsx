import React, { useEffect, useState } from 'react';
import { immunizationService } from '../../services/immunization.service';
import { PatientImmunization } from '../../types/immunization';
import { formatDate } from '../../utils/formatters';
import Dropdown from '../common/Dropdown';

interface ImmunizationsTabProps {
  patientId: string;
}

const ImmunizationsTab: React.FC<ImmunizationsTabProps> = ({ patientId }) => {
  const [immunizations, setImmunizations] = useState<PatientImmunization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({ scheduleId: '', batchNumber: '', notes: '' });

  useEffect(() => {
    const fetchImms = async () => {
      try {
        const [immsData, schedData] = await Promise.all([
          immunizationService.getPatientImmunizations(patientId),
          immunizationService.getSchedule()
        ]);
        setImmunizations(immsData);
        setSchedules(schedData);
      } catch (error) {
        console.error('Failed to load immunizations', error);
      } finally {
        setLoading(false);
      }
    };
    fetchImms();
  }, [patientId]);

  if (loading) {
    return <div className="p-4 text-center text-gray-500">Loading Immunization Data...</div>;
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-medium text-gray-900">Immunization History</h3>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700"
        >
          Record Vaccine Dose
        </button>
      </div>

      {immunizations.length === 0 ? (
        <p className="text-gray-500 italic">No immunizations recorded.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vaccine</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target Disease</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch #</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Administered By</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {immunizations.map((imm) => (
                <tr key={imm.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(imm.administeredAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {imm.schedule?.vaccineName || 'Unknown'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {imm.schedule?.diseaseTarget || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {imm.batchNumber || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {imm.administeredBy ? `${imm.administeredBy.firstName} ${imm.administeredBy.lastName}` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Record Vaccine Dose</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setSubmitting(true);
              try {
                const newDose = await immunizationService.recordImmunization(patientId, formData);
                setImmunizations([newDose, ...immunizations]);
                setShowModal(false);
                setFormData({ scheduleId: '', batchNumber: '', notes: '' });
              } catch (error: any) {
                console.error(error);
                alert(error.response?.data?.message || 'Failed to record dose');
              } finally {
                setSubmitting(false);
              }
            }}>
              <div className="mb-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Vaccine *</label>
                  <Dropdown 
                    value={formData.scheduleId} 
                    onChange={e => setFormData({...formData, scheduleId: e.target.value})} 
                    className="input w-full" 
                    required
                  >
                    <option value="">Select Vaccine</option>
                    {schedules.map(s => (
                      <option key={s.id} value={s.id}>{s.vaccineName} ({s.diseaseTarget})</option>
                    ))}
                  </Dropdown>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Batch Number</label>
                  <input type="text" value={formData.batchNumber} onChange={e => setFormData({...formData, batchNumber: e.target.value})} className="input w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Notes</label>
                  <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="input w-full" rows={3}></textarea>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary" disabled={submitting}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting || !formData.scheduleId}>{submitting ? 'Saving...' : 'Save Dose'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImmunizationsTab;
