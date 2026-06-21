import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import InvoiceForm from '../../components/billing/InvoiceForm';
import billingService from '../../services/billing.service';
import { Search } from 'lucide-react';

interface Patient {
  id: string;
  patientId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  age: number;
  gender: string;
  phone: string;
}

const CreateInvoicePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [patientInfo, setPatientInfo] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const patientId = searchParams.get('patientId');

  useEffect(() => {
    if (patientId) {
      // In a real app, you would fetch patient details
      // For now, we'll use a placeholder
      setPatientInfo({
        id: patientId,
        name: 'Loading...',
      });
    }
  }, [patientId]);

  // Patient search functionality
  const searchPatients = useCallback(async (query: string) => {
    if (query.length < 2 && query.length > 0) {
      return;
    }

    if (query.length === 0) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No token found');
        return;
      }

      const response = await fetch(
        `http://localhost:3000/api/patients/search?query=${encodeURIComponent(query)}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      setSearchResults(data.data || []);
      setShowResults(true);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchPatients(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, searchPatients]);

  const handleSelectPatient = (patient: Patient) => {
    setPatientInfo({
      id: patient.id,
      name: `${patient.firstName} ${patient.lastName}`,
    });
    setSearchQuery('');
    setShowResults(false);
  };

  const handleSuccess = (invoice: any) => {
    navigate(`/billing/invoices/${invoice.id}`);
  };

  const handleCancel = () => {
    navigate('/billing/invoices');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">Create Invoice</h2>
          <p className="text-gray-600 mt-1">
            Generate a new invoice for patient services
          </p>
        </div>
      </div>

      {/* Patient Selection Section */}
      {!patientInfo && (
        <div className="card mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Patient</h3>

          {/* Patient Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, patient ID, or phone number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
              onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
            />
            {isSearching && (
              <div className="absolute right-3 top-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
              </div>
            )}

            {/* Search Results Dropdown */}
            {showResults && searchQuery.length >= 2 && (
              <div className="absolute z-10 mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto">
                {searchResults.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {searchResults.map((patient) => (
                      <div
                        key={patient.id}
                        onClick={() => handleSelectPatient(patient)}
                        className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900">
                                {patient.firstName} {patient.lastName}
                              </span>
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                {patient.patientId}
                              </span>
                            </div>
                            <div className="mt-1 flex items-center gap-4 text-sm text-gray-600">
                              <span>{patient.age} years old</span>
                              <span>{patient.gender}</span>
                              <span>{patient.phone}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-gray-500">
                    No patients found
                  </div>
                )}
              </div>
            )}
          </div>

          <p className="mt-4 text-sm text-gray-500">
            Start typing a patient's name, ID, or phone number to search
          </p>
        </div>
      )}

      {/* Invoice Form */}
      {patientInfo && (
        <div className="card">
          {/* Show selected patient with option to change */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Selected Patient:</p>
              <p className="font-medium text-gray-900">{patientInfo.name}</p>
            </div>
            <button
              onClick={() => setPatientInfo(null)}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Change Patient
            </button>
          </div>

          <InvoiceForm
            patientId={patientInfo.id}
            patientName={patientInfo.name}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </div>
      )}
    </div>
  );
};

export default CreateInvoicePage;
