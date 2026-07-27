import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Activity, Pill, User, Clock, FileText, TestTube, Settings, Wind } from 'lucide-react';
import { Admission } from '../types/inpatient';
import InpatientService from '../services/InpatientService';
import WardRoundModal from '../components/inpatient/WardRoundModal';
import RecordConsumableUsageModal from '../components/pharmacy/RecordConsumableUsageModal';
import DischargeModal from '../components/inpatient/DischargeModal';
import BedTransferModal from '../components/inpatient/BedTransferModal';
import NewLabTestModal from '../components/lab/NewLabTestModal';
import VoidRecordModal from '../components/inpatient/charts/VoidRecordModal';
import { useConfirm } from '../hooks/useConfirm';
import ConfirmDialog from '../components/common/ConfirmDialog';
import InpatientCharts from '../components/inpatient/InpatientCharts';
import OperationNoteTab from '../components/inpatient/OperationNoteTab';
import PartographTab from '../components/inpatient/partograph/PartographTab';
import AdmissionTabSettingsModal from '../components/inpatient/AdmissionTabSettingsModal';
import { getErrorMessage } from '../utils/errorHandler';

const ADMISSION_TYPE_LABELS: Record<string, string> = {
  MEDICAL: 'Medical',
  SURGERY: 'Surgery',
  CHILD_BIRTH: 'Child Birth',
};

