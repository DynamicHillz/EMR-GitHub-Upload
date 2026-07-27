import React, { useEffect, useState } from 'react';
import { ancService } from '../services/anc.service';
import { Baby, Search, User, Activity, AlertTriangle, ShieldCheck } from 'lucide-react';
import PatientDetailView from '../components/PatientDetailView';

const MchDashboardPage: React.FC = () => {
  const [pregnancies, setPregnancies] = useState<any[]>([]);
  const [loadingKPIs, setLoadingKPIs] = useState(true);
  
  // Patient Search State
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [patients, setPatients] = useState<any[]>([]);
  const [searchingPatients, setSearchingPatients] = useState(false);
  
  // Selected Patient State
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  // Fetch KPIs
  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await ancService.getActivePregnancies();
        setPregnancies(data);
      } catch (error) {
        console.error('Failed to load active pregnancies', error);
      } finally {
        setLoadingKPIs(false);
      }
    };
    fetchData();
  }, []);

  const searchPatients = async (query: string = '') => {
    setSearchingPatients(true);
    try {
      if (!query.trim()) {
        setPatients(pregnancies.map(p => p.patient));
        return;
      }

      const token = localStorage.getItem('token');
      const API_URL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : `${window.location.protocol}//${window.location.hostname}:3000/api`;
      
      const searchParams = new URLSearchParams({ limit: '50' });
      searchParams.append('query', query);
      searchParams.append('gender', 'FEMALE');
      
      const res = await fetch(`${API_URL}/patients/search?${searchParams.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        const data = json.data || [];
        setPatients(data.filter((p: any) => p.gender === 'FEMALE'));
      }
    } catch (error) {
      console.error('Error fetching patients:', error);
    } finally {
      setSearchingPatients(false);
    }
  };

  // Debounce search when typing
  useEffect(() => {
    if (selectedPatientId) return; // Don't search if we're viewing a patient
    
    const timer = setTimeout(() => {
      searchPatients(patientSearchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [patientSearchTerm, selectedPatientId, pregnancies]);

  const highRiskCount = pregnancies.filter(p => 
    p.preExistingDiabetes || 
    p.preExistingHypertension || 
    p.cardiacDisease || 
    p.multipleGestation || 
    p.historyOfCSection || 
    p.historyOfPPH || 
    p.historyOfPreEclampsia || 
    p.historyOfStillbirth
  ).length;

  if (selectedPatientId) {
    return (
      <PatientDetailView 
        patientId={selectedPatientId} 
        onBack={() => {
          setSelectedPatientId(null);
          searchPatients(patientSearchTerm); // Refresh list on back
        }} 
        initialTab="anc" 
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Maternal Care Dashboard</h1>
          <p className="text-gray-500 mt-1">Search for a female patient to manage their Antenatal Care (ANC) or record a new pregnancy.</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border p-6 flex items-center">
          <div className="p-3 rounded-full bg-blue-100 text-blue-600 mr-4">
            <Baby className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Active Pregnancies</p>
            <p className="text-2xl font-bold text-gray-900">{loadingKPIs ? '...' : pregnancies.length}</p>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border p-6 flex items-center">
          <div className="p-3 rounded-full bg-red-100 text-red-600 mr-4">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">High-Risk Patients</p>
            <p className="text-2xl font-bold text-gray-900">{loadingKPIs ? '...' : highRiskCount}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6 flex items-center">
          <div className="p-3 rounded-full bg-green-100 text-green-600 mr-4">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">WHO Contacts Target</p>
            <p className="text-2xl font-bold text-gray-900">8 minimum</p>
          </div>
        </div>
      </div>

      {/* Patient Search Section */}
      <div className="bg-white shadow rounded-lg p-6 min-h-[500px]">
        <h2 className="text-lg font-semibold mb-6 flex items-center">
          <Search className="w-5 h-5 mr-2 text-primary-600" /> 
          Find Patient for Maternal Care
        </h2>
        
        <div className="relative mb-8 max-w-2xl">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search by patient name or ID..."
            className="input pl-10 w-full text-lg py-3"
            value={patientSearchTerm}
            onChange={(e) => setPatientSearchTerm(e.target.value)}
          />
        </div>

        <div>
          {searchingPatients ? (
            <div className="text-center py-12 text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
              Searching patients...
            </div>
          ) : patients.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
              <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900">No patients found</h3>
              <p className="text-gray-500">Try adjusting your search term. Only female patients are shown.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {patients.map(patient => (
                <div 
                  key={patient.id} 
                  className="flex flex-col p-5 border rounded-lg hover:shadow-md cursor-pointer transition-all bg-white hover:border-primary-300 group"
                  onClick={() => setSelectedPatientId(patient.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-primary-50 rounded-full flex items-center justify-center group-hover:bg-primary-100 transition-colors">
                        <User className="h-5 w-5 text-primary-600" />
                      </div>
                      <div className="ml-3">
                        <div className="font-semibold text-gray-900 truncate">{patient.firstName} {patient.lastName}</div>
                        <div className="text-xs text-gray-500 font-mono">{patient.patientId}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center mt-auto pt-4 border-t border-gray-100">
                    <div className="text-sm text-gray-600">
                      {new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()} yrs old
                    </div>
                    <button className="text-primary-600 text-sm font-medium flex items-center group-hover:text-primary-800">
                      Manage ANC <Activity className="w-4 h-4 ml-1" />
                    </button>
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

export default MchDashboardPage;
