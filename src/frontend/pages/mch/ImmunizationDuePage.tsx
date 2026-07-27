import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Syringe, AlertCircle } from 'lucide-react';
import { immunizationService } from '../../services/immunization.service';

interface OverdueDose {
  id: string;
  patientId: string;
  nextDueDate: string;
  patient: { id: string; firstName: string; lastName: string; patientId: string };
  schedule: { vaccineName: string; diseaseTarget: string };
}

const daysOverdueLabel = (nextDueDate: string) => {
  const days = Math.floor((Date.now() - new Date(nextDueDate).getTime()) / (1000 * 60 * 60 * 24));
  if (days > 0) return { text: `${days} day${days === 1 ? '' : 's'} overdue`, overdue: true };
  if (days === 0) return { text: 'Due today', overdue: true };
  return { text: `Due in ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`, overdue: false };
};

const ImmunizationDuePage: React.FC = () => {
  const navigate = useNavigate();
  const [doses, setDoses] = useState<OverdueDose[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await immunizationService.getOverdue(7);
        setDoses(data);
      } catch (error) {
        console.error('Failed to load overdue immunizations', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Syringe className="w-6 h-6 text-primary-600" /> Immunizations Due
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Booster doses that are overdue or due within the next 7 days, clinic-wide.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : doses.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 border-2 border-dashed rounded-lg text-gray-500">
          Nothing due or overdue in the next 7 days.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {doses.map((dose) => {
            const label = daysOverdueLabel(dose.nextDueDate);
            return (
              <button
                key={dose.id}
                onClick={() => navigate(`/patients?patientId=${dose.patient.id}`)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {dose.patient.firstName} {dose.patient.lastName}
                    <span className="text-xs text-gray-400 font-normal ml-2">{dose.patient.patientId}</span>
                  </p>
                  <p className="text-sm text-gray-600 mt-0.5">
                    {dose.schedule.vaccineName} <span className="text-gray-400">({dose.schedule.diseaseTarget})</span>
                  </p>
                </div>
                <span className={`flex items-center gap-1 text-sm font-medium px-2.5 py-1 rounded-full ${
                  label.overdue ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {label.overdue && <AlertCircle className="w-3.5 h-3.5" />}
                  {label.text}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ImmunizationDuePage;
