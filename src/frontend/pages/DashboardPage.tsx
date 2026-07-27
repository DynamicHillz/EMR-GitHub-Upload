import React, { useState, useEffect } from 'react';
import { Users, Calendar, TestTube, Receipt, UserCog, Building2 } from 'lucide-react';
import ErrorAlert from '../components/common/ErrorAlert';
import { useAuth } from '../contexts/AuthContext';

interface DashboardStats {
  totalPatients: number;
  todaysAppointments: number;
  pendingLabTests: number;
  unpaidInvoices: number;
  activeUsers?: number;
  totalTenants?: number;
}

interface RecentPatient {
  id: string;
  patientId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  createdAt: string;
}

interface UpcomingAppointment {
  id: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentType: string;
  status: string;
  patient: {
    id: string;
    patientId: string;
    firstName: string;
    lastName: string;
  };
  doctor: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

const DashboardPage: React.FC = () => {
  const { hasRole } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalPatients: 0,
    todaysAppointments: 0,
    pendingLabTests: 0,
    unpaidInvoices: 0,
  });
  const [recentPatients, setRecentPatients] = useState<RecentPatient[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<UpcomingAppointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      setError('');
      const token = localStorage.getItem('token');

      const [statsRes, patientsRes, appointmentsRes] = await Promise.all([
        fetch(`${window.location.protocol}//${window.location.hostname}:3000/api/dashboard/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${window.location.protocol}//${window.location.hostname}:3000/api/dashboard/recent-patients`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${window.location.protocol}//${window.location.hostname}:3000/api/dashboard/upcoming-appointments`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.data);
      }

      if (patientsRes.ok) {
        const patientsData = await patientsRes.json();
        setRecentPatients(patientsData.data);
      }

      if (appointmentsRes.ok) {
        const appointmentsData = await appointmentsRes.json();
        setUpcomingAppointments(appointmentsData.data);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const statCards = [
    { name: 'Total Patients', value: stats.totalPatients, icon: Users, color: 'bg-blue-500' },
    { name: "Today's Appointments", value: stats.todaysAppointments, icon: Calendar, color: 'bg-green-500' },
    { name: 'Pending Lab Tests', value: stats.pendingLabTests, icon: TestTube, color: 'bg-yellow-500' },
    { name: 'Unpaid Invoices', value: stats.unpaidInvoices, icon: Receipt, color: 'bg-red-500' },
    // Admin-only widgets — the backend only computes/returns these fields
    // for ADMIN/SUPER_ADMIN callers in the first place (dashboard.controller.ts).
    ...(hasRole(['SUPER_ADMIN', 'ADMIN']) && stats.activeUsers !== undefined
      ? [{ name: 'Active Users', value: stats.activeUsers, icon: UserCog, color: 'bg-purple-500' }]
      : []),
    ...(hasRole(['SUPER_ADMIN']) && stats.totalTenants !== undefined
      ? [{ name: 'Clinics on Platform', value: stats.totalTenants, icon: Building2, color: 'bg-indigo-500' }]
      : []),
  ];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (timeString: string) => {
    return timeString;
  };

  const calculateAge = (dateOfBirth: string) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-6">
          <ErrorAlert
            message={error}
            severity="error"
            onDismiss={() => setError('')}
            onRetry={fetchDashboardData}
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{stat.name}</p>
                  <p className="text-3xl font-bold mt-2">{stat.value}</p>
                </div>
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <Icon className="w-8 h-8 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Patients */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Recent Patients</h3>
          {recentPatients.length === 0 ? (
            <p className="text-gray-600">No patients registered yet.</p>
          ) : (
            <div className="space-y-3">
              {recentPatients.map((patient) => (
                <div
                  key={patient.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {patient.firstName} {patient.lastName}
                    </p>
                    <p className="text-sm text-gray-600">
                      ID: {patient.patientId} • {patient.gender} • Age: {calculateAge(patient.dateOfBirth)}
                    </p>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    {formatDate(patient.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Appointments */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Upcoming Appointments</h3>
          {upcomingAppointments.length === 0 ? (
            <p className="text-gray-600">No upcoming appointments scheduled.</p>
          ) : (
            <div className="space-y-3">
              {upcomingAppointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {appointment.patient.firstName} {appointment.patient.lastName}
                    </p>
                    <p className="text-sm text-gray-600">
                      Dr. {appointment.doctor.firstName} {appointment.doctor.lastName}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {appointment.appointmentType} • {appointment.status}
                    </p>
                  </div>
                  <div className="text-right text-sm text-gray-600">
                    <p className="font-medium">{formatDate(appointment.appointmentDate)}</p>
                    <p className="text-xs">{formatTime(appointment.appointmentTime)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
