import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Bed as BedIcon, Activity, Edit, AlertTriangle, Search, Clock, CheckCircle } from 'lucide-react';
import { Ward, Admission, OverstayStatus } from '../types/inpatient';
import InpatientService from '../services/InpatientService';
import AdmissionModal from '../components/inpatient/AdmissionModal';
import EditBedModal from '../components/inpatient/EditBedModal';
import { useAuth } from '../contexts/AuthContext';
import { formatDate, formatCurrency } from '../utils/formatters';
import Dropdown from '../components/common/Dropdown';

const InpatientPage: React.FC = () => {
  const [wards, setWards] = useState<Ward[]>([]);
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [allAdmissions, setAllAdmissions] = useState<Admission[]>([]);
  const [overstayStatus, setOverstayStatus] = useState<OverstayStatus[]>([]);
  const [confirmingBedVacatedId, setConfirmingBedVacatedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [loading, setLoading] = useState(true);
  const [isAdmitting, setIsAdmitting] = useState(false);
  const [editingBed, setEditingBed] = useState<any>(null);
  const [onlyNotRoundedToday, setOnlyNotRoundedToday] = useState(false);
  const [activeSearch, setActiveSearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [historySort, setHistorySort] = useState<'newest' | 'oldest' | 'patient'>('newest');
  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_PAGE_SIZE = 15;
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightedWardId = searchParams.get('ward');

  const isRoundedToday = (adm: Admission) => {
    const lastRound = adm.wardRounds?.[0]?.roundDate;
    if (!lastRound) return false;
    const today = new Date();
    const roundDate = new Date(lastRound);
    return (
      roundDate.getFullYear() === today.getFullYear() &&
      roundDate.getMonth() === today.getMonth() &&
      roundDate.getDate() === today.getDate()
    );
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [wardsData, admissionsData, allAdmissionsData, overstayData] = await Promise.all([
        InpatientService.getWards(),
        InpatientService.getAdmissions('ADMITTED'),
        InpatientService.getAdmissions(),
        InpatientService.getOverstayStatus()
      ]);
      setWards(wardsData);
      setAdmissions(admissionsData);
      setAllAdmissions(allAdmissionsData);
      setOverstayStatus(overstayData);
    } catch (error) {
      console.error('Failed to load inpatient data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmBedVacated = async (admissionId: string) => {
    try {
      setConfirmingBedVacatedId(admissionId);
      await InpatientService.confirmBedVacated(admissionId);
      await loadData();
    } catch (error) {
      console.error('Failed to confirm bed vacated:', error);
      alert('Failed to confirm bed vacated. Please try again.');
    } finally {
      setConfirmingBedVacatedId(null);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredWards = useMemo(() => {
    const q = activeSearch.trim().toLowerCase();
    if (!q) return wards;
    return wards
      .map((ward) => ({
        ...ward,
        beds: ward.beds?.filter((bed) => {
          const admission = bed.admissions?.[0];
          const patientMatch = admission && (
            `${admission.patient?.firstName} ${admission.patient?.lastName}`.toLowerCase().includes(q) ||
            admission.patient?.patientId?.toLowerCase().includes(q)
          );
          return bed.bedNumber?.toLowerCase().includes(q) || patientMatch;
        }),
      }))
      .filter((ward) => ward.name.toLowerCase().includes(q) || (ward.beds && ward.beds.length > 0));
  }, [wards, activeSearch]);

  const filteredSortedAdmissions = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    let list = allAdmissions.filter((adm) => !onlyNotRoundedToday || (adm.status === 'ADMITTED' && !isRoundedToday(adm)));
    if (q) {
      list = list.filter((adm) =>
        `${adm.patient?.firstName} ${adm.patient?.lastName}`.toLowerCase().includes(q) ||
        adm.patient?.patientId?.toLowerCase().includes(q) ||
        adm.reason?.toLowerCase().includes(q)
      );
    }
    list = [...list].sort((a, b) => {
      if (historySort === 'patient') {
        return `${a.patient?.firstName} ${a.patient?.lastName}`.localeCompare(`${b.patient?.firstName} ${b.patient?.lastName}`);
      }
      const diff = new Date(a.admissionDate).getTime() - new Date(b.admissionDate).getTime();
      return historySort === 'oldest' ? diff : -diff;
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allAdmissions, historySearch, historySort, onlyNotRoundedToday]);

  useEffect(() => {
    setHistoryPage(1);
  }, [historySearch, historySort, onlyNotRoundedToday]);

  const historyTotalPages = Math.max(1, Math.ceil(filteredSortedAdmissions.length / HISTORY_PAGE_SIZE));
  const paginatedAdmissions = filteredSortedAdmissions.slice(
    (historyPage - 1) * HISTORY_PAGE_SIZE,
    historyPage * HISTORY_PAGE_SIZE
  );

  useEffect(() => {
    if (highlightedWardId && !loading) {
      setActiveTab('active');
      setTimeout(() => {
        document.getElementById(`ward-${highlightedWardId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedWardId, loading]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inpatients & Wards</h1>
          <p className="text-sm text-gray-500">Manage hospital wards, beds, and admitted patients</p>
        </div>
        <button
          onClick={() => setIsAdmitting(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Admit Patient
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <>
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('active')}
                className={`${
                  activeTab === 'active'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Active Wards & Beds
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`${
                  activeTab === 'history'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Admission History
              </button>
            </nav>
          </div>

          {activeTab === 'active' ? (
            <div className="space-y-8">
          {overstayStatus.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-amber-200 overflow-hidden">
              <div className="px-6 py-4 border-b bg-amber-50 flex items-center">
                <Clock className="w-5 h-5 text-amber-600 mr-2" />
                <h2 className="text-lg font-semibold text-gray-800">Awaiting Bed Clearance</h2>
                <span className="ml-3 px-2 py-1 text-xs font-medium bg-amber-200 text-amber-900 rounded-full">
                  {overstayStatus.length}
                </span>
              </div>
              <div className="divide-y divide-gray-100">
                {overstayStatus.map((item) => (
                  <div
                    key={item.admissionId}
                    className="px-6 py-4 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div
                      className="min-w-0 flex-1 cursor-pointer"
                      onClick={() => navigate(`/inpatient/${item.admissionId}`)}
                    >
                      <p className="font-medium text-gray-900 truncate">
                        {item.patient?.firstName} {item.patient?.lastName}
                        <span className="ml-2 text-xs text-gray-500 font-normal">
                          {item.bed?.ward?.name} (Bed: {item.bed?.bedNumber})
                        </span>
                      </p>
                      <p className="text-xs text-gray-500">
                        Discharged {formatDate(item.dischargeDate)} — bill {item.billingStatus === 'BILLED' ? 'outstanding' : 'not yet generated'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {item.isOverstay ? (
                        <span className="px-3 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                          Overstay: Day {item.overstayDays} — est. +{formatCurrency(item.estimatedExtraCharge)}
                        </span>
                      ) : (
                        <span className="px-3 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">
                          Grace period: {item.graceDaysRemaining} day(s) left
                        </span>
                      )}
                      {hasRole(['DOCTOR', 'NURSE']) && (
                        <button
                          onClick={() => handleConfirmBedVacated(item.admissionId)}
                          disabled={confirmingBedVacatedId === item.admissionId}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          {confirmingBedVacatedId === item.admissionId ? 'Confirming...' : 'Confirm Bed Vacated'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={activeSearch}
              onChange={(e) => setActiveSearch(e.target.value)}
              placeholder="Search ward, bed, or patient..."
              className="input pl-9 w-full"
            />
          </div>
          {filteredWards.map((ward) => (
            <div
              key={ward.id}
              id={`ward-${ward.id}`}
              className={`bg-white rounded-xl shadow-sm border overflow-hidden ${
                highlightedWardId === ward.id ? 'ring-2 ring-primary-500' : ''
              }`}
            >
              <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
                <div className="flex items-center">
                  <BedIcon className="w-5 h-5 text-gray-500 mr-2" />
                  <h2 className="text-lg font-semibold text-gray-800">{ward.name}</h2>
                  <span className="ml-3 px-2 py-1 text-xs font-medium bg-primary-100 text-primary-800 rounded-full">
                    {ward.type}
                  </span>
                </div>
                <div className="text-sm text-gray-500">
                  Capacity: {ward.beds?.length || 0} Beds
                </div>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {ward.beds?.map((bed) => {
                  const admission = bed.admissions?.[0];
                  const isOccupied = bed.status === 'OCCUPIED' && admission;

                  return (
                    <div 
                      key={bed.id}
                      className={`border rounded-lg p-4 cursor-pointer transition-all ${
                        isOccupied 
                          ? 'border-primary-200 bg-primary-50 hover:bg-primary-100' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => {
                        if (isOccupied) {
                          navigate(`/inpatient/${admission.id}`);
                        }
                      }}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center">
                          <span className="font-semibold text-gray-700">{bed.bedNumber}</span>
                          {!isOccupied && hasRole(['SUPER_ADMIN', 'ADMIN']) && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); setEditingBed(bed); }}
                              className="ml-2 text-gray-400 hover:text-primary-600 p-1"
                              title="Edit Bed Label"
                            >
                              <Edit className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          isOccupied ? 'bg-primary-200 text-primary-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {isOccupied ? 'Occupied' : 'Available'}
                        </span>
                      </div>

                      {isOccupied ? (
                        <div>
                          <p className="font-medium text-gray-900 truncate">
                            {admission.patient?.firstName} {admission.patient?.lastName}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            ID: {admission.patient?.patientId}
                          </p>
                          <div className="mt-3 flex items-center text-xs text-primary-600">
                            <Activity className="w-3 h-3 mr-1" />
                            <span>Admitted: {formatDate(admission.admissionDate)}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-20 text-gray-400">
                          <BedIcon className="w-8 h-8 mb-1 opacity-50" />
                          <span className="text-xs">Empty Bed</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={onlyNotRoundedToday}
                    onChange={(e) => setOnlyNotRoundedToday(e.target.checked)}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  Show only admitted patients not yet rounded on today
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      placeholder="Search patient or reason..."
                      className="input pl-9 w-64"
                    />
                  </div>
                  <Dropdown
                    value={historySort}
                    onChange={(e) => setHistorySort(e.target.value as typeof historySort)}
                    className="input"
                  >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="patient">Patient name</option>
                  </Dropdown>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Admission Date</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discharge Date</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Round</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedAdmissions.map((adm) => (
                    <tr
                      key={adm.id}
                      onClick={() => navigate(`/inpatient/${adm.id}`)}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{adm.patient?.firstName} {adm.patient?.lastName}</div>
                        <div className="text-sm text-gray-500">{adm.patient?.patientId}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(adm.admissionDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {adm.dischargeDate ? formatDate(adm.dischargeDate) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          adm.status === 'ADMITTED' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {adm.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                        {adm.reason}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {adm.status !== 'ADMITTED' ? (
                          <span className="text-gray-400">-</span>
                        ) : isRoundedToday(adm) ? (
                          <span className="text-green-700">{formatDate(adm.wardRounds![0].roundDate)}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-700 font-medium">
                            <AlertTriangle className="w-3.5 h-3.5" /> Not rounded today
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              {filteredSortedAdmissions.length > 0 && (
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>
                    Showing {(historyPage - 1) * HISTORY_PAGE_SIZE + 1}–{Math.min(historyPage * HISTORY_PAGE_SIZE, filteredSortedAdmissions.length)} of {filteredSortedAdmissions.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                      disabled={historyPage === 1}
                      className="px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span>Page {historyPage} of {historyTotalPages}</span>
                    <button
                      onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
                      disabled={historyPage === historyTotalPages}
                      className="px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {isAdmitting && (
        <AdmissionModal
          onClose={() => setIsAdmitting(false)}
          onSuccess={() => {
            setIsAdmitting(false);
            loadData();
          }}
          wards={wards}
        />
      )}

      {editingBed && (
        <EditBedModal
          bed={editingBed}
          onClose={() => setEditingBed(null)}
          onSuccess={() => {
            setEditingBed(null);
            loadData();
          }}
        />
      )}
    </div>
  );
};

export default InpatientPage;
