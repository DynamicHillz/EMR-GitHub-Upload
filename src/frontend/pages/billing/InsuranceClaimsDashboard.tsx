import React, { useState, useEffect } from 'react';
import { formatCurrency, formatDate } from '../../utils/formatters';
import Dropdown from '../../components/common/Dropdown';

interface InsuranceClaim {
  id: string;
  status: string;
  amountClaimed: number;
  amountApproved: number | null;
  denialReason: string | null;
  paidAmount: number | null;
  paidAt: string | null;
  invoice?: { invoiceNumber: string };
  provider?: { name: string };
}

interface ClaimEdits {
  status: string;
  amountApproved: string;
  denialReason: string;
}

const API_BASE = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`;

const toEdits = (claim: InsuranceClaim): ClaimEdits => ({
  status: claim.status,
  amountApproved: claim.amountApproved != null ? String(claim.amountApproved) : '',
  denialReason: claim.denialReason || '',
});

const InsuranceClaimsDashboard: React.FC = () => {
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [edits, setEdits] = useState<Record<string, ClaimEdits>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadClaims();
  }, []);

  const loadClaims = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/insurance/claims`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        const list: InsuranceClaim[] = data || [];
        setClaims(list);
        setEdits(Object.fromEntries(list.map(c => [c.id, toEdits(c)])));
      } else {
        setError('Failed to load claims');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const updateEdit = (id: string, field: keyof ClaimEdits, value: string) => {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  // Always sends the row's full edited state (status + amountApproved +
  // denialReason) rather than just the changed field — insurance.controller.ts's
  // updateClaimStatus overwrites amountApproved/denialReason unconditionally
  // on every save, so sending status alone would silently wipe out a
  // previously-approved amount.
  const handleSave = async (id: string) => {
    const edit = edits[id];
    if (!edit) return;
    setSavingId(id);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/insurance/claims/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          status: edit.status,
          amountApproved: edit.amountApproved === '' ? undefined : Number(edit.amountApproved),
          denialReason: edit.denialReason || undefined,
        })
      });
      if (!res.ok) {
        setError('Failed to update claim');
        return;
      }
      await loadClaims();
    } catch (err) {
      setError('Network error');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading claims...</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Insurance Claims</h1>

      {error && <div className="bg-red-50 text-red-800 p-4 rounded-md mb-6">{error}</div>}

      <div className="bg-white rounded-lg shadow-md overflow-hidden overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Claimed</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Approved Amount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Denial Reason</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Settlement</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {claims.map((claim) => {
              const edit = edits[claim.id] || toEdits(claim);
              const dirty = edit.status !== claim.status
                || edit.amountApproved !== (claim.amountApproved != null ? String(claim.amountApproved) : '')
                || edit.denialReason !== (claim.denialReason || '');
              return (
                <tr key={claim.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {claim.invoice?.invoiceNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {claim.provider?.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium text-blue-600">
                    {formatCurrency(claim.amountClaimed)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <Dropdown
                      className="text-sm px-3 py-2 rounded-md border-2 border-gray-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none"
                      value={edit.status}
                      onChange={(e) => updateEdit(claim.id, 'status', e.target.value)}
                    >
                      <option value="DRAFT">DRAFT</option>
                      <option value="SUBMITTED">SUBMITTED</option>
                      <option value="APPROVED">APPROVED</option>
                      <option value="DENIED">DENIED</option>
                      <option value="PARTIALLY_APPROVED">PARTIALLY APPROVED</option>
                      <option value="APPEALED">APPEALED</option>
                      <option value="PAID">PAID</option>
                    </Dropdown>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input w-32"
                      placeholder={formatCurrency(claim.amountClaimed)}
                      value={edit.amountApproved}
                      onChange={(e) => updateEdit(claim.id, 'amountApproved', e.target.value)}
                    />
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <input
                      type="text"
                      className="input w-48"
                      placeholder={edit.status === 'DENIED' ? 'Reason for denial' : 'N/A'}
                      value={edit.denialReason}
                      onChange={(e) => updateEdit(claim.id, 'denialReason', e.target.value)}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {claim.status === 'PAID' && claim.paidAmount != null ? (
                      <>
                        <div className="font-medium text-green-700">{formatCurrency(claim.paidAmount)}</div>
                        {claim.paidAt && <div className="text-xs text-gray-500">{formatDate(claim.paidAt)}</div>}
                      </>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                    <button
                      type="button"
                      disabled={!dirty || savingId === claim.id}
                      onClick={() => handleSave(claim.id)}
                      className="px-3 py-1.5 text-sm font-medium rounded-md bg-primary-600 text-white disabled:bg-gray-200 disabled:text-gray-400 hover:bg-primary-700"
                    >
                      {savingId === claim.id ? 'Saving...' : 'Save'}
                    </button>
                  </td>
                </tr>
              );
            })}
            {claims.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-4 text-center text-gray-500">No claims found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InsuranceClaimsDashboard;
