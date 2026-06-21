/**
 * Consultations Page
 *
 * Main page for clinical documentation with SOAP notes, vital signs, and patient history
 * REQ-CLIN-1: SOAP format documentation
 * REQ-CLIN-8: Patient medical history
 */

import React, { useState, useEffect } from 'react';
import { Plus, Search, User, FileText, Lock, Calendar, AlertCircle } from 'lucide-react';
import ConsultationModal from '../components/consultations/ConsultationModal';

interface Consultation {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  subjective: string | null;
  assessment: string | null;
  status: 'DRAFT' | 'FINALIZED' | 'LOCKED';
  consultationDate: string;
  finalizedAt: string | null;
  createdAt: string;
}

interface Patient {
  id: string;
  patientId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  age: number;
  gender: string;
  allergies: string[];
  chronicConditions: string[];
}

const ConsultationsPage: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedConsultation, setSelectedConsultation] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Patient search
  const [searchQuery, setSearchQuery] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);

  // Debounced search for patients
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2) {
        searchPatients(searchQuery);
      } else {
        setPatients([]);
        setShowPatientDropdown(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch consultations when patient selected
  useEffect(() => {
    if (selectedPatient) {
      fetchConsultations(selectedPatient.id);
    } else {
      setConsultations([]);
    }
  }, [selectedPatient]);

  const searchPatients = async (query: string) => {
    setIsSearching(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:3000/api/patients/search?query=${encodeURIComponent(query)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        const patientList = result.data.map((p: any) => ({
          id: p.id,
          patientId: p.patientId,
          firstName: p.firstName,
          lastName: p.lastName,
          fullName: `${p.firstName} ${p.lastName}`,
          age: p.age,
          gender: p.gender,
          allergies: p.allergies || [],
          chronicConditions: p.chronicConditions || [],
        }));
        setPatients(patientList);
        setShowPatientDropdown(true);
      }
    } catch (error) {
      console.error('Error searching patients:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const fetchConsultations = async (patientId: string) => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:3000/api/consultations/patient/${patientId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();
      if (response.ok) {
        setConsultations(result.data || []);
      } else {
        console.error('Failed to fetch consultations:', result.message);
      }
    } catch (error) {
      console.error('Error fetching consultations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePatientSelect = (patient: Patient) => {
    setSelectedPatient(patient);
    setSearchQuery(patient.fullName);
    setShowPatientDropdown(false);
  };

  const handleNewConsultation = () => {
    if (!selectedPatient) {
      alert('Please select a patient first');
      return;
    }
    setSelectedConsultation(null);
    setShowModal(true);
  };

  const handleConsultationClick = (consultationId: string) => {
    setSelectedConsultation(consultationId);
    setShowModal(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return (
          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
            Draft
          </span>
        );
      case 'FINALIZED':
        return (
          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded flex items-center gap-1">
            <Lock className="w-3 h-3" />
            Finalized
          </span>
        );
      case 'LOCKED':
        return (
          <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded flex items-center gap-1">
            <Lock className="w-3 h-3" />
            Locked
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Clinical Documentation</h2>
        <button
          className="btn btn-primary flex items-center gap-2"
          onClick={handleNewConsultation}
          disabled={!selectedPatient}
        >
          <Plus className="w-5 h-5" />
          New Consultation
        </button>
      </div>

      {/* Patient Search */}
      <div className="card mb-6">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <User className="w-5 h-5" />
          Select Patient
        </h3>

        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (patients.length > 0) setShowPatientDropdown(true);
              }}
              placeholder="Search by name, patient number, or phone..."
              className="input pl-10 w-full"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              </div>
            )}
          </div>

          {/* Patient Dropdown */}
          {showPatientDropdown && patients.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {patients.map((patient) => (
                <div
                  key={patient.id}
                  onClick={() => handlePatientSelect(patient)}
                  className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0"
                >
                  <div className="font-medium">{patient.fullName}</div>
                  <div className="text-sm text-gray-600">
                    {patient.patientId} • {patient.age} years • {patient.gender}
                  </div>
                  {patient.allergies.length > 0 && (
                    <div className="text-xs text-red-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Allergies: {patient.allergies.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Patient Info */}
        {selectedPatient && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-2">Selected Patient</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="font-medium">Name:</span> {selectedPatient.fullName}
              </div>
              <div>
                <span className="font-medium">Patient ID:</span> {selectedPatient.patientId}
              </div>
              <div>
                <span className="font-medium">Age:</span> {selectedPatient.age} years
              </div>
              <div>
                <span className="font-medium">Gender:</span> {selectedPatient.gender}
              </div>
              {selectedPatient.allergies.length > 0 && (
                <div className="col-span-2 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-red-700">Allergies:</span>
                    <span className="ml-2 text-red-600">{selectedPatient.allergies.join(', ')}</span>
                  </div>
                </div>
              )}
              {selectedPatient.chronicConditions.length > 0 && (
                <div className="col-span-2">
                  <span className="font-medium">Chronic Conditions:</span>
                  <span className="ml-2">{selectedPatient.chronicConditions.join(', ')}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Consultation History */}
      {selectedPatient && (
        <div className="card">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Consultation History
          </h3>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-500 mt-4">Loading consultations...</p>
            </div>
          ) : consultations.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {consultations.map((consultation) => (
                <div
                  key={consultation.id}
                  className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleConsultationClick(consultation.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="font-semibold">
                          {new Date(consultation.consultationDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </span>
                        {getStatusBadge(consultation.status)}
                      </div>

                      <div className="ml-7 space-y-1">
                        <div className="text-sm">
                          <span className="font-medium text-gray-700">Chief Complaint:</span>
                          <p className="text-gray-600 mt-1 line-clamp-2">
                            {consultation.subjective || 'Not recorded'}
                          </p>
                        </div>

                        <div className="text-sm">
                          <span className="font-medium text-gray-700">Diagnosis:</span>
                          <p className="text-gray-600 mt-1 line-clamp-2">
                            {consultation.assessment || 'Not recorded'}
                          </p>
                        </div>

                        <div className="text-xs text-gray-500 mt-2">
                          Created: {new Date(consultation.createdAt).toLocaleString()}
                          {consultation.finalizedAt && (
                            <span className="ml-3">
                              Finalized: {new Date(consultation.finalizedAt).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="ml-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleConsultationClick(consultation.id);
                        }}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        View Details →
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No consultations found</p>
              <p className="text-sm mt-1">
                Click "New Consultation" to create the first consultation for this patient
              </p>
            </div>
          )}
        </div>
      )}

      {/* No Patient Selected */}
      {!selectedPatient && (
        <div className="card">
          <div className="text-center text-gray-500 py-12">
            <Search className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="font-medium text-lg">No Patient Selected</p>
            <p className="text-sm mt-2">
              Search for a patient above to view their consultation history
            </p>
          </div>
        </div>
      )}

      {/* Consultation Modal */}
      {showModal && selectedPatient && (
        <ConsultationModal
          patientId={selectedPatient.id}
          patient={selectedPatient}
          consultationId={selectedConsultation}
          onClose={() => {
            setShowModal(false);
            setSelectedConsultation(null);
          }}
          onSuccess={() => {
            setShowModal(false);
            setSelectedConsultation(null);
            fetchConsultations(selectedPatient.id);
          }}
        />
      )}
    </div>
  );
};

export default ConsultationsPage;
