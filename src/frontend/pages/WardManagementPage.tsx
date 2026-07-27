import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '../utils/formatters';
import { Plus, Edit2, Trash2, Bed, Eye } from 'lucide-react';
import InpatientService from '../services/InpatientService';
import { Ward } from '../types/inpatient';
import WardModal from '../components/inpatient/WardModal';
import { useToast } from '../components/ToastContainer';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { useAuth } from '../contexts/AuthContext';

const WardManagementPage: React.FC = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const canManageWards = hasRole(['SUPER_ADMIN', 'ADMIN']);
  const [wards, setWards] = useState<Ward[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedWard, setSelectedWard] = useState<Ward | null>(null);
  
  // For deletion confirm
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [wardToDelete, setWardToDelete] = useState<Ward | null>(null);

  const fetchWards = async () => {
    try {
      setLoading(true);
      const data = await InpatientService.getWards();
      setWards(data);
    } catch (error) {
      toast.error('Failed to load wards');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWards();
  }, []);

  const handleAdd = () => {
    setSelectedWard(null);
    setIsModalOpen(true);
  };

  const handleEdit = (ward: Ward) => {
    setSelectedWard(ward);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (ward: Ward) => {
    setWardToDelete(ward);
    setIsConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!wardToDelete) return;
    try {
      await InpatientService.deleteWard(wardToDelete.id);
      toast.success('Ward deleted successfully');
      fetchWards();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete ward. Ensure it has no occupied beds.');
    } finally {
      setIsConfirmOpen(false);
      setWardToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Ward Management</h1>
          <p className="text-gray-600">Manage hospital wards, room types, and pricing</p>
        </div>
        {canManageWards && (
          <button onClick={handleAdd} className="btn btn-primary flex items-center">
            <Plus className="w-5 h-5 mr-2" />
            Add Ward
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading wards...</div>
        ) : wards.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Bed className="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <p>No wards configured yet.</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ward Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Capacity & Occupancy
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Daily Cost
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {wards.map((ward) => {
                const totalBeds = ward.beds?.length || 0;
                const occupiedBeds = ward.beds?.filter(b => b.status === 'OCCUPIED').length || 0;
                const availableBeds = totalBeds - occupiedBeds;
                
                return (
                  <tr key={ward.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{ward.name}</div>
                      <div className="text-sm text-gray-500">{ward.type}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{ward.capacity} Beds Total</div>
                      <div className="text-sm text-gray-500">
                        {occupiedBeds} occupied, {availableBeds} available
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(ward.dailyCost || 0)} / day
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => navigate(`/inpatient?ward=${ward.id}`)}
                        className="text-gray-500 hover:text-primary-700 mx-2"
                        title="View Beds"
                      >
                        <Eye className="w-5 h-5 inline" />
                      </button>
                      {canManageWards && (
                        <>
                          <button
                            onClick={() => handleEdit(ward)}
                            className="text-primary-600 hover:text-primary-900 mx-2"
                          >
                            <Edit2 className="w-5 h-5 inline" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(ward)}
                            className="text-red-600 hover:text-red-900 mx-2"
                          >
                            <Trash2 className="w-5 h-5 inline" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <WardModal
          ward={selectedWard}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            setIsModalOpen(false);
            fetchWards();
          }}
        />
      )}

      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="Delete Ward"
        message={`Are you sure you want to delete ${wardToDelete?.name}? This action cannot be undone and will fail if beds are occupied.`}
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </div>
  );
};

export default WardManagementPage;
