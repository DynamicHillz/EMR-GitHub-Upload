import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, FileText } from 'lucide-react';
import ErrorAlert from '../../components/common/ErrorAlert';
import { getErrorMessage } from '../../utils/errorHandler';

interface LabTest {
  id: string;
  patientId: string;
  patientName: string;
  patientAge: number;
  patientGender: string;
  testName: string;
  testCode: string | null;
  clinicalIndication: string | null;
  urgency: string;
  status: string;
  orderedBy: string;
  orderedByName: string;
  accessionNumber: string | null;
  collectedAt: string | null;
  results: LabResultItem[] | null;
  resultNotes: string | null;
  abnormalFlags: AbnormalFlag[] | null;
  reviewedBy: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

interface LabResultItem {
  parameter: string;
  loincCode?: string | null;
  value: string;
  unit: string;
  referenceRange?: string;
}

interface AbnormalFlag {
  parameter: string;
  value: string;
  referenceRange: string;
  severity: 'HIGH' | 'LOW' | 'CRITICAL_HIGH' | 'CRITICAL_LOW' | 'ABNORMAL';
}

const LabReportPrintPage: React.FC = () => {
  const { testId } = useParams<{ testId: string }>();
  const [labTest, setLabTest] = useState<LabTest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTestDetails();
  }, [testId]);

  const fetchTestDetails = async () => {
    try {
      const token = localStorage.getItem('token');
      const tenantId = localStorage.getItem('tenantId');
      
      const response = await fetch(
        `${window.location.protocol}//${window.location.hostname}:3000/api/lab/queue/${testId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'x-tenant-id': tenantId || '',
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch test details');

      const data = await response.json();
      setLabTest(data.data);
    } catch (err) {
      setError(getErrorMessage(err, 'An error occurred'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Automatically trigger print dialog when data is loaded
    if (labTest && !loading) {
      // Small timeout to ensure rendering is fully complete
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, [labTest, loading]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-xl text-gray-500 font-semibold animate-pulse">Loading report...</div>
      </div>
    );
  }

  if (error || !labTest) {
    return (
      <div className="p-8">
        <ErrorAlert message={error || 'Test not found'} />
      </div>
    );
  }

  const isAbnormal = labTest.abnormalFlags && labTest.abnormalFlags.length > 0;

  return (
    <div className="bg-white min-h-screen text-black p-8 font-sans print:p-0 print:m-0">
      <style>
        {`
          @media print {
            @page {
              margin: 1.5cm;
              size: A4;
            }
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              background-color: white !important;
            }
            .no-print {
              display: none !important;
            }
          }
        `}
      </style>

      {/* Action bar for screen only */}
      <div className="no-print mb-8 pb-4 border-b border-gray-200 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Print Preview</h1>
          <p className="text-gray-500">Review the report before printing.</p>
        </div>
        <button
          onClick={() => window.print()}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 shadow-sm flex items-center gap-2"
        >
          <FileText className="w-5 h-5" />
          Print Now
        </button>
      </div>

      {/* Report Content */}
      <div className="max-w-4xl mx-auto border border-gray-300 p-8 shadow-sm print:border-none print:shadow-none print:p-0">
        
        {/* Header */}
        <div className="border-b-2 border-blue-900 pb-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-blue-900 tracking-tight uppercase">
                St. Stephen EMR
              </h1>
              <p className="text-gray-600 mt-1">Laboratory Services Department</p>
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-semibold text-gray-800">Laboratory Report</h2>
              <p className="text-gray-500 mt-1 font-mono text-sm">Acc. No: {labTest.accessionNumber || 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* Patient & Test Details */}
        <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="font-bold text-gray-800 uppercase tracking-wider text-xs mb-3 border-b pb-2">Patient Details</h3>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-gray-500">Name:</div>
              <div className="col-span-2 font-semibold">{labTest.patientName}</div>
              
              <div className="text-gray-500">Age/Gender:</div>
              <div className="col-span-2">{labTest.patientAge} yrs / {labTest.patientGender}</div>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="font-bold text-gray-800 uppercase tracking-wider text-xs mb-3 border-b pb-2">Test Details</h3>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-gray-500">Test Ordered:</div>
              <div className="col-span-2 font-semibold">
                {labTest.testName} 
                {labTest.testCode && <span className="text-xs text-gray-500 ml-1 font-mono">({labTest.testCode})</span>}
              </div>
              
              <div className="text-gray-500">Ordered By:</div>
              <div className="col-span-2">Dr. {labTest.orderedByName}</div>
              
              <div className="text-gray-500">Collection Date:</div>
              <div className="col-span-2">{labTest.collectedAt ? new Date(labTest.collectedAt).toLocaleDateString() : 'N/A'}</div>
              
              <div className="text-gray-500">Report Date:</div>
              <div className="col-span-2">{new Date().toLocaleDateString()}</div>
            </div>
          </div>
        </div>

        {/* Abnormal Flag Warning */}
        {isAbnormal && (
          <div className="mb-6 bg-red-50 border border-red-200 p-3 rounded flex items-center gap-3 text-red-800 text-sm">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span className="font-semibold">Notice:</span> One or more results fall outside the expected reference ranges.
          </div>
        )}

        {/* Results Table */}
        <div className="mb-8">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 text-gray-700 uppercase tracking-wider text-xs">
                <th className="py-3 px-4 border-y border-gray-300 w-2/5">Test Parameter</th>
                <th className="py-3 px-4 border-y border-gray-300 w-1/5 text-center">Result</th>
                <th className="py-3 px-4 border-y border-gray-300 w-1/5 text-center">Unit</th>
                <th className="py-3 px-4 border-y border-gray-300 w-1/5 text-right">Reference Range</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {labTest.results?.map((item, index) => {
                const isItemAbnormal = labTest.abnormalFlags?.some(f => f.parameter === item.parameter);
                
                return (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900">{item.parameter}</div>
                      {item.loincCode && (
                        <div className="text-xs text-gray-500 font-mono mt-0.5">LOINC: {item.loincCode}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`font-semibold ${isItemAbnormal ? 'text-red-600 bg-red-50 px-2 py-1 rounded' : 'text-gray-800'}`}>
                        {item.value || '-'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center text-gray-600">{item.unit || '-'}</td>
                    <td className="py-3 px-4 text-right text-gray-600 text-xs">{item.referenceRange || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Clinical Notes / Interpretation */}
        {labTest.resultNotes && (
          <div className="mb-8">
            <h3 className="font-bold text-gray-800 uppercase tracking-wider text-xs mb-2">Clinical Notes & Interpretation</h3>
            <div className="bg-gray-50 border border-gray-200 p-4 rounded text-sm text-gray-700">
              {labTest.resultNotes}
            </div>
          </div>
        )}

        {/* Signatures */}
        <div className="mt-16 pt-8 border-t border-gray-300 grid grid-cols-2 gap-8 text-sm">
          <div>
            <p className="text-gray-500 mb-6">Tested By (Scientist)</p>
            <div className="border-b border-gray-400 w-3/4 mb-2"></div>
            <p className="font-semibold text-gray-800">Laboratory Department</p>
          </div>
          <div className="text-right">
            <p className="text-gray-500 mb-6 flex flex-col items-end">
              <span>Reviewed & Approved By</span>
              {labTest.reviewedAt && (
                <span className="text-xs mt-1">Date: {new Date(labTest.reviewedAt).toLocaleString()}</span>
              )}
            </p>
            <div className="border-b border-gray-400 w-3/4 ml-auto mb-2"></div>
            <p className="font-semibold text-gray-800">
              {labTest.reviewedByName ? `Dr. ${labTest.reviewedByName}` : 'Authorized Signatory'}
            </p>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-gray-400 border-t pt-4">
          <p>This report is electronically generated and validated. St. Stephen EMR</p>
          <p className="mt-1 font-mono">Report ID: {labTest.id}</p>
        </div>
      </div>
    </div>
  );
};

export default LabReportPrintPage;
