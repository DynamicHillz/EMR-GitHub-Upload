import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Baby } from 'lucide-react';

interface UnnamedNewborn {
  id: string;
  patientId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  createdAt: string;
  mother: { id: string; patientId: string; firstName: string; lastName: string; phone: string } | null;
}

const getApiBaseUrl = () => import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`;

// Newborns registered at delivery keep a placeholder identity ("Baby" +
// synthetic phone) until staff rename them once the birth is formally
// registered — this worklist exists so that doesn't get forgotten.
const UnnamedNewbornsPage: React.FC = () => {
  const navigate = useNavigate();
  const [newborns, setNewborns] = useState<UnnamedNewborn[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchPage = async (pageToFetch: number) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${getApiBaseUrl()}/api/patients/unnamed-newborns?page=${pageToFetch}&limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return res.json();
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const result = await fetchPage(1);
        if (result) {
          setNewborns(result.data || []);
          setPage(result.page || 1);
          setTotalPages(result.totalPages || 1);
        }
      } catch (error) {
        console.error('Failed to load unnamed newborns', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const loadMore = async () => {
    try {
      setLoadingMore(true);
      const result = await fetchPage(page + 1);
      if (result) {
        setNewborns((prev) => [...prev, ...(result.data || [])]);
        setPage(result.page || page + 1);
        setTotalPages(result.totalPages || 1);
      }
    } catch (error) {
      console.error('Failed to load more unnamed newborns', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const daysOld = (dateOfBirth: string) => Math.floor((Date.now() - new Date(dateOfBirth).getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Baby className="w-6 h-6 text-primary-600" /> Unnamed Newborns
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Newborns still using their placeholder name and phone from delivery — rename them once the birth is formally registered.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : newborns.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 border-2 border-dashed rounded-lg text-gray-500">
          No unnamed newborns on file.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {newborns.map((newborn) => (
            <button
              key={newborn.id}
              onClick={() => navigate(`/patients?patientId=${newborn.id}`)}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50"
            >
              <div>
                <p className="font-medium text-gray-900">
                  {newborn.firstName} {newborn.lastName}
                  <span className="text-xs text-gray-400 font-normal ml-2">{newborn.patientId}</span>
                </p>
                <p className="text-sm text-gray-600 mt-0.5">
                  {daysOld(newborn.dateOfBirth)} day{daysOld(newborn.dateOfBirth) === 1 ? '' : 's'} old
                  {newborn.mother && <> — Mother: {newborn.mother.firstName} {newborn.mother.lastName}</>}
                </p>
              </div>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">Needs renaming</span>
            </button>
          ))}
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
    </div>
  );
};

export default UnnamedNewbornsPage;
