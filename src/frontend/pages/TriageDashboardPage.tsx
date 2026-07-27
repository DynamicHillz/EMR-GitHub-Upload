import React, { useState, useEffect } from 'react';
import { Activity, Clock, Search, Calendar as CalendarIcon, UserCheck, AlertTriangle } from 'lucide-react';
import triageService, { TriageRecord } from '../services/triage.service';
import appointmentService, { Appointment } from '../services/appointment.service';
import TriageAssessmentModal from '../components/triage/TriageAssessmentModal';
import { format, formatDistanceToNow } from 'date-fns';

const TriageDashboardPage: React.FC = () => {
  const [queue, setQueue] = useState<TriageRecord[]>([]);
  const [waitingAppointments, setWaitingAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedPatientName, setSelectedPatientName] = useState('');
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | undefined>(undefined);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const today = new Date();
      const dateStr = format(today, 'yyyy-MM-dd');
      
      const [queueData, appointmentsData] = await Promise.all([
        triageService.getQueue(),
        appointmentService.getAppointments(dateStr)
      ]);
      
      // Filter out appointments that already have a triage record in the queue today
      const checkedIn = appointmentsData.filter(app => 
        app.status === 'CHECKED_IN' && 
        !queueData.some(q => q.patientId === app.patientId)
      );

      setQueue(queueData);
      setWaitingAppointments(checkedIn);
    } catch (err) {
      setError('Failed to fetch triage data');
    } finally {
      setLoading(false);
    }
  };

  const openAssessmentModal = (patientId: string, patientName: string, appointmentId?: string) => {
    setSelectedPatientId(patientId);
    setSelectedPatientName(patientName);
    setSelectedAppointmentId(appointmentId);
    setIsModalOpen(true);
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'RESUSCITATION':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><AlertTriangle className="w-3 h-3 mr-1"/> RESUSCITATION</span>;
      case 'EMERGENT':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800"><AlertTriangle className="w-3 h-3 mr-1"/> EMERGENT</span>;
      case 'URGENT':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">URGENT</span>;
      case 'SEMI_URGENT':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">SEMI-URGENT</span>;
      case 'NON_URGENT':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">NON-URGENT</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{category}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Triage Dashboard</h1>
          <p className="text-sm text-gray-500">WHO ETAT Assessment & Patient Queue</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          <div className="mb-8">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Patients Waiting for Triage</h2>
            {waitingAppointments.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center border border-gray-100">
                <UserCheck className="mx-auto h-8 w-8 text-gray-400" />
                <p className="mt-1 text-sm text-gray-500">No new patients waiting.</p>
              </div>
            ) : (
              <div className="bg-white shadow-sm rounded-xl border border-gray-100 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {waitingAppointments.map((app) => (
                      <tr key={app.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{app.appointmentTime}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{app.patientName}</div>
                          <div className="text-sm text-gray-500">{app.patientNumber || 'No ID'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Arrived</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => openAssessmentModal(app.patientId, app.patientName || '', app.id)}
                            className="text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-md text-sm flex items-center justify-end ml-auto"
                          >
                            <Activity className="w-4 h-4 mr-1" />
                            Perform Triage
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-4">Current Triage Queue (Waiting for Doctor)</h2>
            {queue.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center border border-gray-100">
                <UserCheck className="mx-auto h-8 w-8 text-gray-400" />
                <p className="mt-1 text-sm text-gray-500">Queue is empty.</p>
              </div>
            ) : (
              <div className="bg-white shadow-sm rounded-xl border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Priority
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Patient
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Complaint
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Waiting Time
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Vitals
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {queue.map((record) => (
                        <tr key={record.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getCategoryBadge(record.category)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {record.patient?.firstName} {record.patient?.lastName}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {record.patient?.patientId} • {record.patient?.gender}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900 max-w-xs truncate" title={record.chiefComplaint}>
                              {record.chiefComplaint}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center text-sm text-gray-500">
                              <Clock className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                              {formatDistanceToNow(new Date(record.triageTime), { addSuffix: true })}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            BP: {record.systolicBP}/{record.diastolicBP} • PR: {record.heartRate} • T: {record.temperature}°C
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {isModalOpen && (
        <TriageAssessmentModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          patientId={selectedPatientId}
          patientName={selectedPatientName}
          appointmentId={selectedAppointmentId}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
};

export default TriageDashboardPage;
