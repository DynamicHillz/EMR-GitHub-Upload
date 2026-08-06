import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Baby, AlertCircle } from 'lucide-react';
import postnatalService from '../../services/postnatal.service';
import { PostnatalWorklistItem } from '../../types/postnatal';
import DismissWorklistItemModal from '../../components/common/DismissWorklistItemModal';
import { useToast } from '../../components/ToastContainer';

const CONTACT_LABELS: Record<string, string> = {
  PNC_24H: '24 Hours',
  PNC_DAY3: 'Day 3',
  PNC_WEEK1: 'Week 1',
  PNC_WEEK6: 'Week 6',
  OTHER: 'Other',
};

const daysOverdueLabel = (expectedDate: string) => {
  const days = Math.floor((Date.now() - new Date(expectedDate).getTime()) / (1000 * 60 * 60 * 24));
  if (days > 0) return { text: `${days} day${days === 1 ? '' : 's'} overdue`, overdue: true };
  if (days === 0) return { text: 'Due today', overdue: true };
  return { text: `Due in ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`, overdue: false };
};

const PostnatalDuePage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [items, setItems] = useState<PostnatalWorklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [dismissingItem, setDismissingItem] = useState<PostnatalWorklistItem | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const result = await postnatalService.getWorklist(7, 1);
      setItems(result.items);
      setPage(result.page);
      setTotalPages(result.totalPages);
    } catch (error) {
      console.error('Failed to load postnatal worklist', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    try {
      setLoadingMore(true);
      const result = await postnatalService.getWorklist(7, page + 1);
      setItems((prev) => [...prev, ...result.items]);
      setPage(result.page);
      setTotalPages(result.totalPages);
    } catch (error) {
      console.error('Failed to load more postnatal worklist items', error);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDismiss = async (reason: string, reasonNotes: string) => {
    if (!dismissingItem) return;
    try {
      await postnatalService.dismissDue(dismissingItem.patientId, {
        pregnancyId: dismissingItem.pregnancyId,
        contactType: dismissingItem.contactType,
        reason,
        reasonNotes,
      });
      toast.success('Dismissed');
      setDismissingItem(null);
      load();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to dismiss');
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Baby className="w-6 h-6 text-primary-600" /> Postnatal Care Due
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          PNC contacts (24h / day 3 / week 1 / week 6) that are overdue or due within the next 7 days, clinic-wide.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 border-2 border-dashed rounded-lg text-gray-500">
          Nothing due or overdue in the next 7 days.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {items.map((item) => {
            const label = daysOverdueLabel(item.expectedDate);
            return (
              <div key={item.id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50">
                <button onClick={() => navigate(`/patients?patientId=${item.patient.id}`)} className="text-left flex-1">
                  <p className="font-medium text-gray-900">
                    {item.patient.firstName} {item.patient.lastName}
                    <span className="text-xs text-gray-400 font-normal ml-2">{item.patient.patientId}</span>
                  </p>
                  <p className="text-sm text-gray-600 mt-0.5">{CONTACT_LABELS[item.contactType] || item.contactType} contact</p>
                </button>
                <div className="flex items-center gap-3">
                  <span className={`flex items-center gap-1 text-sm font-medium px-2.5 py-1 rounded-full ${
                    label.overdue ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {label.overdue && <AlertCircle className="w-3.5 h-3.5" />}
                    {label.text}
                  </span>
                  <button onClick={() => setDismissingItem(item)} className="text-xs font-medium text-gray-500 hover:text-gray-800">
                    Dismiss
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && page < totalPages && (
        <div className="text-center mt-4">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="px-4 py-2 text-sm font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-md disabled:opacity-50"
          >
            {loadingMore ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}

      {dismissingItem && (
        <DismissWorklistItemModal
          title={`${CONTACT_LABELS[dismissingItem.contactType] || dismissingItem.contactType} — ${dismissingItem.patient.firstName} ${dismissingItem.patient.lastName}`}
          onClose={() => setDismissingItem(null)}
          onDismiss={handleDismiss}
        />
      )}
    </div>
  );
};

export default PostnatalDuePage;
