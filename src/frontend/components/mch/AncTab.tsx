import React, { useEffect, useState } from 'react';
import { ancService } from '../../services/anc.service';
import { AncPregnancy } from '../../types/anc';
import PregnancyDetailsView from './PregnancyDetailsView';
import Dropdown from '../common/Dropdown';

const BLOOD_GROUPS = [
  { value: 'A_POSITIVE', label: 'A+' },
  { value: 'A_NEGATIVE', label: 'A-' },
  { value: 'B_POSITIVE', label: 'B+' },
  { value: 'B_NEGATIVE', label: 'B-' },
  { value: 'AB_POSITIVE', label: 'AB+' },
  { value: 'AB_NEGATIVE', label: 'AB-' },
  { value: 'O_POSITIVE', label: 'O+' },
  { value: 'O_NEGATIVE', label: 'O-' },
];

interface AncTabProps {
  patientId: string;
}

const AncTab: React.FC<AncTabProps> = ({ patientId }) => {
  const [pregnancies, setPregnancies] = useState<AncPregnancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedPregnancy, setSelectedPregnancy] = useState<AncPregnancy | null>(null);
  const [formData, setFormData] = useState({ 
    gravidity: 1, parity: 0, lmp: '', edd: '', bloodGroup: '', husbandBloodGroup: '',
    livingChildren: 0, abortionsMiscarriages: 0, 
    historyOfCSection: false, historyOfPPH: false, historyOfPreEclampsia: false, historyOfStillbirth: false,
    preExistingDiabetes: false, preExistingHypertension: false, cardiacDisease: false, multipleGestation: false
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchAncData = async () => {
      try {
        const data = await ancService.getPregnancies(patientId);
        setPregnancies(data);
      } catch (error) {
        console.error('Failed to load ANC data', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAncData();
  }, [patientId]);

  if (loading) {
    return <div className="p-4 text-center text-gray-500">Loading Maternal Care Data...</div>;
  }

  if (selectedPregnancy) {
    return (
      <PregnancyDetailsView 
        pregnancy={selectedPregnancy} 
        onBack={() => setSelectedPregnancy(null)} 
      />
    );
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-medium text-gray-900">Antenatal Care (ANC) History</h3>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700"
        >
          Record New Pregnancy
        </button>
      </div>

      {pregnancies.length === 0 ? (
        <p className="text-gray-500 italic">No previous pregnancies recorded.</p>
      ) : (
        <div className="space-y-6">
          {pregnancies.map((preg) => (
            <div key={preg.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="font-medium text-gray-900">
                    Pregnancy (Gravidity: {preg.gravidity} / Parity: {preg.parity})
                  </h4>
                  <p className="text-sm text-gray-500">
                    EDD: {preg.edd ? new Date(preg.edd).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${preg.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                  {preg.isActive ? 'Active' : 'Closed'}
                </span>
              </div>
              
              <div className="mt-4">
                <button 
                  onClick={() => setSelectedPregnancy(preg)}
                  className="text-sm text-primary-600 hover:text-primary-800 font-medium"
                >
                  View Visits & Charts &rarr;
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl my-8">
            <h3 className="text-xl font-bold mb-4">Record New Pregnancy</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setSubmitting(true);
              try {
                const newPregnancy = await ancService.createPregnancy(patientId, formData);
                setPregnancies([newPregnancy, ...pregnancies]);
                setShowModal(false);
                setFormData({ 
                  gravidity: 1, parity: 0, lmp: '', edd: '', bloodGroup: '', husbandBloodGroup: '',
                  livingChildren: 0, abortionsMiscarriages: 0, 
                  historyOfCSection: false, historyOfPPH: false, historyOfPreEclampsia: false, historyOfStillbirth: false,
                  preExistingDiabetes: false, preExistingHypertension: false, cardiacDisease: false, multipleGestation: false
                });
              } catch (error) {
                console.error(error);
                alert('Failed to record pregnancy');
              } finally {
                setSubmitting(false);
              }
            }}>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Gravidity (Total Pregnancies)</label>
                  <input type="number" min="1" value={formData.gravidity} onChange={e => setFormData({...formData, gravidity: parseInt(e.target.value)})} className="input w-full" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Parity (Live Births)</label>
                  <input type="number" min="0" value={formData.parity} onChange={e => setFormData({...formData, parity: parseInt(e.target.value)})} className="input w-full" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">LMP (Last Menstrual Period)</label>
                  <input type="date" value={formData.lmp} onChange={e => setFormData({...formData, lmp: e.target.value})} className="input w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">EDD (Estimated Delivery Date)</label>
                  <input type="date" value={formData.edd} onChange={e => setFormData({...formData, edd: e.target.value})} className="input w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Blood Group</label>
                  <Dropdown value={formData.bloodGroup} onChange={e => setFormData({...formData, bloodGroup: e.target.value})} className="input w-full">
                    <option value="">Select...</option>
                    {BLOOD_GROUPS.map(bg => <option key={bg.value} value={bg.value}>{bg.label}</option>)}
                  </Dropdown>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Husband's Blood Group</label>
                  <Dropdown value={formData.husbandBloodGroup} onChange={e => setFormData({...formData, husbandBloodGroup: e.target.value})} className="input w-full">
                    <option value="">Select...</option>
                    {BLOOD_GROUPS.map(bg => <option key={bg.value} value={bg.value}>{bg.label}</option>)}
                  </Dropdown>
                </div>
              </div>

              <h4 className="font-semibold text-gray-800 border-b pb-2 mb-4 mt-6">Obstetric History</h4>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Living Children</label>
                  <input type="number" min="0" value={formData.livingChildren} onChange={e => setFormData({...formData, livingChildren: parseInt(e.target.value)})} className="input w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Abortions / Miscarriages</label>
                  <input type="number" min="0" value={formData.abortionsMiscarriages} onChange={e => setFormData({...formData, abortionsMiscarriages: parseInt(e.target.value)})} className="input w-full" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="flex items-center">
                  <input type="checkbox" id="historyOfCSection" checked={formData.historyOfCSection} onChange={e => setFormData({...formData, historyOfCSection: e.target.checked})} className="h-4 w-4 text-primary-600 rounded" />
                  <label htmlFor="historyOfCSection" className="ml-2 text-sm text-gray-700">Previous C-Section</label>
                </div>
                <div className="flex items-center">
                  <input type="checkbox" id="historyOfPPH" checked={formData.historyOfPPH} onChange={e => setFormData({...formData, historyOfPPH: e.target.checked})} className="h-4 w-4 text-primary-600 rounded" />
                  <label htmlFor="historyOfPPH" className="ml-2 text-sm text-gray-700">History of PPH</label>
                </div>
                <div className="flex items-center">
                  <input type="checkbox" id="historyOfPreEclampsia" checked={formData.historyOfPreEclampsia} onChange={e => setFormData({...formData, historyOfPreEclampsia: e.target.checked})} className="h-4 w-4 text-primary-600 rounded" />
                  <label htmlFor="historyOfPreEclampsia" className="ml-2 text-sm text-gray-700">History of Pre-Eclampsia</label>
                </div>
                <div className="flex items-center">
                  <input type="checkbox" id="historyOfStillbirth" checked={formData.historyOfStillbirth} onChange={e => setFormData({...formData, historyOfStillbirth: e.target.checked})} className="h-4 w-4 text-primary-600 rounded" />
                  <label htmlFor="historyOfStillbirth" className="ml-2 text-sm text-gray-700">History of Stillbirth</label>
                </div>
              </div>

              <h4 className="font-semibold text-gray-800 border-b pb-2 mb-4 mt-6">Medical Risk Profiling</h4>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="flex items-center">
                  <input type="checkbox" id="preExistingDiabetes" checked={formData.preExistingDiabetes} onChange={e => setFormData({...formData, preExistingDiabetes: e.target.checked})} className="h-4 w-4 text-red-600 rounded" />
                  <label htmlFor="preExistingDiabetes" className="ml-2 text-sm text-gray-700">Pre-existing Diabetes</label>
                </div>
                <div className="flex items-center">
                  <input type="checkbox" id="preExistingHypertension" checked={formData.preExistingHypertension} onChange={e => setFormData({...formData, preExistingHypertension: e.target.checked})} className="h-4 w-4 text-red-600 rounded" />
                  <label htmlFor="preExistingHypertension" className="ml-2 text-sm text-gray-700">Pre-existing Hypertension</label>
                </div>
                <div className="flex items-center">
                  <input type="checkbox" id="cardiacDisease" checked={formData.cardiacDisease} onChange={e => setFormData({...formData, cardiacDisease: e.target.checked})} className="h-4 w-4 text-red-600 rounded" />
                  <label htmlFor="cardiacDisease" className="ml-2 text-sm text-gray-700">Cardiac Disease</label>
                </div>
                <div className="flex items-center">
                  <input type="checkbox" id="multipleGestation" checked={formData.multipleGestation} onChange={e => setFormData({...formData, multipleGestation: e.target.checked})} className="h-4 w-4 text-yellow-500 rounded" />
                  <label htmlFor="multipleGestation" className="ml-2 text-sm text-gray-700">Multiple Gestation (Twins+)</label>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary" disabled={submitting}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Saving...' : 'Save Pregnancy'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AncTab;
