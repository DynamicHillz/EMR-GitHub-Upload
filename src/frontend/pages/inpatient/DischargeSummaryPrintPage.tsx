import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FileText } from 'lucide-react';
import ErrorAlert from '../../components/common/ErrorAlert';
import InpatientService from '../../services/InpatientService';
import { getErrorMessage } from '../../utils/errorHandler';

interface TtoMedication {
  medicationName: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
}

const DischargeSummaryPrintPage: React.FC = () => {
  const { admissionId } = useParams<{ admissionId: string }>();
  const [admission, setAdmission] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [branding, setBranding] = useState<any>(null);
  const [brandingLoaded, setBrandingLoaded] = useState(false);

  useEffect(() => {
    fetchAdmission();
    fetchBranding();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admissionId]);

  const fetchAdmission = async () => {
    try {
      const data = await InpatientService.getAdmissionById(admissionId!);
      if (!data.dischargeSummary) {
        throw new Error('This admission has not been discharged yet');
      }
      setAdmission(data);
    } catch (err) {
      setError(getErrorMessage(err, 'An error occurred'));
    } finally {
      setLoading(false);
    }
  };

  const fetchBranding = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${window.location.protocol}//${window.location.hostname}:3000/api/branding`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) setBranding(data.data);
    } catch (err) {
      console.error('Error fetching branding:', err);
    } finally {
      setBrandingLoaded(true);
    }
  };

  useEffect(() => {
    // Wait on branding too (not just the admission) so the logo/clinic name
    // has actually arrived before the print dialog fires — otherwise this
    // prints with the fallback/blank header the first time, same mistake
    // the old hardcoded "St. Stephen EMR" header was making permanently.
    if (admission && !loading && brandingLoaded) {
      setTimeout(() => window.print(), 500);
    }
  }, [admission, loading, brandingLoaded]);

  const clinicName = branding?.clinicName || 'St. Stephen EMR';

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-xl text-gray-500 font-semibold animate-pulse">Loading discharge summary...</div>
      </div>
    );
  }

  if (error || !admission) {
    return (
      <div className="p-8">
        <ErrorAlert message={error || 'Admission not found'} />
      </div>
    );
  }

  const summary = admission.dischargeSummary;
  const ttoMedications: TtoMedication[] = Array.isArray(summary.ttoMedications) ? summary.ttoMedications : [];
  const primaryDiagnosis = admission.diagnoses?.find((d: any) => d.isPrimary && !d.isAdmission)?.diagnosis
    || admission.diagnoses?.find((d: any) => !d.isAdmission)?.diagnosis;

  return (
    <div className="bg-white min-h-screen text-black p-8 font-sans print:p-0 print:m-0">
      <style>
        {`
          @media print {
            @page { margin: 1.5cm; size: A4; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: white !important; }
            .no-print { display: none !important; }
          }
        `}
      </style>

      <div className="no-print mb-8 pb-4 border-b border-gray-200 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Print Preview</h1>
          <p className="text-gray-500">Review the discharge summary before printing.</p>
        </div>
        <button
          onClick={() => window.print()}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 shadow-sm flex items-center gap-2"
        >
          <FileText className="w-5 h-5" />
          Print Now
        </button>
      </div>

      <div className="max-w-4xl mx-auto border border-gray-300 p-8 shadow-sm print:border-none print:shadow-none print:p-0">
        <div className="border-b-2 border-blue-900 pb-6 mb-6">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              {branding?.logoUrl && (
                <img src={branding.logoUrl} alt={clinicName} className="h-14 w-auto object-contain" />
              )}
              <div>
                <h1 className="text-3xl font-bold text-blue-900 tracking-tight uppercase">{clinicName}</h1>
                <p className="text-gray-600 mt-1">Inpatient Services Department</p>
                {branding?.address && <p className="text-xs text-gray-500 mt-1">{branding.address}</p>}
                {(branding?.phone || branding?.email) && (
                  <p className="text-xs text-gray-500">
                    {branding?.phone && <>Tel: {branding.phone}</>}
                    {branding?.phone && branding?.email && ' · '}
                    {branding?.email && <>{branding.email}</>}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-semibold text-gray-800">Discharge Summary</h2>
              <p className="text-gray-500 mt-1 font-mono text-sm">Admission ID: {admission.id.slice(0, 8)}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="font-bold text-gray-800 uppercase tracking-wider text-xs mb-3 border-b pb-2">Patient Details</h3>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-gray-500">Name:</div>
              <div className="col-span-2 font-semibold">{admission.patient?.firstName} {admission.patient?.lastName}</div>
              <div className="text-gray-500">Patient ID:</div>
              <div className="col-span-2">{admission.patient?.patientId}</div>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="font-bold text-gray-800 uppercase tracking-wider text-xs mb-3 border-b pb-2">Admission Details</h3>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-gray-500">Ward/Bed:</div>
              <div className="col-span-2">{admission.bed?.ward?.name} — Bed {admission.bed?.bedNumber}</div>
              <div className="text-gray-500">Admitted:</div>
              <div className="col-span-2">{new Date(admission.admissionDate).toLocaleDateString()}</div>
              <div className="text-gray-500">Discharged:</div>
              <div className="col-span-2">{admission.dischargeDate ? new Date(admission.dischargeDate).toLocaleDateString() : 'N/A'}</div>
              {primaryDiagnosis && (
                <>
                  <div className="text-gray-500">Diagnosis:</div>
                  <div className="col-span-2">{primaryDiagnosis.title || primaryDiagnosis.code}</div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="mb-8">
          <h3 className="font-bold text-gray-800 uppercase tracking-wider text-xs mb-2">Final Notes / Course in Hospital</h3>
          <div className="bg-gray-50 border border-gray-200 p-4 rounded text-sm text-gray-700 whitespace-pre-wrap">
            {summary.finalNotes}
          </div>
        </div>

        {summary.followUpPlan && (
          <div className="mb-8">
            <h3 className="font-bold text-gray-800 uppercase tracking-wider text-xs mb-2">Follow-up Plan</h3>
            <div className="bg-gray-50 border border-gray-200 p-4 rounded text-sm text-gray-700 whitespace-pre-wrap">
              {summary.followUpPlan}
            </div>
          </div>
        )}

        <div className="mb-8">
          <h3 className="font-bold text-gray-800 uppercase tracking-wider text-xs mb-2">Medications to Take Home (TTO)</h3>
          {ttoMedications.length === 0 ? (
            <p className="text-sm text-gray-500 italic">None prescribed at discharge.</p>
          ) : (
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-700 uppercase tracking-wider text-xs">
                  <th className="py-2 px-4 border-y border-gray-300">Medication</th>
                  <th className="py-2 px-4 border-y border-gray-300">Dosage</th>
                  <th className="py-2 px-4 border-y border-gray-300">Frequency</th>
                  <th className="py-2 px-4 border-y border-gray-300">Duration</th>
                  <th className="py-2 px-4 border-y border-gray-300">Instructions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {ttoMedications.map((med, index) => (
                  <tr key={index}>
                    <td className="py-2 px-4 font-medium text-gray-900">{med.medicationName}</td>
                    <td className="py-2 px-4 text-gray-600">{med.dosage || '-'}</td>
                    <td className="py-2 px-4 text-gray-600">{med.frequency || '-'}</td>
                    <td className="py-2 px-4 text-gray-600">{med.duration || '-'}</td>
                    <td className="py-2 px-4 text-gray-600">{med.instructions || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-16 pt-8 border-t border-gray-300 grid grid-cols-2 gap-8 text-sm">
          <div>
            <p className="text-gray-500 mb-6">Discharged By</p>
            <div className="border-b border-gray-400 w-3/4 mb-2"></div>
            <p className="font-semibold text-gray-800">Attending Physician</p>
          </div>
          <div className="text-right">
            <p className="text-gray-500 mb-6">Date</p>
            <div className="border-b border-gray-400 w-3/4 ml-auto mb-2"></div>
            <p className="font-semibold text-gray-800">
              {admission.dischargeDate ? new Date(admission.dischargeDate).toLocaleDateString() : ''}
            </p>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-gray-400 border-t pt-4">
          <p>This report is electronically generated. {clinicName}</p>
          <p className="mt-1 font-mono">Admission ID: {admission.id}</p>
        </div>
      </div>
    </div>
  );
};

export default DischargeSummaryPrintPage;
