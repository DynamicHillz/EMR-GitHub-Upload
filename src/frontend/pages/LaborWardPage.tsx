import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, AlertTriangle } from 'lucide-react';
import laborService from '../services/labor.service';
import { ActiveLaborWorklistItem } from '../types/labor';
import { isAbnormalFHR } from '../components/inpatient/partograph/FetalHeartRateChart';

const hoursSince = (dateString: string) => {
  const diff = Date.now() - new Date(dateString).getTime();
  return Math.max(0, diff / (1000 * 60 * 60));
};

const LaborWardPage: React.FC = () => {
  const navigate = useNavigate();
  const [labors, setLabors] = useState<ActiveLaborWorklistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await laborService.getActiveLabors();
        setLabors(data);
      } catch (err) {
        console.error('Failed to load active labors:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Heart className="w-6 h-6 text-primary-600" />
          Labor Ward
        </h1>
        <p className="text-gray-600 mt-1">Patients currently in labor</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : labors.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Heart className="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <p>No patients currently in labor.</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bed / Ward</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Labor Onset</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours in Labor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phase</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Latest Dilation</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Latest FHR</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {labors.map((labor) => {
                const latestObservation = labor.observations?.[0];
                const fhrAbnormal = isAbnormalFHR(latestObservation?.fetalHeartRate);
                return (
                  <tr
                    key={labor.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/inpatient/${labor.admission.id}?tab=partograph`)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {labor.admission.patient.firstName} {labor.admission.patient.lastName}
                      </div>
                      <div className="text-sm text-gray-500">{labor.admission.patient.patientId}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {labor.admission.bed.bedNumber} · {labor.admission.bed.ward.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(labor.laborOnsetAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {hoursSince(labor.laborOnsetAt).toFixed(1)}h
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {labor.activePhaseOnsetAt ? `Active — ${hoursSince(labor.activePhaseOnsetAt).toFixed(1)}h` : 'Latent'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {latestObservation?.cervicalDilation != null ? `${latestObservation.cervicalDilation}cm` : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {latestObservation?.fetalHeartRate != null ? (
                        <span className={`inline-flex items-center gap-1 ${fhrAbnormal ? 'text-red-700 font-medium' : 'text-gray-600'}`}>
                          {fhrAbnormal && <AlertTriangle className="w-3.5 h-3.5" />}
                          {latestObservation.fetalHeartRate}bpm
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default LaborWardPage;
