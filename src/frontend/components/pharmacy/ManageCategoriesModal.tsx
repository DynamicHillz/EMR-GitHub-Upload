import React, { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2 } from 'lucide-react';
import { useToast } from '../ToastContainer';
import ConfirmDialog from '../common/ConfirmDialog';

interface Category {
  id: string;
  name: string;
  description: string | null;
}

interface ManageCategoriesModalProps {
  onClose: () => void;
}

const ManageCategoriesModal: React.FC<ManageCategoriesModalProps> = ({ onClose }) => {
  const toast = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`}/api/pharmacy/categories`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const result = await response.json();
        setCategories(result.data || []);
      } else {
        toast.error('Failed to fetch categories');
      }
    } catch (error) {
      toast.error('Error connecting to server');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      const token = localStorage.getItem('token');
      const isEditing = editingId !== null;
      const url = isEditing 
        ? `${import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`}/api/pharmacy/categories/${editingId}`
        : `${import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`}/api/pharmacy/categories`;

      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();
      if (response.ok) {
        toast.success(isEditing ? 'Category updated' : 'Category created');
        setFormData({ name: '', description: '' });
        setEditingId(null);
        fetchCategories();
      } else {
        toast.error(result.message || 'Error saving category');
      }
    } catch (error) {
      toast.error('Error connecting to server');
    }
  };

  const handleEdit = (cat: Category) => {
    setFormData({ name: cat.name, description: cat.description || '' });
    setEditingId(cat.id);
  };

  const handleDeleteClick = (cat: Category) => {
    setCategoryToDelete(cat);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!categoryToDelete) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`}/api/pharmacy/categories/${categoryToDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        toast.success('Category deleted');
        fetchCategories();
      } else {
        const data = await response.json();
        toast.error(data.message || 'Failed to delete category');
      }
    } catch (error) {
      toast.error('Error connecting to server');
    } finally {
      setDeleteConfirmOpen(false);
      setCategoryToDelete(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Manage Inventory Categories</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <form onSubmit={handleSubmit} className="mb-8 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              {editingId ? 'Edit Category' : 'Add New Category'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  className="input w-full text-sm"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Consumables"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                <input
                  type="text"
                  className="input w-full text-sm"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end space-x-2">
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setFormData({ name: '', description: '' });
                  }}
                  className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className="btn btn-primary py-1.5 text-sm"
              >
                {editingId ? 'Update Category' : 'Add Category'}
              </button>
            </div>
          </form>

          {loading ? (
            <div className="text-center py-4 text-gray-500">Loading categories...</div>
          ) : categories.length === 0 ? (
            <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
              No custom categories found. Start by adding one above.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {categories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{cat.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cat.description || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button onClick={() => handleEdit(cat)} className="text-primary-600 hover:text-primary-900 mx-2">
                        <Edit2 className="h-4 w-4 inline" />
                      </button>
                      <button onClick={() => handleDeleteClick(cat)} className="text-red-600 hover:text-red-900 mx-2">
                        <Trash2 className="h-4 w-4 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        title="Delete Category"
        message={`Are you sure you want to delete the category "${categoryToDelete?.name}"? You cannot delete categories that are currently assigned to medications/items.`}
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </div>
  );
};

export default ManageCategoriesModal;