const InpatientDetailsPage: React.FC = () => {
  const { admissionId } = useParams<{ admissionId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { confirm, isOpen, options, loading: confirmLoading, handleConfirm, handleCancel } = useConfirm();

  const [admission, setAdmission] = useState<Admission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isWardRoundModalOpen, setIsWardRoundModalOpen] = useState(false);
  const [isOxygenModalOpen, setIsOxygenModalOpen] = useState(false);
  const [isDischargeModalOpen, setIsDischargeModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isLabTestModalOpen, setIsLabTestModalOpen] = useState(false);
  const [voidingWardRoundId, setVoidingWardRoundId] = useState<string | null>(null);
  const [wards, setWards] = useState<any[]>([]);
  const [mainTab, setMainTab] = useState<'overview' | 'operationNote' | 'charts' | 'partograph'>('overview');
  const [chartsInitialTab, setChartsInitialTab] = useState<'vitals' | 'fluids' | 'transfusion' | 'bloodsugar' | 'medication' | undefined>(undefined);
  const [isTabSettingsModalOpen, setIsTabSettingsModalOpen] = useState(false);

  const jumpToMedicationChart = () => {
    setChartsInitialTab('medication');
    setMainTab('charts');
  };

  useEffect(() => {
    if (searchParams.get('tab') === 'partograph') {
      setMainTab('partograph');
    }
  }, [searchParams]);

  const loadAdmission = async () => {
    if (!admissionId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await InpatientService.getAdmissionById(admissionId);
      setAdmission(data);
      
      const wardsData = await InpatientService.getWards();
      setWards(wardsData || []);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to load admission details'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdmission();
  }, [admissionId]);

  // Operation Note shows for Surgery/Child Birth admissions, or when
  // manually overridden (e.g. a Medical admission where surgery turns out
  // to be necessary partway through the stay). Partograph is the same idea,
  // scoped to Child Birth.
  const showOperationNoteTab = !!admission && (
    admission.admissionType === 'SURGERY' ||
    admission.admissionType === 'CHILD_BIRTH' ||
    admission.showOperationNote
  );
  const showPartographTab = !!admission && (
    admission.admissionType === 'CHILD_BIRTH' ||
    admission.showPartograph
  );

  // If the tab currently being viewed becomes hidden (e.g. after a settings
  // change elsewhere), fall back to Overview rather than showing a blank pane.
  useEffect(() => {
    if (mainTab === 'operationNote' && !showOperationNoteTab) setMainTab('overview');
    if (mainTab === 'partograph' && !showPartographTab) setMainTab('overview');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showOperationNoteTab, showPartographTab]);

  const handleDischarge = () => {
    setIsDischargeModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error || !admission) {
    return (
      <div className="bg-red-50 text-red-700 p-6 rounded-lg text-center">
        <p>{error || 'Admission not found'}</p>
        <button onClick={() => navigate('/inpatient')} className="mt-4 text-red-600 underline">
          Return to Inpatients
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          <button onClick={() => navigate('/inpatient')} className="mr-4 text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {admission.patient?.firstName} {admission.patient?.lastName}
            </h1>
            <p className="text-sm text-gray-500 flex items-center mt-1">
              <span className="font-medium mr-2">Bed {admission.bed?.bedNumber}</span> • 
              <span className="mx-2">{admission.bed?.ward?.name}</span> • 
              <span className="ml-2">ID: {admission.patient?.patientId}</span>
            </p>
          </div>
        </div>
        <div className="space-x-3 flex items-center">
          {admission.status === 'ADMITTED' && (
            <>
              <button onClick={() => setIsTabSettingsModalOpen(true)} className="px-4 py-2 border border-gray-300 text-gray-700 bg-white rounded-md hover:bg-gray-50 flex items-center">
                <Settings className="w-4 h-4 mr-2" /> Tab Settings
              </button>
              <button onClick={() => setIsTransferModalOpen(true)} className="px-4 py-2 border border-gray-300 text-gray-700 bg-white rounded-md hover:bg-gray-50 flex items-center">
                Transfer Bed
              </button>
              <button onClick={() => setIsWardRoundModalOpen(true)} className="px-4 py-2 border border-gray-300 text-gray-700 bg-white rounded-md hover:bg-gray-50 flex items-center">
                <Activity className="w-4 h-4 mr-2" /> Record Ward Round
              </button>
              {admission.showOxygen && (
                <button onClick={() => setIsOxygenModalOpen(true)} className="px-4 py-2 border border-sky-300 text-sky-800 bg-sky-50 rounded-md hover:bg-sky-100 flex items-center">
                  <Wind className="w-4 h-4 mr-2" /> Record Oxygen
                </button>
              )}
              <button onClick={() => setIsLabTestModalOpen(true)} className="px-4 py-2 border border-gray-300 text-gray-700 bg-white rounded-md hover:bg-gray-50 flex items-center">
                <TestTube className="w-4 h-4 mr-2" /> Order Lab Test
              </button>
              <button onClick={handleDischarge} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md flex items-center">
                Discharge
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setMainTab('overview')}
            className={`${mainTab === 'overview' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Overview
          </button>
          {showOperationNoteTab && (
            <button
              onClick={() => setMainTab('operationNote')}
              className={`${mainTab === 'operationNote' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Operation Note
            </button>
          )}
          <button
            onClick={() => setMainTab('charts')}
            className={`${mainTab === 'charts' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Clinical Charts
          </button>
          {showPartographTab && (
            <button
              onClick={() => setMainTab('partograph')}
              className={`${mainTab === 'partograph' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Partograph
            </button>
          )}
        </nav>
      </div>

      {mainTab === 'overview' ? (
        <>
        {(() => {
          const ONE_DAY_MS = 24 * 60 * 60 * 1000;
          const now = Date.now();
          const prescriptions = admission.prescriptions || [];
          const started = prescriptions.filter((p: any) =>
            p.status !== 'CANCELLED' && now - new Date(p.createdAt).getTime() < ONE_DAY_MS
          );
          const discontinued = prescriptions.filter((p: any) =>
            p.status === 'CANCELLED' && now - new Date(p.updatedAt).getTime() < ONE_DAY_MS
          );
          if (started.length === 0 && discontinued.length === 0) return null;

          return (
            <div className="mb-6 bg-red-50 border-2 border-red-400 rounded-lg p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-red-800 uppercase tracking-wide flex items-center gap-2">
                    <span className="text-lg">⚠️</span> Medication order changed in the last 24 hours
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-red-900">
                    {started.map((p: any) => (
                      <li key={`started-${p.id}`}>
                        <span className="font-semibold">Started:</span> {p.medicationName} {p.dosage ? `(${p.dosage})` : ''}
                      </li>
                    ))}
                    {discontinued.map((p: any) => (
                      <li key={`stopped-${p.id}`}>
                        <span className="font-semibold">Discontinued:</span> {p.medicationName}
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  onClick={jumpToMedicationChart}
                  className="flex-shrink-0 px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 whitespace-nowrap"
                >
                  View Medication Chart
                </button>
              </div>
            </div>
          );
        })()}
        {((admission.patient?.allergies && admission.patient.allergies.length > 0) ||
          (admission.patient?.chronicConditions && admission.patient.chronicConditions.length > 0)) && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              {admission.patient.allergies?.length > 0 && (
                <div>
                  <span className="text-xs font-semibold text-red-800 uppercase tracking-wide">⚠️ Allergies: </span>
                  <span className="text-sm text-red-900">{admission.patient.allergies.join(', ')}</span>
                </div>
              )}
              {admission.patient.chronicConditions?.length > 0 && (
                <div>
                  <span className="text-xs font-semibold text-red-800 uppercase tracking-wide">Chronic Conditions: </span>
                  <span className="text-sm text-red-900">{admission.patient.chronicConditions.join(', ')}</span>
                </div>
              )}
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <User className="w-5 h-5 mr-2 text-primary-600" /> Admission Info
            </h2>
            <div className="space-y-3 text-sm">
              <p><span className="text-gray-500">Admitted At:</span> {new Date(admission.admissionDate).toLocaleString()}</p>
              <p><span className="text-gray-500">Status:</span> <span className="font-medium text-primary-600">{admission.status}</span></p>
              <p><span className="text-gray-500">Admitted By:</span> {admission.admittedBy?.firstName} {admission.admittedBy?.lastName}</p>
              <div className="pt-3 border-t">
                <p className="text-gray-500 mb-1">Reason for Admission:</p>
                <p className="font-medium text-gray-900">{admission.reason}</p>
              </div>
              <div className="pt-3 border-t">
                <p className="text-gray-500 mb-1">Admission Type:</p>
                <p className="font-medium text-gray-900">{ADMISSION_TYPE_LABELS[admission.admissionType] || admission.admissionType}</p>
                {(admission.showOperationNote || admission.showPartograph) && (
                  <p className="text-xs text-blue-700 mt-1">
                    Also showing: {[admission.showOperationNote && 'Operation Note', admission.showPartograph && 'Partograph'].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
              {admission.isolationRequired && (
                <div className="pt-3 border-t">
                  <p className="text-orange-600 font-medium mb-1">⚠️ Isolation Required</p>
                  <p className="text-sm text-gray-700">{admission.infectionRisk}</p>
                </div>
              )}
              {admission.diagnoses && admission.diagnoses.length > 0 && (
                <div className="pt-3 border-t">
                  <p className="text-gray-500 mb-1">Admission Diagnosis:</p>
                  {admission.diagnoses.filter(d => d.isAdmission).map(d => (
                    <p key={d.id} className="text-sm font-medium">{d.diagnosis?.code} - {d.diagnosis?.name}</p>
                  ))}
                </div>
              )}
              {admission.notes && (
                <div className="pt-3 border-t">
                  <p className="text-gray-500 mb-1">Notes:</p>
                  <p className="text-gray-700">{admission.notes}</p>
                </div>
              )}
              {admission.dischargeSummary && (
                <div className="pt-3 border-t bg-blue-50 p-3 rounded-md mt-3">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-semibold text-blue-900">Discharge Summary</p>
                    <a
                      href={`/inpatient/admissions/${admission.id}/discharge-summary`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-1"
                    >
                      <FileText className="w-3.5 h-3.5" /> Print
                    </a>
                  </div>
                  <p className="text-sm text-gray-700 mb-1"><span className="font-medium">Final Notes:</span> {admission.dischargeSummary.finalNotes}</p>
                  {admission.dischargeSummary.followUpPlan && (
                    <p className="text-sm text-gray-700"><span className="font-medium">Follow-up:</span> {admission.dischargeSummary.followUpPlan}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {/* Ward Rounds */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <Activity className="w-5 h-5 mr-2 text-primary-600" /> Ward Rounds
            </h2>
            {admission.wardRounds?.length === 0 ? (
              <p className="text-gray-500 italic text-sm">No ward rounds recorded yet.</p>
            ) : (
              <div className="space-y-4">
                {admission.wardRounds?.map(round => (
                  <div key={round.id} className="border border-gray-100 bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-800">
                        {round.conductedBy?.firstName} {round.conductedBy?.lastName}
                      </span>
                      <span className="text-xs text-gray-500 flex items-center">
                        <Clock className="w-3 h-3 mr-1" /> {new Date(round.roundDate).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{round.notes}</p>
                    {round.plan && (
                      <div className="mt-2 text-sm">
                        <span className="font-medium text-gray-600">Plan:</span> {round.plan}
                      </div>
                    )}
                    {admission.status === 'ADMITTED' && (
                      <div className="mt-2 text-right">
                        <button onClick={() => setVoidingWardRoundId(round.id)} className="inline-flex items-center px-2.5 py-1 border border-red-300 rounded text-xs font-medium text-red-700 bg-white hover:bg-red-50">
                          Void
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Medication Administrations */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <Pill className="w-5 h-5 mr-2 text-primary-600" /> Medication Administrations
            </h2>
            {admission.medicationAdministrations?.length === 0 ? (
              <p className="text-gray-500 italic text-sm">No medications administered yet.</p>
            ) : (
              <div className="space-y-4">
                {admission.medicationAdministrations?.map(med => (
                  <div key={med.id} className="border border-gray-100 p-4 rounded-lg flex justify-between items-center">
                    <div>
                      <p className="font-medium text-gray-900">{med.medicationName} <span className="text-gray-500 text-sm font-normal">({med.dosage})</span></p>
                      <p className="text-xs text-gray-500 mt-1">Administered by: {med.administeredBy?.firstName} {med.administeredBy?.lastName}</p>
                      {med.notes && <p className="text-sm text-gray-600 mt-1">Note: {med.notes}</p>}
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded-full">
                        {med.status}
                      </span>
                      <p className="text-xs text-gray-400 mt-2">{new Date(med.administeredAt).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
        </>
      ) : mainTab === 'operationNote' ? (
        <OperationNoteTab
          admissionId={admission.id}
          patient={{
            id: admission.patientId,
            firstName: admission.patient?.firstName,
            lastName: admission.patient?.lastName,
            fullName: `${admission.patient?.firstName} ${admission.patient?.lastName}`,
            allergies: admission.patient?.allergies || [],
          }}
          isReadonly={admission.status !== 'ADMITTED'}
        />
      ) : mainTab === 'charts' ? (
        <InpatientCharts admissionId={admission.id} isReadonly={admission.status !== 'ADMITTED'} initialTab={chartsInitialTab} />
      ) : (
        <PartographTab admissionId={admission.id} isReadonly={admission.status !== 'ADMITTED'} />
      )}

      {isWardRoundModalOpen && (
        <WardRoundModal
          admissionId={admissionId!}
          onClose={() => setIsWardRoundModalOpen(false)}
          onSuccess={() => {
            setIsWardRoundModalOpen(false);
            loadAdmission();
          }}
        />
      )}

      <RecordConsumableUsageModal
        isOpen={isOxygenModalOpen}
        onClose={() => setIsOxygenModalOpen(false)}
        onSuccess={() => {
          setIsOxygenModalOpen(false);
          loadAdmission();
        }}
        patientId={admission.patientId}
        patientLabel={`${admission.patient?.firstName} ${admission.patient?.lastName}`}
        admissionId={admission.id}
        lockToCategory="Oxygen"
      />

      {isDischargeModalOpen && (
        <DischargeModal
          admissionId={admission.id}
          patientName={`${admission.patient.firstName} ${admission.patient.lastName}`}
          admission={admission}
          onClose={() => setIsDischargeModalOpen(false)}
          onSuccess={() => {
            setIsDischargeModalOpen(false);
            navigate('/inpatient');
          }}
        />
      )}

      {voidingWardRoundId && (
        <VoidRecordModal
          title="Void Ward Round"
          onClose={() => setVoidingWardRoundId(null)}
          onConfirm={async (reason) => {
            await InpatientService.voidWardRound(admission.id, voidingWardRoundId, reason);
            setVoidingWardRoundId(null);
            loadAdmission();
          }}
        />
      )}

      {isLabTestModalOpen && (
        <NewLabTestModal
          admissionId={admission.id}
          initialPatient={{
            id: admission.patientId,
            patientId: admission.patient?.patientId,
            firstName: admission.patient?.firstName,
            lastName: admission.patient?.lastName,
            fullName: `${admission.patient?.firstName} ${admission.patient?.lastName}`,
            age: admission.patient?.age,
            gender: admission.patient?.gender,
          }}
          onClose={() => setIsLabTestModalOpen(false)}
          onSuccess={() => {
            setIsLabTestModalOpen(false);
            loadAdmission();
          }}
        />
      )}

      <ConfirmDialog
        isOpen={isOpen}
        onClose={handleCancel}
        onConfirm={handleConfirm}
        title={options.title}
        message={options.message}
        confirmText={options.confirmText}
        cancelText={options.cancelText}
        type={options.type}
        loading={confirmLoading}
      />
      {isTransferModalOpen && (
        <BedTransferModal
          admission={admission}
          wards={wards}
          onClose={() => setIsTransferModalOpen(false)}
          onSuccess={() => {
            setIsTransferModalOpen(false);
            loadAdmission();
          }}
        />
      )}
      {isTabSettingsModalOpen && (
        <AdmissionTabSettingsModal
          admission={admission}
          onClose={() => setIsTabSettingsModalOpen(false)}
          onSuccess={() => {
            setIsTabSettingsModalOpen(false);
            loadAdmission();
          }}
        />
      )}
    </div>
  );
};

export default InpatientDetailsPage;
