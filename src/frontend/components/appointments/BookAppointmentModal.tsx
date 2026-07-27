/**
 * Book Appointment Modal Component
 *
 * Modal for booking new appointments with validation
 * Supports patient search and time slot selection
 */

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import Dropdown from '../common/Dropdown';
import { getErrorMessage } from '../../utils/errorHandler';

interface BookAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBook: (appointment: AppointmentFormData) => Promise<void>;
  selectedDate?: Date;
  selectedTime?: string;
  doctors: Array<{ id: string; name: string }>;
}

export interface AppointmentFormData {
  patientId: string;
  doctorId: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentType: string;
  reason?: string;
  duration?: number;
}

const APPOINTMENT_TYPES = [
  'General Consultation',
  'Follow-up',
  'Emergency',
  'Specialist Consultation',
  'Routine Checkup',
  'Vaccination',
  'Lab Test',
  'Imaging',
  'Procedure',
];

const BookAppointmentModal: React.FC<BookAppointmentModalProps> = ({
  isOpen,
  onClose,
  onBook,
  selectedDate,
  selectedTime,
  doctors,
}) => {
  const [formData, setFormData] = useState<AppointmentFormData>({
    patientId: '',
    doctorId: '',
    appointmentDate: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    appointmentTime: selectedTime || '09:00',
    appointmentType: 'General Consultation',
    reason: '',
    duration: 30,
  });

  const [patientSearch, setPatientSearch] = useState('');
  const [patients, setPatients] = useState<Array<{ id: string; name: string; patientNumber: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Update form when selectedDate or selectedTime changes
  useEffect(() => {
    if (selectedDate) {
      setFormData(prev => ({ ...prev, appointmentDate: format(selectedDate, 'yyyy-MM-dd') }));
    }
    if (selectedTime) {
      setFormData(prev => ({ ...prev, appointmentTime: selectedTime }));
    }
  }, [selectedDate, selectedTime]);

  // Search patients
  const searchPatients = async (query: string) => {
    if (query.length < 2) {
      setPatients([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`${window.location.protocol}//${window.location.hostname}:3000/api/patients/search?query=${encodeURIComponent(query)}&lite=true&_t=${Date.now()}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log("SEARCH RESULTS:", result);
        const patientsList = result.data || result.patients || [];
        setPatients(
          patientsList.map((p: any) => ({
            id: p.id,
            name: `${p.firstName} ${p.lastName}`,
            patientNumber: p.patientId || p.patientNumber,
          }))
        );
      } else {
        console.error("API error:", await response.text());
      }
    } catch (error) {
      console.error('Error searching patients:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle patient search input
  useEffect(() => {
    const timer = setTimeout(() => {
      searchPatients(patientSearch);
    }, 300);

    return () => clearTimeout(timer);
  }, [patientSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.patientId) {
      setError('Please select a patient');
      return;
    }

    if (!formData.doctorId) {
      setError('Please select a doctor');
      return;
    }

    setIsSubmitting(true);
    try {
      await onBook(formData);
      onClose();
      // Reset form
      setFormData({
        patientId: '',
        doctorId: '',
        appointmentDate: format(new Date(), 'yyyy-MM-dd'),
        appointmentTime: '09:00',
        appointmentType: 'General Consultation',
        reason: '',
        duration: 30,
      });
      setPatientSearch('');
    } catch (error: any) {
      setError(getErrorMessage(error, 'Failed to book appointment'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Book Appointment</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
              disabled={isSubmitting}
            >
              &times;
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Patient Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Patient *
              </label>
              <input
                type="text"
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                placeholder="Search by name or patient number..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={isSubmitting}
              />
              {isSearching && <p className="text-sm text-gray-500 mt-1">Searching...</p>}
              {patients.length > 0 && (
                <div className="mt-2 border border-gray-200 rounded-md max-h-40 overflow-y-auto">
                  {patients.map((patient) => (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, patientId: patient.id });
                        setPatientSearch(`${patient.name} (${patient.patientNumber})`);
                        setPatients([]);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-primary-50 border-b border-gray-100 last:border-b-0"
                    >
                      <div className="font-medium">{patient.name}</div>
                      <div className="text-sm text-gray-500">{patient.patientNumber}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Doctor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Doctor *
              </label>
              <Dropdown
                value={formData.doctorId}
                onChange={(e) => setFormData({ ...formData, doctorId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
                disabled={isSubmitting}
              >
                <option value="">Select a doctor</option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.name}
                  </option>
                ))}
              </Dropdown>
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  value={formData.appointmentDate}
                  onChange={(e) => setFormData({ ...formData, appointmentDate: e.target.value })}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Time *
                </label>
                <input
                  type="time"
                  value={formData.appointmentTime}
                  onChange={(e) => setFormData({ ...formData, appointmentTime: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Appointment Type and Duration */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type *
                </label>
                <Dropdown
                  value={formData.appointmentType}
                  onChange={(e) => setFormData({ ...formData, appointmentType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                  disabled={isSubmitting}
                >
                  {APPOINTMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </Dropdown>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration (minutes) *
                </label>
                <input
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                  min="5"
                  max="480"
                  step="5"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason for Visit
              </label>
              <textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                rows={3}
                placeholder="Describe the reason for this appointment..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={isSubmitting}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Booking...' : 'Book Appointment'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default BookAppointmentModal;
