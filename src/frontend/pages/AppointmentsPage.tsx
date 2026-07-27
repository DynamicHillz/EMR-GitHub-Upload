/**
 * Appointments Page
 *
 * Main page for appointment scheduling and management
 * Features:
 * - Calendar view (day/week/month)
 * - Book new appointments
 * - Check-in patients
 * - View waiting queue
 * - Cancel/reschedule appointments
 *
 * User Stories Implemented:
 * - US-APPT-001: Book Appointment
 * - US-APPT-002: View Appointments
 * - US-APPT-003: Check-in Patient
 * - US-APPT-004: View Waiting Queue
 * - US-APPT-005: Cancel Appointment
 */

import React, { useState, useEffect } from 'react';
import { View } from 'react-big-calendar';
import { format } from 'date-fns';
import AppointmentCalendar, { AppointmentEvent } from '../components/appointments/AppointmentCalendar';
import BookAppointmentModal, { AppointmentFormData } from '../components/appointments/BookAppointmentModal';
import { useToast } from '../components/ToastContainer';
import { offlineFetch } from '../services/offlineFetch';
import { cacheTodayAppointments, getCachedTodayAppointments } from '../services/offlineCache';
import Dropdown from '../components/common/Dropdown';

const AppointmentsPage: React.FC = () => {
  const toast = useToast();
  const [appointments, setAppointments] = useState<AppointmentEvent[]>([]);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState<string>();
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentEvent | null>(null);
  const [view, setView] = useState<View>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [doctors, setDoctors] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [waitingQueue, setWaitingQueue] = useState<any[]>([]);
  const [showWaitingQueue, setShowWaitingQueue] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');

  // Fetch doctors on mount
  useEffect(() => {
    fetchDoctors();
  }, []);

  // Fetch appointments when filters change
  useEffect(() => {
    fetchAppointments();
  }, [selectedDoctor, currentDate, view]);

  const fetchDoctors = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${window.location.protocol}//${window.location.hostname}:3000/api/users/doctors`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        // No need to filter - endpoint already returns only active doctors
        if (result.users && Array.isArray(result.users)) {
          setDoctors(result.users.map((user: any) => ({
            id: user.id,
            name: `Dr. ${user.firstName} ${user.lastName}`,
          })));
        } else {
          console.error('Invalid response format:', result);
          setDoctors([]);
        }
      } else {
        console.error('Failed to fetch doctors:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error fetching doctors:', error);
      setDoctors([]);
    }
  };

  const fetchAppointments = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();

      if (selectedDoctor !== 'all') {
        params.append('doctorId', selectedDoctor);
      }

      // Set date range based on view
      if (view === 'day') {
        params.append('date', format(currentDate, 'yyyy-MM-dd'));
      } else if (view === 'week') {
        const weekStart = new Date(currentDate);
        weekStart.setDate(currentDate.getDate() - currentDate.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        params.append('dateFrom', format(weekStart, 'yyyy-MM-dd'));
        params.append('dateTo', format(weekEnd, 'yyyy-MM-dd'));
      } else if (view === 'month') {
        const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        params.append('dateFrom', format(monthStart, 'yyyy-MM-dd'));
        params.append('dateTo', format(monthEnd, 'yyyy-MM-dd'));
      }

      const response = await fetch(`${window.location.protocol}//${window.location.hostname}:3000/api/appointments?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const result = await response.json();

        // Transform appointments to calendar events
        const events: AppointmentEvent[] = result.appointments.map((apt: any) => {
          const appointmentDate = new Date(apt.appointmentDate);
          const [hours, minutes] = apt.appointmentTime.split(':');
          const start = new Date(appointmentDate);
          start.setHours(parseInt(hours), parseInt(minutes), 0);

          const end = new Date(start);
          end.setMinutes(start.getMinutes() + apt.duration);

          return {
            id: apt.id,
            title: apt.patientName || `Patient ${apt.patientId.substring(0, 8)}`, // TODO: Replace with actual patient name
            start,
            end,
            resource: {
              patientId: apt.patientId,
              patientNumber: apt.patient?.patientId || apt.patientId,
              doctorId: apt.doctorId,
              doctorName: apt.doctorName,
              status: apt.status,
              appointmentType: apt.appointmentType,
              reason: apt.reason,
              version: apt.version,
            },
          };
        });

        setAppointments(events);

        // Bounded offline read cache — only today's day-view list, per the
        // scope in offlineCache.ts (not every date range ever viewed).
        const isTodayDayView = view === 'day' && format(currentDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
        if (isTodayDayView) {
          cacheTodayAppointments(result.appointments).catch(() => {});
        }
      }
    } catch (error) {
      console.error('Error fetching appointments — falling back to offline cache if available:', error);
      const isTodayDayView = view === 'day' && format(currentDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
      if (isTodayDayView) {
        const cached = await getCachedTodayAppointments();
        if (cached) {
          const events: AppointmentEvent[] = cached.data.map((apt: any) => {
            const appointmentDate = new Date(apt.appointmentDate);
            const [hours, minutes] = apt.appointmentTime.split(':');
            const start = new Date(appointmentDate);
            start.setHours(parseInt(hours), parseInt(minutes), 0);
            const end = new Date(start);
            end.setMinutes(start.getMinutes() + apt.duration);
            return {
              id: apt.id,
              title: apt.patientName || `Patient ${apt.patientId.substring(0, 8)}`,
              start,
              end,
              resource: {
                patientId: apt.patientId,
                patientNumber: apt.patient?.patientId || apt.patientId,
                doctorId: apt.doctorId,
                doctorName: apt.doctorName,
                status: apt.status,
                appointmentType: apt.appointmentType,
                reason: apt.reason,
              },
            };
          });
          setAppointments(events);
          toast.warning('Showing Offline Data', `Loaded today's appointments from a snapshot saved ${new Date(cached.cachedAt).toLocaleString()}.`);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchWaitingQueue = async (doctorId: string) => {
    try {
      const response = await fetch(`${window.location.protocol}//${window.location.hostname}:3000/api/appointments/doctor/${doctorId}/waiting-queue`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        setWaitingQueue(result.queue || []);
      }
    } catch (error) {
      console.error('Error fetching waiting queue:', error);
    }
  };

  const handleSelectSlot = (slotInfo: { start: Date; end: Date }) => {
    setSelectedDate(slotInfo.start);
    setSelectedTime(format(slotInfo.start, 'HH:mm'));
    setIsBookingModalOpen(true);
  };

  const handleSelectEvent = (event: AppointmentEvent) => {
    setSelectedAppointment(event);
  };

  const handleBookAppointment = async (formData: AppointmentFormData) => {
    try {
      const response = await fetch(`${window.location.protocol}//${window.location.hostname}:3000/api/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.message || 'Failed to book appointment');
      }

      // Refresh appointments
      await fetchAppointments();
    } catch (error) {
      console.error('Error booking appointment:', error);
      throw error;
    }
  };

  const handleCheckIn = async (appointmentId: string) => {
    try {
      const response = await fetch(`${window.location.protocol}//${window.location.hostname}:3000/api/appointments/${appointmentId}/check-in`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(
          'Patient Checked In Successfully',
          `Queue position: ${result.queuePosition}`
        );
        await fetchAppointments();
        setSelectedAppointment(null);
      } else {
        toast.error('Check-in Failed', result.error || 'Failed to check in patient');
      }
    } catch (error) {
      console.error('Error checking in:', error);
      toast.error('Check-in Failed', 'Failed to check in patient');
    }
  };

  const handleMarkNoShow = async (appointmentId: string) => {
    try {
      const response = await offlineFetch(
        `${window.location.protocol}//${window.location.hostname}:3000/api/appointments/${appointmentId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({ status: 'NO_SHOW' }),
        },
        { entityType: 'APPOINTMENT', entityId: appointmentId, baseVersion: selectedAppointment?.resource.version }
      );

      const data = await response.json().catch(() => ({}));
      if (data.queued) {
        toast.success('Saved Offline', 'This will sync automatically when your connection returns.');
        await fetchAppointments();
        setSelectedAppointment(null);
      } else if (response.ok) {
        toast.success('Marked as No-Show', 'The appointment has been updated');
        await fetchAppointments();
        setSelectedAppointment(null);
      } else {
        toast.error('Failed', data.message || 'Failed to mark appointment as no-show');
      }
    } catch (error) {
      console.error('Error marking no-show:', error);
      toast.error('Failed', 'Failed to mark appointment as no-show');
    }
  };

  const todayAppointments = appointments.filter(
    (a) => format(a.start, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
  );
  const todayStats = {
    total: todayAppointments.length,
    waiting: todayAppointments.filter((a) => a.resource.status === 'CHECKED_IN').length,
    scheduled: todayAppointments.filter((a) => a.resource.status === 'SCHEDULED').length,
    noShow: todayAppointments.filter((a) => a.resource.status === 'NO_SHOW').length,
  };

  const handleCancelAppointment = async () => {
    if (!selectedAppointment || !cancellationReason.trim()) {
      toast.error('Validation Error', 'Please provide a cancellation reason');
      return;
    }

    try {
      const response = await fetch(`${window.location.protocol}//${window.location.hostname}:3000/api/appointments/${selectedAppointment.id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ reason: cancellationReason }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success('Success', 'Appointment cancelled successfully');
        await fetchAppointments();
        setSelectedAppointment(null);
        setShowCancelModal(false);
        setCancellationReason('');
      } else {
        toast.error('Cancellation Failed', result.error || 'Failed to cancel appointment');
      }
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      toast.error('Cancellation Failed', 'Failed to cancel appointment');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Appointments</h1>
        <button
          onClick={() => setIsBookingModalOpen(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <span>+</span>
          Book Appointment
        </button>
      </div>

      {/* Today's Snapshot */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-sm text-gray-500">Today's Appointments</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{todayStats.total}</p>
        </div>
        <div className="bg-amber-50 rounded-lg border border-amber-200 p-4">
          <p className="text-sm text-amber-600">Waiting (Checked In)</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{todayStats.waiting}</p>
        </div>
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
          <p className="text-sm text-blue-600">Scheduled</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{todayStats.scheduled}</p>
        </div>
        <div className="bg-red-50 rounded-lg border border-red-200 p-4">
          <p className="text-sm text-red-600">No-Shows</p>
          <p className="text-2xl font-bold text-red-700 mt-1">{todayStats.noShow}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 flex gap-4 items-center">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Doctor</label>
          <Dropdown
            value={selectedDoctor}
            onChange={(e) => setSelectedDoctor(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Doctors</option>
            {doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctor.name}
              </option>
            ))}
          </Dropdown>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              if (selectedDoctor !== 'all') {
                setShowWaitingQueue(true);
                fetchWaitingQueue(selectedDoctor);
              } else {
                toast.warning('Select Doctor', 'Please select a specific doctor to view waiting queue');
              }
            }}
            className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700"
          >
            View Waiting Queue
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-4 text-gray-600">Loading appointments...</div>
      )}

      {/* Calendar */}
      {!isLoading && (
        <AppointmentCalendar
          appointments={appointments}
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          view={view}
          onViewChange={setView}
          date={currentDate}
          onNavigate={setCurrentDate}
        />
      )}

      {/* Booking Modal */}
      <BookAppointmentModal
        isOpen={isBookingModalOpen}
        onClose={() => {
          setIsBookingModalOpen(false);
          setSelectedDate(undefined);
          setSelectedTime(undefined);
        }}
        onBook={handleBookAppointment}
        selectedDate={selectedDate}
        selectedTime={selectedTime}
        doctors={doctors}
      />

      {/* Appointment Details Modal */}
      {selectedAppointment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Appointment Details</h2>
              <button
                onClick={() => setSelectedAppointment(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-500">Patient</label>
                <p className="font-medium">{selectedAppointment.title}</p>
                <p className="text-sm text-gray-500">{selectedAppointment.resource.patientNumber}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Time</label>
                <p className="font-medium">
                  {format(selectedAppointment.start, 'PPP p')} - {format(selectedAppointment.end, 'p')}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Type</label>
                <p className="font-medium">{selectedAppointment.resource.appointmentType}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Status</label>
                <p className="font-medium">{selectedAppointment.resource.status}</p>
              </div>
              {selectedAppointment.resource.reason && (
                <div>
                  <label className="text-sm text-gray-500">Reason</label>
                  <p className="font-medium">{selectedAppointment.resource.reason}</p>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              {selectedAppointment.resource.status === 'SCHEDULED' && (
                <>
                  <button
                    onClick={() => handleCheckIn(selectedAppointment.id)}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    Check In
                  </button>
                  <button
                    onClick={() => setShowCancelModal(true)}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleMarkNoShow(selectedAppointment.id)}
                    className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                  >
                    No-Show
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Waiting Queue Modal */}
      {showWaitingQueue && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Waiting Queue</h2>
              <button
                onClick={() => setShowWaitingQueue(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                &times;
              </button>
            </div>

            {waitingQueue.length === 0 ? (
              <p className="text-gray-600 text-center py-8">No patients in waiting queue</p>
            ) : (
              <div className="space-y-2">
                {waitingQueue.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-md"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center font-bold text-primary-600">
                        {item.position}
                      </div>
                      <div>
                        <p className="font-medium">{item.patientName || `Patient ${item.patientId.substring(0, 8)}`}</p>
                        <p className="text-sm text-gray-500">
                          {item.appointmentType} • Checked in at {format(new Date(item.checkedInAt), 'p')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cancel Appointment Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Cancel Appointment</h2>
              <p className="text-sm text-gray-600 mt-1">
                Please provide a reason for cancelling this appointment
              </p>
            </div>

            {/* Body */}
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cancellation Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="e.g., Patient requested reschedule, Emergency, etc."
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setCancellationReason('');
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCancelAppointment}
                disabled={!cancellationReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentsPage;
