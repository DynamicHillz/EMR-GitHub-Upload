import React from 'react';
import PaymentList from '../../components/billing/PaymentList';

const PaymentListPage: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
        <p className="text-gray-600 mt-1">View all payment transactions</p>
      </div>

      {/* Payment List */}
      <PaymentList />
    </div>
  );
};

export default PaymentListPage;
