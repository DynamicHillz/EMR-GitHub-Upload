/**
 * Pharmacy Page
 *
 * Main pharmacy management interface
 * - Prescription queue (REQ-PHARM-1)
 * - Medication dispensing (REQ-PHARM-2, REQ-PHARM-3, REQ-PHARM-7)
 */

import React, { useState, useEffect } from 'react';
import { Pill, AlertTriangle, Clock, User, Search, CheckCircle, XCircle, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DispenseModal from '../components/pharmacy/DispenseModal';
import StockAlertsWidget from '../components/pharmacy/StockAlertsWidget';

interface Prescription {
  id: string;
  patientId: string;
  patientName: string;
  patientAge: number;
  patientGender: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  quantity: number | null;
  prescribedBy: string;
  prescribedByName: string;
  prescribedAt: string;
  allergyWarning: boolean;
  interactionWarning: boolean;
  status: string;
  clinicalIndication?: string;
}

const PharmacyPage: React.FC = () => {
  const navigate = useNavigate();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [isDispenseModalOpen, setIsDispenseModalOpen] = useState(false);

  useEffect(() => {
    fetchPrescriptions();
    // Refresh every 30 seconds
    const interval = setInterval(fetchPrescriptions, 30000);
    return () => clearInterval(interval);
  }, [statusFilter]);

  const fetchPrescriptions = async () => {
    try {
      const token = localStorage.getItem('token');
      let url = `http://localhost:3000/api/pharmacy/prescriptions?status=${statusFilter}`;

      if (searchQuery) {
        url += `&search=${encodeURIComponent(searchQuery)}`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        setPrescriptions(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching prescriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchPrescriptions();
  };

  const handleDispense = (prescription: Prescription) => {
    setSelectedPrescription(prescription);
    setIsDispenseModalOpen(true);
  };

  const handleDispenseSuccess = () => {
    fetchPrescriptions(); // Refresh the list
    setIsDispenseModalOpen(false);
    setSelectedPrescription(null);
  };

  const handleCloseModal = () => {
    setIsDispenseModalOpen(false);
    setSelectedPrescription(null);
  };

  const getUrgencyIndicator = (prescription: Prescription) => {
    if (prescription.allergyWarning) {
      return (
        <span className="flex items-center gap-1 text-red-600 font-semibold">
          <AlertTriangle className="w-4 h-4" />
          ALLERGY
        </span>
      );
    }
    if (prescription.interactionWarning) {
      return (
        <span className="flex items-center gap-1 text-orange-600 font-semibold">
          <AlertTriangle className="w-4 h-4" />
          INTERACTION
        </span>
      );
    }
    return null;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const filteredPrescriptions = prescriptions.filter((prescription) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      prescription.patientName.toLowerCase().includes(query) ||
      prescription.medicationName.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Pill className="w-16 h-16 text-purple-600 mx-auto animate-pulse" />
          <p className="mt-4 text-gray-600">Loading prescription queue...</p>
        </div>
      </div>
    );
  }

  const handleAlertClick = (alert: any) => {
    navigate('/pharmacy/inventory');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Pill className="w-8 h-8 text-purple-600" />
              Pharmacy Management
            </h1>
            <p className="text-gray-600 mt-2">
              Manage prescriptions and medication dispensing
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/pharmacy/medications')}
              className="btn btn-secondary flex items-center gap-2"
            >
              <Pill className="w-5 h-5" />
              Medications
            </button>
            <button
              onClick={() => navigate('/pharmacy/inventory')}
              className="btn btn-secondary flex items-center gap-2"
            >
              <Package className="w-5 h-5" />
              Inventory
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Pending</h3>
          <p className="text-3xl font-bold text-gray-900">
            {prescriptions.filter((p) => p.status === 'PENDING').length}
          </p>
        </div>
        <div className="bg-red-50 rounded-lg border border-red-200 p-6">
          <h3 className="text-sm font-medium text-red-600 mb-2">Allergy Warnings</h3>
          <p className="text-3xl font-bold text-red-700">
            {prescriptions.filter((p) => p.allergyWarning).length}
          </p>
        </div>
        <div className="bg-orange-50 rounded-lg border border-orange-200 p-6">
          <h3 className="text-sm font-medium text-orange-600 mb-2">Interactions</h3>
          <p className="text-3xl font-bold text-orange-700">
            {prescriptions.filter((p) => p.interactionWarning).length}
          </p>
        </div>
        <div className="bg-green-50 rounded-lg border border-green-200 p-6">
          <h3 className="text-sm font-medium text-green-600 mb-2">Dispensed Today</h3>
          <p className="text-3xl font-bold text-green-700">
            {prescriptions.filter((p) => p.status === 'DISPENSED').length}
          </p>
        </div>
      </div>

      {/* Stock Alerts Widget (REQ-PHARM-5) */}
      <div className="mb-6">
        <StockAlertsWidget onAlertClick={handleAlertClick} />
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Search className="w-4 h-4 inline mr-1" />
              Search
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search patient name or medication..."
                className="input flex-1"
              />
              <button onClick={handleSearch} className="btn btn-secondary">
                Search
              </button>
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input w-full"
            >
              <option value="PENDING">Pending</option>
              <option value="DISPENSED">Dispensed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Prescription Queue */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold">Prescription Queue</h2>
          <p className="text-sm text-gray-600 mt-1">
            {filteredPrescriptions.length} prescription(s)
          </p>
        </div>

        {filteredPrescriptions.length === 0 ? (
          <div className="text-center py-12">
            <Pill className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No prescriptions found</p>
            <p className="text-gray-400 text-sm mt-2">
              Prescriptions will appear here when doctors create them
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Medication
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dosage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Prescribed By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPrescriptions.map((prescription) => (
                  <tr
                    key={prescription.id}
                    className={`hover:bg-gray-50 ${
                      prescription.allergyWarning
                        ? 'bg-red-50'
                        : prescription.interactionWarning
                        ? 'bg-orange-50'
                        : ''
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getUrgencyIndicator(prescription)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {prescription.patientName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {prescription.patientAge}y / {prescription.patientGender}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900" 
                        title={prescription.clinicalIndication || ''}>
                        {prescription.medicationName}
                        {prescription.clinicalIndication && (
                        <span className="ml-1 text-gray-400 cursor-help" title={prescription.clinicalIndication}>ⓘ</span>
                         )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{prescription.dosage}</div>
                      <div className="text-sm text-gray-500">{prescription.frequency}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {prescription.quantity || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-500">
                        <User className="w-4 h-4 mr-1" />
                        {prescription.prescribedByName}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-500">
                        <Clock className="w-4 h-4 mr-1" />
                        {formatDate(prescription.prescribedAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {prescription.status === 'PENDING' ? (
                        <button
                          onClick={() => handleDispense(prescription)}
                          className="text-purple-600 hover:text-purple-900"
                        >
                          Dispense
                        </button>
                      ) : prescription.status === 'DISPENSED' ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="w-4 h-4" />
                          Dispensed
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-gray-600">
                          <XCircle className="w-4 h-4" />
                          Cancelled
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dispense Modal */}
      {selectedPrescription && (
        <DispenseModal
          prescription={selectedPrescription}
          isOpen={isDispenseModalOpen}
          onClose={handleCloseModal}
          onSuccess={handleDispenseSuccess}
        />
      )}
    </div>
  );
};

export default PharmacyPage;
