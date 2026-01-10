'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Footer } from '@/components/marketing';
import { payoutAPI } from '@/lib/api';
import { cn } from '@/lib/utils';

interface PayoutLedger {
  _id: string;
  orderId: string;
  resellerId: string;
  supplierId: string;
  platformFee: number;
  supplierAmount: number;
  resellerAmount: number;
  totalAmount: number;
  stripeTransferGroup: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
}

const PayoutStatusBadge: React.FC<{ status: PayoutLedger['status'] }> = ({ status }) => {
  const variants = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    completed: 'bg-green-100 text-green-800 border-green-200',
    failed: 'bg-red-100 text-red-800 border-red-200',
  };

  const labels = {
    pending: 'Pending',
    completed: 'Completed',
    failed: 'Failed',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border',
        variants[status]
      )}
    >
      {labels[status]}
    </span>
  );
};

export default function AdminPayoutsPage() {
  const [payouts, setPayouts] = useState<PayoutLedger[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    supplierId: '',
    resellerId: '',
    status: '' as '' | 'pending' | 'completed' | 'failed',
  });

  const fetchPayouts = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {};
      if (filters.supplierId) params.supplierId = filters.supplierId;
      if (filters.resellerId) params.resellerId = filters.resellerId;
      if (filters.status) params.status = filters.status;

      const response = await payoutAPI.getPayouts(params);
      if (response.success) {
        setPayouts(response.data || []);
      } else {
        setError(response.message || 'Failed to fetch payouts');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching payouts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayouts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.supplierId, filters.resellerId, filters.status]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-6">
          <SectionTitle>Payout Ledger</SectionTitle>
          <p className="text-gray-600 mt-2">View and manage all payout transactions</p>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="supplierId" className="block text-sm font-medium text-gray-700 mb-1">
                  Supplier ID
                </label>
                <input
                  id="supplierId"
                  type="text"
                  value={filters.supplierId}
                  onChange={(e) => setFilters({ ...filters, supplierId: e.target.value })}
                  placeholder="Filter by supplier ID"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="resellerId" className="block text-sm font-medium text-gray-700 mb-1">
                  Reseller ID
                </label>
                <input
                  id="resellerId"
                  type="text"
                  value={filters.resellerId}
                  onChange={(e) => setFilters({ ...filters, resellerId: e.target.value })}
                  placeholder="Filter by reseller ID"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  id="status"
                  value={filters.status}
                  onChange={(e) =>
                    setFilters({ ...filters, status: e.target.value as typeof filters.status })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payouts Table */}
        <Card>
          <CardHeader>
            <CardTitle>Payout Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Loading payouts...</p>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <p className="text-red-500">{error}</p>
                <button
                  onClick={fetchPayouts}
                  className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                >
                  Retry
                </button>
              </div>
            ) : payouts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No payouts found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Order ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Supplier Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reseller Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Platform Fee
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created At
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {payouts.map((payout) => (
                      <tr key={payout._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{payout.orderId}</div>
                          <div className="text-xs text-gray-500">
                            Supplier: {payout.supplierId.substring(0, 8)}...
                          </div>
                          <div className="text-xs text-gray-500">
                            Reseller: {payout.resellerId.substring(0, 8)}...
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(payout.supplierAmount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(payout.resellerAmount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(payout.platformFee)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                          {formatCurrency(payout.totalAmount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <PayoutStatusBadge status={payout.status} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(payout.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}

