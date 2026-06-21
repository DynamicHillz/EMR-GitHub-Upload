import React from 'react';
import RefundList from '../../components/billing/RefundList';

const RefundListPage: React.FC = () => {
  const handleApprove = () => {
    // Refund list will reload automatically after approval
  };

  const handleReject = () => {
    // Refund list will reload automatically after rejection
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Refund Management</h1>
        <p className="text-gray-600 mt-1">
          Review and manage refund requests
        </p>
      </div>

      {/* Refund List */}
      <RefundList onApprove={handleApprove} onReject={handleReject} />
    </div>
  );
};

export default RefundListPage;
