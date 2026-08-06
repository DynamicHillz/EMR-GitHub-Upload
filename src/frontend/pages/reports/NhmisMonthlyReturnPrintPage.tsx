import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import ErrorAlert from '../../components/common/ErrorAlert';
import reportsService from '../../services/reports.service';
import { NhmisMonthlyReturnReport } from '../../types/reports.types';
import { getErrorMessage } from '../../utils/errorHandler';

const MONTH_NAMES = Array.from({ length: 12 }, (_, i) => new Date(0, i).toLocaleString('default', { month: 'long' }));

const NhmisMonthlyReturnPrintPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1), 10);
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10);

  const [report, setReport] = useState<NhmisMonthlyReturnReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [branding, setBranding] = useState<any>(null);
  const [brandingLoaded, setBrandingLoaded] = useState(false);

  useEffect(() => {
    fetchReport();
    fetchBranding();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const data = await reportsService.getNhmisMonthlyReturn({ month, year });
      setReport(data);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load NHMIS monthly return'));
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
    if (report && !loading && brandingLoaded) {
      setTimeout(() => window.print(), 500);
    }
  }, [report, loading, brandingLoaded]);

  const clinicName = branding?.clinicName || 'St. Stephen Medical Centre';

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-xl text-gray-500 font-semibold animate-pulse">Loading NHMIS monthly return...</div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="p-8">
        <ErrorAlert message={error || 'Report not found'} />
      </div>
    );
  }

  const { attendance, topConditions, summary } = report;

  return (
    <div className="bg-white min-h-screen text-black p-8 font-sans print:p-0 print:m-0">
      <style>
        {`
          @media print {
            @page { margin: 1.5cm; size: A4; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: white !important; }
            .no-print { display: none !important; }
          }
          .nhmis-grid, .nhmis-grid th, .nhmis-grid td {
            border: 1px solid #333;
            border-collapse: collapse;
          }
        `}
      </style>

      <div className="no-print mb-8 pb-4 border-b border-gray-200 flex justify-between items-center">
        <div>
          <Link to="/reports" className="text-sm text-blue-600 hover:text-blue-800 font-medium mb-1 inline-block">
            ← Back to Reports
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">Print Preview</h1>
          <p className="text-gray-500">
            Built from the standard NHMIS Facility Monthly Summary structure — compare against St. Stephen's actual
            paper form and adjust row/column labels if they differ.
          </p>
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
        {/* Clinic Header */}
        <div className="border-b-2 border-blue-900 pb-6 mb-6 flex justify-between items-start">
          <div className="flex items-center gap-4">
            {branding?.logoUrl && <img src={branding.logoUrl} alt={clinicName} className="h-14 w-auto object-contain" />}
            <div>
              <h1 className="text-2xl font-bold text-blue-900 tracking-tight uppercase">{clinicName}</h1>
              {branding?.address && <p className="text-xs text-gray-500 mt-1">{branding.address}</p>}
              {branding?.phone && <p className="text-xs text-gray-500">Tel: {branding.phone}</p>}
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-semibold text-gray-800">NHMIS Facility Monthly Summary</h2>
            <p className="text-gray-500 mt-1">General OPD Return</p>
            <p className="text-gray-700 font-semibold mt-1">{MONTH_NAMES[report.period.month - 1]} {report.period.year}</p>
          </div>
        </div>

        {/* Attendance Matrix */}
        <div className="mb-8">
          <h3 className="font-bold text-gray-800 uppercase tracking-wider text-xs mb-2">1. OPD Attendance by Age Group and Sex</h3>
          <table className="nhmis-grid w-full text-sm text-center">
            <thead>
              <tr className="bg-gray-100">
                <th rowSpan={2} className="p-2 text-left">Age Group</th>
                <th colSpan={2} className="p-2">New Attendance</th>
                <th colSpan={2} className="p-2">Repeat Attendance</th>
                <th rowSpan={2} className="p-2">Row Total</th>
              </tr>
              <tr className="bg-gray-50 text-xs uppercase text-gray-600">
                <th className="p-2">Male</th>
                <th className="p-2">Female</th>
                <th className="p-2">Male</th>
                <th className="p-2">Female</th>
              </tr>
            </thead>
            <tbody>
              {attendance.byAgeGroupAndSex.map((row) => (
                <tr key={row.ageGroup}>
                  <td className="p-2 text-left font-medium">{row.ageGroup}</td>
                  <td className="p-2">{row.newMale}</td>
                  <td className="p-2">{row.newFemale}</td>
                  <td className="p-2">{row.repeatMale}</td>
                  <td className="p-2">{row.repeatFemale}</td>
                  <td className="p-2 font-semibold">{row.newMale + row.newFemale + row.repeatMale + row.repeatFemale}</td>
                </tr>
              ))}
              <tr className="bg-gray-100 font-bold">
                <td className="p-2 text-left">Total</td>
                <td colSpan={2} className="p-2">{attendance.totalNew}</td>
                <td colSpan={2} className="p-2">{attendance.totalRepeat}</td>
                <td className="p-2">{attendance.grandTotal}</td>
              </tr>
            </tbody>
          </table>
          {attendance.otherGenderCount > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              {attendance.otherGenderCount} patient(s) recorded with a gender outside Male/Female are included in the
              totals above but not broken out by sex in this grid.
            </p>
          )}
        </div>

        {/* Top Conditions */}
        <div className="mb-8">
          <h3 className="font-bold text-gray-800 uppercase tracking-wider text-xs mb-2">2. Top Conditions Seen (OPD)</h3>
          {topConditions.length === 0 ? (
            <p className="text-sm text-gray-500 italic">No diagnoses recorded for this period.</p>
          ) : (
            <table className="nhmis-grid w-full text-sm">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="p-2 w-16">#</th>
                  <th className="p-2 w-24">Code</th>
                  <th className="p-2">Condition</th>
                  <th className="p-2 w-24 text-right">Cases</th>
                </tr>
              </thead>
              <tbody>
                {topConditions.map((c, i) => (
                  <tr key={c.diagnosisId}>
                    <td className="p-2">{i + 1}</td>
                    <td className="p-2 font-mono">{c.code}</td>
                    <td className="p-2">{c.name}</td>
                    <td className="p-2 text-right font-semibold">{c.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Total OPD consultations this period: {summary.totalConsultations} · Total diagnoses recorded: {summary.totalDiagnosesRecorded}
          </p>
        </div>

        {/* Referrals — intentionally not computed, no data source exists yet */}
        <div className="mb-8">
          <h3 className="font-bold text-gray-800 uppercase tracking-wider text-xs mb-2">3. Referrals</h3>
          <table className="nhmis-grid w-full text-sm">
            <tbody>
              <tr>
                <td className="p-2 text-left w-1/2">Referred In</td>
                <td className="p-2 h-10"></td>
              </tr>
              <tr>
                <td className="p-2 text-left">Referred Out</td>
                <td className="p-2 h-10"></td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-gray-500 mt-1 italic">
            Not yet tracked in the EMR — to be completed manually until referral capture is added.
          </p>
        </div>

        {/* Sign-off */}
        <div className="mt-16 pt-8 border-t border-gray-300 grid grid-cols-2 gap-8 text-sm">
          <div>
            <p className="text-gray-500 mb-6">Compiled By</p>
            <div className="border-b border-gray-400 w-3/4 mb-2"></div>
            <p className="font-semibold text-gray-800">Records Officer</p>
          </div>
          <div className="text-right">
            <p className="text-gray-500 mb-6">Date</p>
            <div className="border-b border-gray-400 w-3/4 ml-auto mb-2"></div>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-gray-400 border-t pt-4">
          <p>This return is electronically generated from live clinic records. {clinicName}</p>
        </div>
      </div>
    </div>
  );
};

export default NhmisMonthlyReturnPrintPage;
