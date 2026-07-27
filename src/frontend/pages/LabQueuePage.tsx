/**
 * Lab Queue Page
 *
 * Display pending lab test requests for lab technicians
 * REQ-LAB-1: Display pending lab tests sorted by urgency
 * REQ-LAB-2: Allow lab technicians to update test status
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Beaker, AlertTriangle, Clock, User, Search, Filter, Plus } from 'lucide-react';
import LabTestDetailsModal from '../components/lab/LabTestDetailsModal';
import NewLabTestModal from '../components/lab/NewLabTestModal';
import Dropdown from '../components/common/Dropdown';

interface LabTest {
  id: string;
  patientId: string;
  patientName: string;
  patientAge: number;
  patientGender: string;
  testName: string;
  testCode: string | null;
  clinicalIndication: string | null;
  urgency: 'ROUTINE' | 'URGENT' | 'STAT';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REVIEWED' | 'REJECTED';
  accessionNumber: string | null;
  unitPrice: number;
  orderedBy: string;
  orderedByName: string;
  consultationId: string | null;
  specimenType: string | null;
  specimenQuality: string | null;
  collectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

const LabQueuePage: React.FC = () => {
  const [labTests, setLabTests] = useState<LabTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('');
  const [selectedTest, setSelectedTest] = useState<LabTest | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showNewTestModal, setShowNewTestModal] = useState(false);

  useEffect(() => {
    fetchLabTests();
    // Refresh every 30 seconds
    const interval = setInterval(fetchLabTests, 30000);
    return () => clearInterval(interval);
  }, [statusFilter, urgencyFilter]);

  const fetchLabTests = async () => {
    try {
      const token = localStorage.getItem('token');
      let url = `${window.location.protocol}//${window.location.hostname}:3000/api/lab/tests?`;

      if (statusFilter) {
        url += `status=${statusFilter}&`;
      }

      if (urgencyFilter) {
        url += `urgency=${urgencyFilter}&`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        setLabTests(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching lab tests:', error);
    } finally {
      setLoading(false);
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'STAT':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'URGENT':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'ROUTINE':
      default:
        return 'bg-blue-100 text-blue-800 border-blue-300';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-gray-100 text-gray-800';
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'REVIEWED':
        return 'bg-purple-100 text-purple-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const filteredTests = labTests.filter((test) => {
    const matchesSearch =
      test.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      test.testName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (test.testCode && test.testCode.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesSearch;
  });

  const handleTestClick = (test: LabTest) => {
    setSelectedTest(test);
    setShowDetailsModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Beaker className="w-16 h-16 text-purple-600 mx-auto animate-pulse" />
          <p className="mt-4 text-gray-600">Loading lab queue...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Beaker className="w-8 h-8 text-purple-600" />
            Laboratory Queue
          </h1>
          <p className="text-gray-500 mt-1">Manage and process pending lab test requests</p>
        </div>
        <div className="flex space-x-3">
          <Link
            to="/lab/catalog"
            className="btn-secondary flex items-center"
          >
            Manage Catalog
          </Link>
          <button
            onClick={() => setShowNewTestModal(true)}
            className="btn-primary flex items-center"
          >
            <Plus className="w-5 h-5 mr-2" />
            Order Lab Test
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Search className="w-4 h-4 inline mr-1" />
              Search
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search patient name, test name, or code..."
              className="input w-full"
            />
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Filter className="w-4 h-4 inline mr-1" />
              Status
            </label>
            <Dropdown
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input w-full"
            >
              <option value="">Pending &amp; In Progress (default)</option>
              <option value="PENDING">Pending Only</option>
              <option value="IN_PROGRESS">In Progress Only</option>
              <option value="COMPLETED">Completed</option>
              <option value="ALL">All Statuses</option>
            </Dropdown>
          </div>

          {/* Urgency Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <AlertTriangle className="w-4 h-4 inline mr-1" />
              Urgency
            </label>
            <Dropdown
              value={urgencyFilter}
              onChange={(e) => setUrgencyFilter(e.target.value)}
              className="input w-full"
            >
              <option value="">All</option>
              <option value="STAT">STAT</option>
              <option value="URGENT">Urgent</option>
              <option value="ROUTINE">Routine</option>
            </Dropdown>
          </div>
        </div>
      </div>

      {/* Queue Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Total Queue</h3>
          <p className="text-3xl font-bold text-gray-900">{filteredTests.length}</p>
        </div>
        <div className="bg-red-50 rounded-lg border border-red-200 p-6">
          <h3 className="text-sm font-medium text-red-600 mb-2">STAT</h3>
          <p className="text-3xl font-bold text-red-700">
            {filteredTests.filter((t) => t.urgency === 'STAT').length}
          </p>
        </div>
        <div className="bg-orange-50 rounded-lg border border-orange-200 p-6">
          <h3 className="text-sm font-medium text-orange-600 mb-2">Urgent</h3>
          <p className="text-3xl font-bold text-orange-700">
            {filteredTests.filter((t) => t.urgency === 'URGENT').length}
          </p>
        </div>
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
          <h3 className="text-sm font-medium text-blue-600 mb-2">In Progress</h3>
          <p className="text-3xl font-bold text-blue-700">
            {filteredTests.filter((t) => t.status === 'IN_PROGRESS').length}
          </p>
        </div>
      </div>

      {/* Lab Tests List */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {filteredTests.length === 0 ? (
          <div className="text-center py-12">
            <Beaker className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No lab tests found</p>
            <p className="text-gray-400 text-sm mt-2">
              Try adjusting your filters or search query
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Urgency
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Accession No.
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Test
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ordered By
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
                {filteredTests.map((test) => (
                  <tr
                    key={test.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleTestClick(test)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold border ${getUrgencyColor(
                          test.urgency
                        )}`}
                      >
                        {test.urgency}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {test.patientName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {test.patientAge}y / {test.patientGender}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-mono text-gray-900 bg-gray-100 px-2 py-1 rounded inline-block">
                        {test.accessionNumber || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {test.testName}
                      </div>
                      {test.testCode && test.testCode !== test.testName && (
                        <div className="text-sm text-gray-500">{test.testCode}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                          test.status
                        )}`}
                      >
                        {test.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-500">
                        <User className="w-4 h-4 mr-1" />
                        {test.orderedByName}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-500">
                        <Clock className="w-4 h-4 mr-1" />
                        {formatDate(test.createdAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTestClick(test);
                        }}
                        className="text-purple-600 hover:text-purple-900"
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lab Test Details Modal */}
      {showDetailsModal && selectedTest && (
        <LabTestDetailsModal
          testId={selectedTest.id}
          onClose={() => setShowDetailsModal(false)}
          onSuccess={() => {
            fetchLabTests();
            setShowDetailsModal(false);
          }}
        />
      )}

      {/* New Lab Test Modal */}
      {showNewTestModal && (
        <NewLabTestModal
          onClose={() => setShowNewTestModal(false)}
          onSuccess={() => {
            fetchLabTests();
            setShowNewTestModal(false);
          }}
        />
      )}
    </div>
  );
};

export default LabQueuePage;
