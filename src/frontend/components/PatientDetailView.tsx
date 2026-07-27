/**
 * Patient Detail View Component
 * US-PAT-004: Comprehensive Patient History View
 *
 * Features:
 * - Tabbed interface for different sections
 * - Demographics, Medical Summary, Consultations, Prescriptions, Lab Results
 * - Timeline view option
 * - Print medical report
 * - Allergy warnings highlighted
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Heart,
  FileText,
  Pill,
  TestTube,
  Calendar,
  Phone,
  AlertCircle,
  Printer,
  Clock,
  ChevronRight,
  Edit,
  CheckCircle,
  Shield,
  Baby,
  Syringe,
  Bed,
} from 'lucide-react';

import AncTab from './mch/AncTab';
import { offlineFetch } from '../services/offlineFetch';
import { cachePatientCore, getCachedPatientCore } from '../services/offlineCache';
import ImmunizationsTab from './mch/ImmunizationsTab';
import { useToast } from './ToastContainer';
import TriageAssessmentModal from './triage/TriageAssessmentModal';
import PrescriptionModal from './consultations/PrescriptionModal';
import { formatBloodGroup, formatDate } from '../utils/formatters';
import { NIGERIA_LGA_MAP, NIGERIAN_STATES } from '../utils/nigeria-states';
import outpatientVitalService, { OutpatientVital } from '../services/outpatient-vital.service';
import triageService from '../services/triage.service';
import InpatientService from '../services/InpatientService';
import Dropdown from './common/Dropdown';

interface Patient {
  id: string;
  patientId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  dateOfBirth: string;
  age: number;
  gender: string;
  phone: string;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  lga: string | null;
  country: string;
  bloodGroup: string | null;
  genotype: string | null;
  allergies: string[];
  chronicConditions: string[];
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  } | null;
  hasAllergies: boolean;
  consentGiven: boolean;
  consentDate: string | null;
  consentVersion: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PatientDetailViewProps {
  patientId: string;
  onBack: () => void;
  initialTab?: TabType;
}

type TabType = 'demographics' | 'medical' | 'consultations' | 'prescriptions' | 'labs' | 'timeline' | 'anc' | 'immunizations' | 'admissions';

const PatientDetailView: React.FC<PatientDetailViewProps> = ({ patientId, onBack, initialTab = 'demographics' }) => {
  const navigate = useNavigate();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [branding, setBranding] = useState<any>(null);
  const [vitals, setVitals] = useState<OutpatientVital[]>([]);
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [admissionsLoading, setAdmissionsLoading] = useState(false);
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [patientConsultations, setPatientConsultations] = useState<any[]>([]);
  const [patientPrescriptions, setPatientPrescriptions] = useState<any[]>([]);
  const [labResults, setLabResults] = useState<any[]>([]);
  const [labResultsLoading, setLabResultsLoading] = useState(false);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTriageModal, setShowTriageModal] = useState(false);
  const [showConsentHistoryModal, setShowConsentHistoryModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editFormData, setEditFormData] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: 'MALE',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    lga: '',
    bloodGroup: '',
    genotype: '',
    allergies: [] as string[],
    chronicConditions: [] as string[],
    emergencyContact: {
      name: '',
      phone: '',
      relationship: '',
    },
    patientType: 'PRIVATE',
    hmoProvider: '',
    hmoNumber: '',
    nhisNumber: '',
    updateReason: '',
  });

  useEffect(() => {
    fetchPatientDetails();
    fetchBranding();
    fetchVitals();
  }, [patientId]);

  const fetchAdmissions = async () => {
    try {
      setAdmissionsLoading(true);
      const data = await InpatientService.getAdmissionsByPatientId(patientId);
      setAdmissions(data || []);
    } catch (error) {
      console.error('Failed to fetch admissions', error);
      toast.error('Error', 'Failed to fetch admission history');
    } finally {
      setAdmissionsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'admissions' && admissions.length === 0) {
      fetchAdmissions();
    }
    if (activeTab === 'labs' && labResults.length === 0) {
      fetchLabResults();
    }
  }, [activeTab, patientId]);

  const fetchLabResults = async () => {
    setLabResultsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const apiBaseUrl = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`;
      const headers = { Authorization: `Bearer ${token}` };
      const res = await fetch(`${apiBaseUrl}/api/lab/tests?patientId=${patientId}`, { headers });
      const data = res.ok ? await res.json() : { data: [] };
      setLabResults(data.data || []);
    } catch (error) {
      console.error('Failed to fetch lab results', error);
    } finally {
      setLabResultsLoading(false);
    }
  };

  const fetchTimelineEvents = async () => {
    if (!patient) return;
    setTimelineLoading(true);
    try {
      const token = localStorage.getItem('token');
      const apiBaseUrl = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`;
      const headers = { Authorization: `Bearer ${token}` };
      
      // 1. Get Consultations
      const consRes = await fetch(`${apiBaseUrl}/api/consultations/patient/${patientId}`, { headers });
      const consData = consRes.ok ? await consRes.json() : { data: [] };
      const consultations = consData.data || [];
      setPatientConsultations(consultations);

      // 1b. Get Prescriptions
      const presRes = await fetch(`${apiBaseUrl}/api/prescriptions/patient/${patientId}`, { headers });
      const presData = presRes.ok ? await presRes.json() : { data: [] };
      setPatientPrescriptions(presData.data || []);

      // 2. Get Admissions
      let admissionEvents = admissions;
      if (admissionEvents.length === 0) {
        const admissionsData = await InpatientService.getAdmissionsByPatientId(patientId);
        admissionEvents = admissionsData || [];
      }

      const events: any[] = [];
      
      events.push({
        id: 'reg',
        type: 'REGISTRATION',
        title: 'Patient Registered',
        date: patient.createdAt,
        description: `Patient ${patient.fullName} was registered in the system.`,
        icon: User,
        colorClass: 'bg-blue-100 text-blue-600',
      });

      vitals.forEach(v => {
        events.push({
          id: `vital-${v.id}`,
          type: 'VITALS',
          title: 'Vitals Recorded',
          date: v.recordedAt,
          description: `BP: ${v.bloodPressure || 'N/A'}, PR: ${v.heartRate || 'N/A'}, Temp: ${v.temperature || 'N/A'}`,
          icon: Heart,
          colorClass: 'bg-red-100 text-red-600',
        });
      });

      consultations.forEach((c: any) => {
        events.push({
          id: `cons-start-${c.id}`,
          type: 'CONSULTATION',
          title: `Consultation Started`,
          date: c.consultationDate || c.createdAt,
          description: c.doctor ? `Dr. ${c.doctor.firstName} ${c.doctor.lastName}` : 'Doctor consultation',
          icon: FileText,
          colorClass: 'bg-green-100 text-green-600',
        });
        
        if (c.finalizedAt) {
          events.push({
            id: `cons-end-${c.id}`,
            type: 'CONSULTATION',
            title: `Consultation Finalized`,
            date: c.finalizedAt,
            description: c.doctor ? `Dr. ${c.doctor.firstName} ${c.doctor.lastName} finalized the consultation records.` : 'Consultation records finalized.',
            icon: CheckCircle,
            colorClass: 'bg-teal-100 text-teal-700',
          });
        } else if (c.status === 'FINALIZED' || c.status === 'LOCKED' || c.status === 'COMPLETED') {
          events.push({
            id: `cons-end-${c.id}`,
            type: 'CONSULTATION',
            title: `Consultation Finalized`,
            date: c.updatedAt || c.createdAt,
            description: c.doctor ? `Dr. ${c.doctor.firstName} ${c.doctor.lastName} finalized the consultation records.` : 'Consultation records finalized.',
            icon: CheckCircle,
            colorClass: 'bg-teal-100 text-teal-700',
          });
        }
      });

      admissionEvents.forEach((a: any) => {
        events.push({
          id: `adm-${a.id}`,
          type: 'ADMISSION',
          title: `Inpatient Admission`,
          date: a.admissionDate,
          description: `Admitted to ${a.ward?.name || 'Ward'} (Bed ${a.bed?.bedNumber || 'N/A'}). Reason: ${a.reason}`,
          icon: Bed,
          colorClass: 'bg-purple-100 text-purple-600',
        });
        if (a.dischargeDate) {
          events.push({
            id: `dis-${a.id}`,
            type: 'DISCHARGE',
            title: `Discharged`,
            date: a.dischargeDate,
            description: `Discharged from ${a.ward?.name || 'Ward'}.`,
            icon: CheckCircle,
            colorClass: 'bg-teal-100 text-teal-600',
          });
        }
      });

      events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTimelineEvents(events);
    } catch (error) {
      console.error('Failed to fetch timeline', error);
    } finally {
      setTimelineLoading(false);
    }
  };

  useEffect(() => {
    if (['timeline', 'consultations', 'prescriptions'].includes(activeTab) && patientConsultations.length === 0) {
      fetchTimelineEvents();
    }
  }, [activeTab, patientId, patient]);

  const fetchVitals = async () => {
    try {
      const token = localStorage.getItem('token');
      const apiBaseUrl = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`;

      // Fetch outpatient/triage vitals
      const outpatientData = await outpatientVitalService.getPatientVitals(patientId);
      let allVitals: OutpatientVital[] = outpatientData || [];

      // Fetch triage vitals
      try {
        const triageData = await triageService.getPatientTriageHistory(patientId);
        const mappedTriageVitals = (triageData || []).map((t: any) => ({
          id: t.id,
          patientId: t.patientId,
          recordedById: t.triageNurseId,
          bloodPressure: (t.systolicBP && t.diastolicBP) ? `${t.systolicBP}/${t.diastolicBP}` : undefined,
          heartRate: t.heartRate,
          respiratoryRate: t.respiratoryRate,
          temperature: t.temperature,
          weight: t.weight,
          spO2: t.spO2,
          notes: t.chiefComplaint ? `Triage Complaint: ${t.chiefComplaint}` : undefined,
          recordedAt: t.triageTime,
          recordedBy: t.triageNurse ? {
            id: t.triageNurse.id,
            firstName: t.triageNurse.firstName,
            lastName: t.triageNurse.lastName,
            role: 'NURSE'
          } : undefined
        } as OutpatientVital));
        allVitals = [...allVitals, ...mappedTriageVitals];
      } catch (err) {
        console.error('Error fetching triage vitals:', err);
      }

      // Fetch consultation vitals
      const consResponse = await fetch(`${apiBaseUrl}/api/consultations/patient/${patientId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (consResponse.ok) {
        const consResult = await consResponse.json();
        const consultations = consResult.data || [];

        // Extract vitals from consultations
        const consVitals = consultations
          .filter((c: any) => c.vitalSigns && (c.vitalSigns.bloodPressure || c.vitalSigns.heartRate || c.vitalSigns.temperature || c.vitalSigns.weight || c.vitalSigns.spO2))
          .map((c: any) => ({
            id: c.id,
            patientId: patientId,
            recordedById: c.doctorId,
            consultationId: c.id,
            bloodPressure: c.vitalSigns.bloodPressure || (c.vitalSigns.systolicBP && c.vitalSigns.diastolicBP ? `${c.vitalSigns.systolicBP}/${c.vitalSigns.diastolicBP}` : undefined),
            heartRate: c.vitalSigns.heartRate,
            temperature: c.vitalSigns.temperature,
            weight: c.vitalSigns.weight,
            height: c.vitalSigns.height,
            spO2: c.vitalSigns.spO2,
            recordedAt: c.consultationDate || c.createdAt,
            recordedBy: c.doctor ? {
              id: c.doctor.id,
              firstName: c.doctor.firstName,
              lastName: c.doctor.lastName,
              role: 'DOCTOR'
            } : undefined
          } as OutpatientVital));

        allVitals = [...allVitals, ...consVitals];
      }

      // Sort by recordedAt descending
      allVitals.sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());

      setVitals(allVitals);
    } catch (error) {
      console.error('Error fetching vitals:', error);
    }
  };

  const fetchBranding = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${window.location.protocol}//${window.location.hostname}:3000/api/branding`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setBranding(data.data);
      }
    } catch (error) {
      console.error('Error fetching branding:', error);
    }
  };

  const fetchPatientDetails = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${window.location.protocol}//${window.location.hostname}:3000/api/patients/${patientId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (response.ok) {
        setPatient(data.data);
        // Opportunistic offline read cache — bounded to the patient
        // actually being viewed, not the whole database. See offlineCache.ts.
        cachePatientCore(patientId!, data.data).catch(() => {});
      } else {
        console.error('Failed to fetch patient details:', data.message);
      }
    } catch (error) {
      console.error('Error fetching patient details — falling back to offline cache if available:', error);
      const cached = await getCachedPatientCore(patientId!);
      if (cached) {
        setPatient(cached.data);
        toast.warning(
          'Showing Offline Data',
          `Loaded from a snapshot saved ${new Date(cached.cachedAt).toLocaleString()} — no connection right now.`
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = async () => {
  let brandingData = branding;
  if (!brandingData) {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${window.location.protocol}//${window.location.hostname}:3000/api/branding`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      brandingData = data.data;
      setBranding(brandingData);
    } catch (err) {
      console.error('Could not load branding for print');
    }
  }
  // rest of the existing print code but use brandingData instead of branding

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Medical Record - ${patient?.fullName}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: Arial, sans-serif;
              font-size: 12pt;
              line-height: 1.6;
              color: #000;
              padding: 20px;
              max-width: 800px;
              margin: 0 auto;
            }
            h1 {
              font-size: 24pt;
              margin-bottom: 10px;
              color: #1a1a1a;
            }
            h2 {
              font-size: 18pt;
              margin-top: 30px;
              margin-bottom: 15px;
              padding-bottom: 8px;
              border-bottom: 2px solid #333;
              color: #1a1a1a;
            }
            h3 {
              font-size: 14pt;
              margin-top: 20px;
              margin-bottom: 10px;
              color: #333;
            }
            .clinic-header {
              text-align: center;
              margin-bottom: 20px;
              padding-bottom: 20px;
              border-bottom: 3px solid #333;
            }
            .clinic-logo {
              max-height: 80px;
              margin-bottom: 10px;
            }
            .clinic-name {
              font-size: 20pt;
              font-weight: bold;
              color: #1a1a1a;
              margin-bottom: 5px;
            }
            .clinic-address {
              font-size: 10pt;
              color: #666;
              line-height: 1.4;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              padding-bottom: 20px;
              border-bottom: 2px solid #999;
            }
            .patient-id {
              color: #666;
              font-size: 11pt;
            }
            .section {
              margin-bottom: 25px;
              page-break-inside: avoid;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 15px;
              margin-bottom: 15px;
            }
            .info-item {
              margin-bottom: 10px;
            }
            .label {
              font-weight: bold;
              color: #333;
              display: inline-block;
              min-width: 150px;
            }
            .value {
              color: #000;
            }
            .allergy-alert {
              background-color: #fff;
              border: 3px solid #dc2626;
              padding: 15px;
              margin: 20px 0;
              page-break-inside: avoid;
            }
            .allergy-title {
              color: #dc2626;
              font-weight: bold;
              font-size: 14pt;
              margin-bottom: 10px;
            }
            .allergy-list {
              display: flex;
              flex-wrap: wrap;
              gap: 8px;
              margin-top: 10px;
            }
            .allergy-badge {
              border: 2px solid #dc2626;
              color: #dc2626;
              padding: 5px 12px;
              border-radius: 20px;
              font-weight: bold;
            }
            .chronic-condition {
              border: 1px solid #666;
              padding: 5px 12px;
              border-radius: 20px;
              display: inline-block;
              margin-right: 8px;
              margin-bottom: 8px;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 2px solid #333;
              text-align: center;
              font-size: 10pt;
              color: #666;
            }
            @media print {
              body {
                padding: 0;
              }
              .section {
                page-break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          <div class="clinic-header">
            ${brandingData?.logoUrl ? `<img src="${brandingData.logoUrl}" alt="Clinic Logo" class="clinic-logo" />` : ''}
            <div class="clinic-name">${brandingData?.clinicName || 'Medical Clinic'}</div>
            ${brandingData?.address ? `<div class="clinic-address">${brandingData.address}</div>` : ''}
            ${brandingData?.phone ? `<div class="clinic-address">Phone: ${brandingData.phone}</div>` : ''}
            ${brandingData?.email ? `<div class="clinic-address">Email: ${brandingData.email}</div>` : ''}
          </div>

          <div class="header">
            <h1>${patient?.fullName || 'Patient Medical Record'}</h1>
            <p class="patient-id">Patient ID: ${patient?.patientId}</p>
            <p class="patient-id">Date Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
          </div>

          ${patient?.hasAllergies ? `
            <div class="allergy-alert">
              <div class="allergy-title">⚠️ ALLERGY ALERT</div>
              <p><strong>Known Allergies:</strong></p>
              <div class="allergy-list">
                ${patient?.allergies.map(allergy => `<span class="allergy-badge">${allergy}</span>`).join('')}
              </div>
            </div>
          ` : ''}

          <div class="section">
            <h2>Patient Demographics</h2>
            <div class="info-grid">
              <div class="info-item">
                <span class="label">Full Name:</span>
                <span class="value">${patient?.fullName}</span>
              </div>
              <div class="info-item">
                <span class="label">Patient ID:</span>
                <span class="value">${patient?.patientId}</span>
              </div>
              <div class="info-item">
                <span class="label">Date of Birth:</span>
                <span class="value">${patient?.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString() : 'N/A'}</span>
              </div>
              <div class="info-item">
                <span class="label">Age:</span>
                <span class="value">${patient?.age} years</span>
              </div>
              <div class="info-item">
                <span class="label">Gender:</span>
                <span class="value">${patient?.gender}</span>
              </div>
              <div class="info-item">
                <span class="label">Blood Group:</span>
                <span class="value">${formatBloodGroup(patient?.bloodGroup) || 'Not recorded'}</span>
              </div>
              <div class="info-item">
                <span class="label">Phone:</span>
                <span class="value">${patient?.phone}</span>
              </div>
              <div class="info-item">
                <span class="label">Email:</span>
                <span class="value">${patient?.email || 'Not provided'}</span>
              </div>
            </div>
            <div class="info-item">
              <span class="label">Address:</span>
              <span class="value">${patient?.address || 'Not provided'}</span>
            </div>
          </div>

          ${patient?.emergencyContact ? `
            <div class="section">
              <h2>Emergency Contact</h2>
              <div class="info-grid">
                <div class="info-item">
                  <span class="label">Name:</span>
                  <span class="value">${patient.emergencyContact.name}</span>
                </div>
                <div class="info-item">
                  <span class="label">Relationship:</span>
                  <span class="value">${patient.emergencyContact.relationship}</span>
                </div>
                <div class="info-item">
                  <span class="label">Phone:</span>
                  <span class="value">${patient.emergencyContact.phone}</span>
                </div>
              </div>
            </div>
          ` : ''}

          <div class="section">
            <h2>Medical Information</h2>

            <h3>Allergies</h3>
            ${patient?.allergies && patient.allergies.length > 0 ? `
              <div class="allergy-list">
                ${patient.allergies.map(allergy => `<span class="allergy-badge">${allergy}</span>`).join('')}
              </div>
            ` : '<p>No known allergies</p>'}

            <h3>Chronic Conditions</h3>
            ${patient?.chronicConditions && patient.chronicConditions.length > 0 ? `
              <div>
                ${patient.chronicConditions.map(condition => `<span class="chronic-condition">${condition}</span>`).join('')}
              </div>
            ` : '<p>No chronic conditions recorded</p>'}
          </div>

          <div class="section">
            <h2>Consultation History</h2>
            <p><em>No consultations recorded yet</em></p>
          </div>

          <div class="section">
            <h2>Prescription History</h2>
            <p><em>No prescriptions recorded yet</em></p>
          </div>

          <div class="section">
            <h2>Laboratory Results</h2>
            <p><em>No lab results recorded yet</em></p>
          </div>

          <div class="footer">
            <p><strong>${brandingData?.clinicName || 'Medical Clinic'}</strong></p>
            ${brandingData?.address ? `<p>${brandingData.address}</p>` : ''}
            ${brandingData?.phone || brandingData?.email ? `<p>${brandingData?.phone || ''} ${brandingData?.phone && brandingData?.email ? '|' : ''} ${brandingData?.email || ''}</p>` : ''}
            <p style="margin-top: 15px;">This is a confidential medical record. Handle with care.</p>
            <p>Record generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
            <div style="margin-top:20px;display:flex;justify-content:space-between;align-items:flex-end;">
              <div>
                <p><strong>Document ID:</strong> ${patient?.id}</p>
                <p>Any alteration of this document constitutes fraud.</p>
              </div>
              <div style="text-align:center;">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(`${window.location.origin}/patients?verify=${patient?.id}`)}" style="width:80px;height:80px;" />
                <p style="font-size:8pt;">Scan to verify</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();

    // Wait for content to load then print
    printWindow.onload = () => {
      printWindow.print();
      printWindow.onafterprint = () => {
        printWindow.close();
      };
    };
  };

  const handleEditClick = () => {
    if (!patient) return;

    // Populate edit form with current patient data
    setEditFormData({
      firstName: patient.firstName,
      lastName: patient.lastName,
      dateOfBirth: patient.dateOfBirth.split('T')[0], // Format for date input
      gender: patient.gender,
      phone: patient.phone,
      email: patient.email || '',
      address: patient.address || '',
      city: patient.city || '',
      state: patient.state || '',
      lga: patient.lga || '',
      bloodGroup: patient.bloodGroup || '',
      genotype: patient.genotype || '',
      allergies: patient.allergies || [],
      chronicConditions: patient.chronicConditions || [],
      emergencyContact: patient.emergencyContact || {
        name: '',
        phone: '',
        relationship: '',
      },
      patientType: patient.patientType || 'PRIVATE',
      hmoProvider: patient.hmoProvider || '',
      hmoNumber: patient.hmoNumber || '',
      nhisNumber: patient.nhisNumber || '',
      updateReason: '',
    });
    setShowEditModal(true);
  };

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'state') {
      setEditFormData((prev) => ({
        ...prev,
        state: value,
        lga: '', // Reset LGA when state changes
      }));
    } else if (name.startsWith('emergencyContact.')) {
      const field = name.split('.')[1];
      setEditFormData(prev => ({
        ...prev,
        emergencyContact: {
          ...prev.emergencyContact,
          [field]: value,
        },
      }));
    } else {
      setEditFormData(prev => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const isDOBChangeAllowed = () => {
    if (!patient) return true;

    const registrationDate = new Date(patient.createdAt);
    const today = new Date();
    const daysSinceRegistration = Math.floor((today.getTime() - registrationDate.getTime()) / (1000 * 60 * 60 * 24));

    return daysSinceRegistration <= 7;
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!patient) return;

    // Check if DOB changed and if change is allowed
    const originalDOB = patient.dateOfBirth.split('T')[0];
    if (editFormData.dateOfBirth !== originalDOB && !isDOBChangeAllowed()) {
      toast.warning(
        'Date of Birth Change Restricted',
        'Date of Birth cannot be changed after 7 days of registration. Please contact an administrator.'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Authentication Required', 'Please login first');
        return;
      }

      const payload = {
        firstName: editFormData.firstName,
        lastName: editFormData.lastName,
        dateOfBirth: editFormData.dateOfBirth,
        gender: editFormData.gender,
        phone: editFormData.phone,
        email: editFormData.email || undefined,
        address: editFormData.address || undefined,
        city: editFormData.city || undefined,
        state: editFormData.state || undefined,
        lga: editFormData.lga || undefined,
        bloodGroup: editFormData.bloodGroup || undefined,
        genotype: editFormData.genotype || undefined,
        allergies: editFormData.allergies,
        chronicConditions: editFormData.chronicConditions,
        emergencyContact: editFormData.emergencyContact,
        patientType: editFormData.patientType as 'PRIVATE' | 'HMO',
        hmoProvider: editFormData.patientType === 'HMO' ? editFormData.hmoProvider : undefined,
        hmoNumber: editFormData.patientType === 'HMO' ? editFormData.hmoNumber : undefined,
        nhisNumber: editFormData.nhisNumber || undefined,
        updateReason: editFormData.updateReason || undefined,
        version: (patient as any).version,
      };

      const response = await offlineFetch(
        `${window.location.protocol}//${window.location.hostname}:3000/api/patients/${patient.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        },
        { entityType: 'PATIENT', entityId: patient.id, baseVersion: (patient as any).version }
      );

      const data = await response.json();

      if (response.status === 409) {
        toast.error(
          'Update Conflict',
          'This patient was changed by someone else since you loaded this page. Please reload and try again.'
        );
      } else if (data.queued) {
        toast.success(
          'Saved Offline',
          `${patient.fullName}'s information will sync automatically when your connection returns.`
        );
        setShowEditModal(false);
        fetchPatientDetails();
      } else if (response.ok) {
        toast.success(
          'Patient Updated Successfully!',
          `${patient.fullName}'s information has been updated.`
        );
        setShowEditModal(false);
        // Refresh patient data
        fetchPatientDetails();
      } else {
        toast.error(
          'Update Failed',
          data.message || 'Failed to update patient information.'
        );
      }
    } catch (error) {
      console.error('Error updating patient:', error);
      toast.error(
        'Update Failed',
        'Failed to update patient. Please check your connection and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="card">
        <p className="text-red-600">Failed to load patient details</p>
      </div>
    );
  }

  const tabs = [ 
    { id: 'demographics' as TabType, label: 'Demographics', icon: User },
    { id: 'medical' as TabType, label: 'Medical Summary', icon: Heart },
    { id: 'consultations' as TabType, label: 'Consultations', icon: FileText },
    { id: 'prescriptions' as TabType, label: 'Prescriptions', icon: Pill },
    { id: 'labs' as TabType, label: 'Lab Results', icon: TestTube },
    { id: 'admissions' as TabType, label: 'Admissions', icon: Bed },
    { id: 'anc' as TabType, label: 'Maternal Care', icon: Baby },
    { id: 'immunizations' as TabType, label: 'Immunizations', icon: Syringe },
    { id: 'timeline' as TabType, label: 'Timeline', icon: Clock },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <button
              onClick={onBack}
              className="text-blue-600 hover:text-blue-700 mb-2 flex items-center text-sm"
            >
              ← Back to Search
            </button>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold">{patient.fullName}</h2>
              {patient.patientType === 'HMO' ? (
                <span className="px-2 py-1 text-xs font-semibold bg-purple-100 text-purple-800 rounded-full border border-purple-200">
                  HMO Patient
                </span>
              ) : (
                <span className="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full border border-blue-200">
                  Private Patient
                </span>
              )}
            </div>
            <p className="text-gray-600">Patient ID: {patient.patientId}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowTriageModal(true)}
              className="btn btn-primary flex items-center gap-2"
            >
              <Heart className="w-4 h-4" />
              Take Vitals (Triage)
            </button>
            <button
              onClick={handleEditClick}
              className="btn btn-secondary flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              Edit Patient
            </button>
            <button
              onClick={handlePrint}
              className="btn btn-secondary flex items-center gap-2"
            >
            <Printer className="w-4 h-4" />
            Print Medical Report
          </button>
        </div>
      </div>

        {/* Allergy Warning Banner */}
        {patient.hasAllergies && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="w-5 h-5" />
              <span className="font-semibold">ALLERGY ALERT</span>
            </div>
            <div className="mt-2">
              <p className="text-sm text-red-700 font-medium">Known Allergies:</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {patient.allergies.map((allergy, index) => (
                  <span
                    key={index}
                    className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium"
                  >
                    {allergy}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex space-x-8 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="card">
        {activeTab === 'demographics' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-lg font-semibold">Personal Information</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm text-gray-600">Full Name</label>
                <p className="font-medium">{patient.fullName}</p>
              </div>
              <div>
                <label className="text-sm text-gray-600">Patient ID</label>
                <p className="font-medium">{patient.patientId}</p>
              </div>
              <div>
                <label className="text-sm text-gray-600">Date of Birth</label>
                <p className="font-medium">
                  {new Date(patient.dateOfBirth).toLocaleDateString()} ({patient.age} years old)
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-600">Gender</label>
                <p className="font-medium">{patient.gender}</p>
              </div>
              <div>
                <label className="text-sm text-gray-600">Phone</label>
                <p className="font-medium">{patient.phone}</p>
              </div>
              <div>
                <label className="text-sm text-gray-600">Email</label>
                <p className="font-medium">{patient.email || 'Not provided'}</p>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm text-gray-600">Address</label>
                <p className="font-medium">
                  {patient.address || 'Not provided'}
                  {patient.city && `, ${patient.city}`}
                  {patient.state && `, ${patient.state}`}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-600">Registration Date</label>
                <p className="font-medium">{formatDate(patient.createdAt)}</p>
              </div>
              <div>
                <label className="text-sm text-gray-600">Last Updated</label>
                <p className="font-medium">{formatDate(patient.updatedAt)}</p>
              </div>
            </div>

            <h3 className="text-lg font-semibold border-b pb-2 mt-8">Insurance & Billing Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
              <div>
                <label className="text-sm text-gray-600">Patient Type</label>
                <p className="font-medium">
                  {patient.patientType === 'HMO' ? 'HMO / Insurance' : 'Private (Out of pocket)'}
                </p>
              </div>
              {patient.patientType === 'HMO' && (
                <>
                  <div>
                    <label className="text-sm text-gray-600">HMO Provider</label>
                    <p className="font-medium">{patient.hmoProvider || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">HMO Number</label>
                    <p className="font-medium">{patient.hmoNumber || 'N/A'}</p>
                  </div>
                </>
              )}
              <div>
                <label className="text-sm text-gray-600">NHIS Number</label>
                <p className="font-medium">{patient.nhisNumber || 'Not provided'}</p>
              </div>
            </div>

            {patient.emergencyContact && (
              <>
                <h3 className="text-lg font-semibold border-b pb-2 mt-8">Emergency Contact</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="text-sm text-gray-600">Name</label>
                    <p className="font-medium">{patient.emergencyContact.name}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Relationship</label>
                    <p className="font-medium">{patient.emergencyContact.relationship}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Phone</label>
                    <p className="font-medium">{patient.emergencyContact.phone}</p>
                  </div>
                </div>
              </>
            )}

            {/* Consent Information - US-PAT-006 */}
            <div className="mt-8">
              <h3 className="text-lg font-semibold border-b pb-2 flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" />
                Data Processing Consent
              </h3>
              <div className={`mt-4 p-4 rounded-lg border-2 ${
                patient.consentGiven
                  ? 'bg-green-50 border-green-300'
                  : 'bg-red-50 border-red-300'
              }`}>
                <div className="flex items-start gap-3">
                  {patient.consentGiven ? (
                    <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className={`font-semibold ${
                        patient.consentGiven ? 'text-green-900' : 'text-red-900'
                      }`}>
                        {patient.consentGiven ? 'Consent Granted' : 'Consent Not Provided'}
                      </h4>
                      <button
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
                        onClick={() => setShowConsentHistoryModal(true)}
                      >
                        View History
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    {patient.consentGiven ? (
                      <div className="space-y-2 text-sm">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <span className="text-green-700 font-medium">Consent Date:</span>
                            <p className="text-green-800">
                              {patient.consentDate
                                ? new Date(patient.consentDate).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })
                                : 'Not recorded'}
                            </p>
                          </div>
                          <div>
                            <span className="text-green-700 font-medium">Consent Version:</span>
                            <p className="text-green-800">{patient.consentVersion || '1.0'}</p>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-green-200">
                          <p className="text-xs text-green-700">
                            <strong>Authorized purposes:</strong> Medical care and treatment, medical records maintenance,
                            billing and insurance, legal and regulatory compliance, quality improvement and patient safety.
                          </p>
                          <p className="text-xs text-green-600 mt-2">
                            Data protected in accordance with GDPR and NDPR regulations.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-red-700">
                        Patient has not provided consent for data processing. Please obtain consent before proceeding with data collection.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'medical' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold border-b pb-2">Medical Summary</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm text-gray-600">Blood Group</label>
                <p className="font-medium text-lg">
                  {formatBloodGroup(patient.bloodGroup) || (
                    <span className="text-gray-400 text-base">Not recorded</span>
                  )}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-600">Genotype</label>
                <p className="font-medium text-lg">
                  {patient.genotype || (
                    <span className="text-gray-400 text-base">Not recorded</span>
                  )}
                </p>
              </div>
            </div>

            {/* Allergies - Highlighted */}
            <div>
              <label className="text-sm text-gray-600 flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                Known Allergies
              </label>
              {patient.allergies.length > 0 ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex flex-wrap gap-2">
                    {patient.allergies.map((allergy, index) => (
                      <span
                        key={index}
                        className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1"
                      >
                        <AlertCircle className="w-3 h-3" />
                        {allergy}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-gray-400">No known allergies</p>
              )}
            </div>

            {/* Chronic Conditions */}
            <div>
              <label className="text-sm text-gray-600 mb-2 block">Chronic Conditions</label>
              {patient.chronicConditions.length > 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex flex-wrap gap-2">
                    {patient.chronicConditions.map((condition, index) => (
                      <span
                        key={index}
                        className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium"
                      >
                        {condition}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-gray-400">No chronic conditions recorded</p>
              )}
            </div>

            {/* Recent Vitals */}
            <div className="pt-4 border-t border-gray-100">
              <label className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-500" />
                Recent Vitals
              </label>
              {vitals.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {vitals.slice(0, 4).map((vital, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-100 shadow-sm">
                      <div className="text-xs text-gray-500 mb-2 flex items-center justify-between">
                        <span>{formatDate(vital.recordedAt)}</span>
                      </div>
                      <div className="space-y-2">
                        {vital.bloodPressure && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">BP:</span>
                            <span className="text-sm font-medium">{vital.bloodPressure} <span className="text-xs text-gray-400">mmHg</span></span>
                          </div>
                        )}
                        {vital.heartRate && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">PR:</span>
                            <span className="text-sm font-medium">{vital.heartRate} <span className="text-xs text-gray-400">bpm</span></span>
                          </div>
                        )}
                        {vital.temperature && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Temp:</span>
                            <span className="text-sm font-medium">{vital.temperature}°C</span>
                          </div>
                        )}
                        {vital.weight && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Weight:</span>
                            <span className="text-sm font-medium">{vital.weight} <span className="text-xs text-gray-400">kg</span></span>
                          </div>
                        )}
                        {vital.spO2 && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">SpO2:</span>
                            <span className="text-sm font-medium">{vital.spO2}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm">No vitals recorded recently</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'consultations' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2 flex items-center justify-between">
              Consultation History
              <button
                className="btn btn-primary text-sm py-1 px-3"
                onClick={() => navigate('/consultations', { state: { patientId: patient?.id, patientName: patient?.fullName } })}
              >
                Schedule Consultation
              </button>
            </h3>
            {timelineLoading ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : patientConsultations.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p>No consultations recorded yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {patientConsultations.map((c: any) => (
                  <div key={c.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium text-gray-900">{c.doctorName ? `Dr. ${c.doctorName}` : 'Doctor Consultation'}</h4>
                        <p className="text-sm text-gray-500">
                          {formatDate(c.consultationDate || c.createdAt)}
                        </p>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        c.status === 'COMPLETED' || c.status === 'FINALIZED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {c.status}
                      </span>
                    </div>
                    {c.assessment && (
                      <div className="mt-3">
                        <p className="text-sm font-medium text-gray-700">Diagnosis/Assessment:</p>
                        <p className="text-sm text-gray-600 mt-1">{c.assessment}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'prescriptions' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-lg font-semibold">Prescription History</h3>
              <button
                onClick={() => setShowPrescriptionModal(true)}
                className="btn btn-primary flex items-center gap-2 text-sm"
              >
                <Pill className="w-4 h-4" /> Add Prescription
              </button>
            </div>
            {timelineLoading ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : patientPrescriptions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Pill className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p>No prescriptions recorded yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {patientPrescriptions.map((p: any) => (
                  <div key={p.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium text-gray-900">{p.medication?.name || p.medicationName || 'Medication'}</h4>
                        <p className="text-sm text-gray-500">
                          {p.dosage} - {p.frequency} for {p.duration}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Prescribed: {formatDate(p.createdAt)}
                          {p.dispensedAt && ` · Dispensed: ${formatDate(p.dispensedAt)}`}
                        </p>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        p.status === 'DISPENSED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {p.status || 'PENDING'}
                      </span>
                    </div>
                    {p.instructions && (
                      <div className="mt-2 text-sm text-gray-600">
                        <span className="font-medium">Instructions:</span> {p.instructions}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'labs' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Laboratory Results</h3>
            {labResultsLoading ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : labResults.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <TestTube className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p>No lab results recorded yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {labResults.map((lab: any) => (
                  <div key={lab.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium text-gray-900">{lab.testName || lab.labTest?.name || 'Lab Test'}</h4>
                        <p className="text-sm text-gray-500">
                          {formatDate(lab.orderedAt || lab.createdAt)}
                        </p>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        lab.status === 'COMPLETED' || lab.status === 'REVIEWED' ? 'bg-green-100 text-green-800' :
                        lab.status === 'SAMPLE_COLLECTED' || lab.status === 'PROCESSING' ? 'bg-blue-100 text-blue-800' :
                        lab.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {lab.status?.replace(/_/g, ' ')}
                      </span>
                    </div>
                    {lab.results && (
                      <div className="mt-3 bg-gray-50 rounded p-3">
                        <p className="text-sm font-medium text-gray-700 mb-1">Results:</p>
                        <p className="text-sm text-gray-600 whitespace-pre-wrap">{typeof lab.results === 'string' ? lab.results : JSON.stringify(lab.results, null, 2)}</p>
                      </div>
                    )}
                    {lab.urgency && (
                      <div className="mt-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                          lab.urgency === 'STAT' ? 'bg-red-100 text-red-700' :
                          lab.urgency === 'URGENT' ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {lab.urgency}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'admissions' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2 flex items-center justify-between">
              Admission History
            </h3>
            {admissionsLoading ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : admissions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Bed className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p>No admissions recorded for this patient.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {admissions.map(adm => (
                  <div 
                    key={adm.id} 
                    onClick={() => navigate(`/inpatient/${adm.id}`)}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium text-gray-900">{adm.reason}</h4>
                        <p className="text-sm text-gray-500">
                          {adm.bed?.ward?.name} - Bed {adm.bed?.bedNumber}
                        </p>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        adm.status === 'ADMITTED' ? 'bg-primary-100 text-primary-800' : 
                        adm.status === 'DISCHARGED' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {adm.status}
                      </span>
                    </div>
                    <div className="flex items-center text-xs text-gray-500 gap-4">
                      <span>Admitted: {new Date(adm.admissionDate).toLocaleDateString()}</span>
                      {adm.dischargeDate && <span>Discharged: {new Date(adm.dischargeDate).toLocaleDateString()}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Patient Timeline</h3>
            <div className="space-y-4">
              {timelineLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-500 mt-4">Loading timeline events...</p>
                </div>
              ) : timelineEvents.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-sm">No medical events found.</p>
                </div>
              ) : (
                timelineEvents.map((event, index) => {
                  const Icon = event.icon;
                  const isLast = index === timelineEvents.length - 1;
                  return (
                    <div key={event.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${event.colorClass}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        {!isLast && <div className="w-0.5 h-full bg-gray-200 mt-2"></div>}
                      </div>
                      <div className={`flex-1 ${!isLast ? 'pb-8' : ''}`}>
                        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex flex-wrap items-center justify-between mb-2 gap-2">
                            <h4 className="font-semibold text-gray-900">{event.title}</h4>
                            <span className="text-sm text-gray-500 bg-gray-50 px-2 py-1 rounded border">
                              {formatDate(event.date)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700">
                            {event.description}
                          </p>
                          {event.type === 'REGISTRATION' && (
                            <p className="text-xs text-gray-500 mt-2">
                              Patient ID: {patient.patientId}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === 'anc' && (
          <AncTab patientId={patient.id} />
        )}

        {activeTab === 'immunizations' && (
          <ImmunizationsTab patientId={patient.id} />
        )}
      </div>

      {showTriageModal && patient && (
        <TriageAssessmentModal
          isOpen={showTriageModal}
          onClose={() => setShowTriageModal(false)}
          patientId={patient.id}
          patientName={patient.fullName}
          onSuccess={() => {
            setShowTriageModal(false);
            toast.success('Success', 'Vitals and Triage recorded successfully');
          }}
        />
      )}

      {showPrescriptionModal && patient && (
        <PrescriptionModal
          context={{ type: 'general' }}
          patient={{
            id: patient.id,
            firstName: patient.firstName,
            lastName: patient.lastName,
            fullName: patient.fullName,
            allergies: patient.allergies || [],
          }}
          onClose={() => setShowPrescriptionModal(false)}
          onSuccess={() => {
            setShowPrescriptionModal(false);
            toast.success('Success', 'Prescription created successfully');
            fetchTimelineEvents();
          }}
        />
      )}

      {/* Consent History Modal - US-PAT-006 */}
      {showConsentHistoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl m-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Shield className="w-6 h-6 text-blue-600" />
                Consent History
              </h3>
              <button
                onClick={() => setShowConsentHistoryModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <span className="text-2xl">&times;</span>
              </button>
            </div>

            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">Current Consent Status</h4>
              <div className="flex items-center gap-2">
                {patient?.consentGiven ? (
                  <>
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-green-700">Active Consent</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <span className="font-medium text-red-700">No Active Consent</span>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-gray-700 border-b pb-2">Consent Timeline</h4>

              {/* Consent History Timeline */}
              <div className="space-y-4">
                {patient?.consentGiven && patient.consentDate ? (
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </div>
                      <div className="w-0.5 h-full bg-gray-200 mt-2"></div>
                    </div>
                    <div className="flex-1 pb-6">
                      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-semibold text-green-700">Consent Granted</h5>
                          <span className="text-sm text-gray-500">
                            {new Date(patient.consentDate).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <div className="text-sm space-y-2">
                          <p className="text-gray-700">
                            <strong>Version:</strong> {patient.consentVersion || '1.0'}
                          </p>
                          <p className="text-gray-700">
                            <strong>Consent Type:</strong> Data Processing Consent
                          </p>
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-xs text-gray-600">
                              <strong>Authorized purposes:</strong>
                            </p>
                            <ul className="text-xs text-gray-600 list-disc list-inside mt-1 space-y-1">
                              <li>Providing medical care and treatment</li>
                              <li>Maintaining medical records</li>
                              <li>Billing and insurance purposes</li>
                              <li>Legal and regulatory compliance</li>
                              <li>Quality improvement and patient safety</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No consent records available</p>
                    <p className="text-sm mt-2">Patient has not provided data processing consent</p>
                  </div>
                )}

                {/* Registration Event */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-semibold text-blue-700">Patient Registered</h5>
                        <span className="text-sm text-gray-500">
                          {patient && new Date(patient.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Patient record created in the system
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Patient ID: {patient?.patientId}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t">
              <div className="bg-gray-50 rounded-lg p-4">
                <h5 className="font-semibold text-sm text-gray-700 mb-2">Patient Rights</h5>
                <p className="text-xs text-gray-600">
                  Under GDPR and NDPR regulations, patients have the right to:
                </p>
                <ul className="text-xs text-gray-600 list-disc list-inside mt-2 space-y-1">
                  <li>Access their personal and medical data</li>
                  <li>Request corrections to their data</li>
                  <li>Request deletion of their data (subject to legal requirements)</li>
                  <li>Withdraw consent at any time</li>
                  <li>Request data portability</li>
                </ul>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowConsentHistoryModal(false)}
                className="btn btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal - US-PAT-005 */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl m-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Edit Patient Information</h3>

            <form onSubmit={handleEditSubmit}>
              {/* Personal Information */}
              <div className="mb-6">
                <h4 className="font-semibold mb-3 text-lg border-b pb-2">Personal Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">First Name *</label>
                    <input
                      type="text"
                      name="firstName"
                      value={editFormData.firstName}
                      onChange={handleEditInputChange}
                      className="input w-full"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Last Name *</label>
                    <input
                      type="text"
                      name="lastName"
                      value={editFormData.lastName}
                      onChange={handleEditInputChange}
                      className="input w-full"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Date of Birth *
                      {!isDOBChangeAllowed() && (
                        <span className="text-xs text-red-600 ml-2">
                          (Cannot be changed after 7 days)
                        </span>
                      )}
                    </label>
                    <input
                      type="date"
                      name="dateOfBirth"
                      value={editFormData.dateOfBirth}
                      onChange={handleEditInputChange}
                      className="input w-full"
                      disabled={!isDOBChangeAllowed()}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Gender *</label>
                    <Dropdown
                      name="gender"
                      value={editFormData.gender}
                      onChange={handleEditInputChange}
                      className="input w-full"
                      required
                    >
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </Dropdown>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Phone (+234XXXXXXXXXX) *</label>
                    <input
                      type="tel"
                      name="phone"
                      value={editFormData.phone}
                      onChange={handleEditInputChange}
                      placeholder="+2348012345678"
                      className="input w-full"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Email</label>
                    <input
                      type="email"
                      name="email"
                      value={editFormData.email}
                      onChange={handleEditInputChange}
                      className="input w-full"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">Address</label>
                    <input
                      type="text"
                      name="address"
                      value={editFormData.address}
                      onChange={handleEditInputChange}
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">City</label>
                    <input
                      type="text"
                      name="city"
                      value={editFormData.city}
                      onChange={handleEditInputChange}
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">State *</label>
                    <Dropdown
                      name="state"
                      value={editFormData.state}
                      onChange={handleEditInputChange}
                      className="input w-full"
                      required
                    >
                      <option value="">Select State</option>
                      {NIGERIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </Dropdown>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">LGA</label>
                    <Dropdown
                      name="lga"
                      value={editFormData.lga}
                      onChange={handleEditInputChange}
                      className="input w-full"
                      disabled={!editFormData.state}
                    >
                      <option value="">Select LGA</option>
                      {editFormData.state && NIGERIA_LGA_MAP[editFormData.state]
                        ? NIGERIA_LGA_MAP[editFormData.state].map(l => (
                            <option key={l} value={l}>{l}</option>
                          ))
                        : null}
                    </Dropdown>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Patient ID</label>
                    <input
                      type="text"
                      value={patient?.patientId || ''}
                      className="input w-full bg-gray-100"
                      disabled
                    />
                    <p className="text-xs text-gray-500 mt-1">Patient ID cannot be changed</p>
                  </div>
                </div>
              </div>

              {/* Medical Information */}
              <div className="mb-6">
                <h4 className="font-semibold mb-3 text-lg border-b pb-2">Medical Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Blood Group</label>
                    <Dropdown
                      name="bloodGroup"
                      value={editFormData.bloodGroup}
                      onChange={handleEditInputChange}
                      className="input w-full"
                    >
                      <option value="">Select...</option>
                      <option value="A_POSITIVE">A+</option>
                      <option value="A_NEGATIVE">A-</option>
                      <option value="B_POSITIVE">B+</option>
                      <option value="B_NEGATIVE">B-</option>
                      <option value="AB_POSITIVE">AB+</option>
                      <option value="AB_NEGATIVE">AB-</option>
                      <option value="O_POSITIVE">O+</option>
                      <option value="O_NEGATIVE">O-</option>
                    </Dropdown>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Genotype</label>
                    <Dropdown
                      name="genotype"
                      value={editFormData.genotype}
                      onChange={handleEditInputChange}
                      className="input w-full"
                    >
                      <option value="">Select...</option>
                      <option value="AA">AA</option>
                      <option value="AS">AS</option>
                      <option value="SS">SS</option>
                      <option value="AC">AC</option>
                      <option value="SC">SC</option>
                    </Dropdown>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">Allergies (comma-separated)</label>
                    <textarea
                      name="allergies"
                      value={editFormData.allergies.join(', ')}
                      onChange={(e) => {
                        const allergiesArray = e.target.value.split(',').map(a => a.trim()).filter(a => a);
                        setEditFormData(prev => ({ ...prev, allergies: allergiesArray }));
                      }}
                      placeholder="e.g., Penicillin, Peanuts"
                      className="input w-full"
                      rows={2}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">Chronic Conditions (comma-separated)</label>
                    <textarea
                      name="chronicConditions"
                      value={editFormData.chronicConditions.join(', ')}
                      onChange={(e) => {
                        const conditionsArray = e.target.value.split(',').map(c => c.trim()).filter(c => c);
                        setEditFormData(prev => ({ ...prev, chronicConditions: conditionsArray }));
                      }}
                      placeholder="e.g., Diabetes, Hypertension"
                      className="input w-full"
                      rows={2}
                    />
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="mb-6">
                <h4 className="font-semibold mb-3 text-lg border-b pb-2">Emergency Contact *</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Name *</label>
                    <input
                      type="text"
                      name="emergencyContact.name"
                      value={editFormData.emergencyContact.name}
                      onChange={handleEditInputChange}
                      className="input w-full"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Relationship *</label>
                    <input
                      type="text"
                      name="emergencyContact.relationship"
                      value={editFormData.emergencyContact.relationship}
                      onChange={handleEditInputChange}
                      className="input w-full"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Phone (+234XXXXXXXXXX) *</label>
                    <input
                      type="tel"
                      name="emergencyContact.phone"
                      value={editFormData.emergencyContact.phone}
                      onChange={handleEditInputChange}
                      placeholder="+2348012345678"
                      className="input w-full"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Insurance & Billing Details */}
              <div className="mb-6">
                <h4 className="font-semibold mb-3 text-lg border-b pb-2">Insurance & Billing Details</h4>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">Patient Type *</label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="patientType"
                        value="PRIVATE"
                        checked={editFormData.patientType === 'PRIVATE'}
                        onChange={handleEditInputChange}
                        className="text-primary focus:ring-primary"
                      />
                      Private Patient
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="patientType"
                        value="HMO"
                        checked={editFormData.patientType === 'HMO'}
                        onChange={handleEditInputChange}
                        className="text-primary focus:ring-primary"
                      />
                      HMO / Insurance
                    </label>
                  </div>
                </div>

                {editFormData.patientType === 'HMO' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">HMO Provider Name *</label>
                      <input
                        type="text"
                        name="hmoProvider"
                        value={editFormData.hmoProvider}
                        onChange={handleEditInputChange}
                        className="input w-full"
                        required={editFormData.patientType === 'HMO'}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">HMO ID / Number *</label>
                      <input
                        type="text"
                        name="hmoNumber"
                        value={editFormData.hmoNumber}
                        onChange={handleEditInputChange}
                        className="input w-full"
                        required={editFormData.patientType === 'HMO'}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-1">NHIS Number (Optional)</label>
                  <input
                    type="text"
                    name="nhisNumber"
                    value={editFormData.nhisNumber}
                    onChange={handleEditInputChange}
                    className="input w-full"
                  />
                </div>
              </div>

              {/* Update Reason - US-PAT-005 */}
              <div className="mb-6">
                <h4 className="font-semibold mb-3 text-lg border-b pb-2">Update Information</h4>
                <div>
                  <label className="block text-sm font-medium mb-1">Reason for Update (Optional)</label>
                  <textarea
                    name="updateReason"
                    value={editFormData.updateReason}
                    onChange={handleEditInputChange}
                    placeholder="Please provide a reason for this update (optional)"
                    className="input w-full"
                    rows={3}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This information will be recorded in the audit log
                  </p>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      
    </div>
  );
};

export default PatientDetailView;