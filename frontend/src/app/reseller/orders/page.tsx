'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface Order {
  _id: string;
  orderId: string;
  orderNumber?: string;
  customerName?: string;
  customerEmail?: string;
  orderStatus: string;
  paymentStatus?: string;
  paymentMethod?: string;
  grandTotal: number;
  subtotal: number;
  taxTotal: number;
  discountAmount: number;
  shippingAmount: number;
  itemsCount: number;
  createdAt: string;
  shippingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
}

interface OrdersResponse {
  success: boolean;
  data?: {
    orders: Order[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    dateRange: {
      start: string;
      end: string;
    };
  };
  message?: string;
}

export default function ResellerOrdersPage() {
  const router = useRouter();
  const user = getCurrentUser();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [filters, setFilters] = useState({
    orderStatus: '',
    paymentStatus: '',
    search: '',
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (!user || user.role !== 'reseller') {
      router.push('/unauthorized');
      return;
    }
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, filters]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append('page', pagination.page.toString());
      params.append('limit', pagination.limit.toString());
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.orderStatus) params.append('orderStatus', filters.orderStatus);
      if (filters.paymentStatus) params.append('paymentStatus', filters.paymentStatus);
      if (filters.search) params.append('q', filters.search);

      const response = await api.get(`/reseller/orders?${params.toString()}`);
      const data: OrdersResponse = response.data;

      if (data.success && data.data) {
        setOrders(data.data.orders);
        setPagination(data.data.pagination);
      } else {
        setError(data.message || 'Failed to load orders');
      }
    } catch (err: any) {
      console.error('[RESELLER ORDERS] Load error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: 'bg-yellow-500/20 text-yellow-400',
      confirmed: 'bg-blue-500/20 text-blue-400',
      processing: 'bg-purple-500/20 text-purple-400',
      shipped: 'bg-indigo-500/20 text-indigo-400',
      delivered: 'bg-green-500/20 text-green-400',
      cancelled: 'bg-red-500/20 text-red-400',
      refunded: 'bg-gray-500/20 text-gray-400',
    };
    return statusMap[status] || 'bg-gray-500/20 text-gray-400';
  };

  const getPaymentStatusColor = (status?: string) => {
    if (!status) return 'bg-gray-500/20 text-gray-400';
    const statusMap: Record<string, string> = {
      pending: 'bg-yellow-500/20 text-yellow-400',
      paid: 'bg-green-500/20 text-green-400',
      failed: 'bg-red-500/20 text-red-400',
      cod_pending: 'bg-orange-500/20 text-orange-400',
      cod_collected: 'bg-green-500/20 text-green-400',
      cod_failed: 'bg-red-500/20 text-red-400',
      cod_partial_paid: 'bg-yellow-500/20 text-yellow-400',
    };
    return statusMap[status] || 'bg-gray-500/20 text-gray-400';
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 })); // Reset to first page
  };

  if (loading && orders.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Orders</h1>
          <p className="text-text-secondary">View and manage your orders</p>
        </div>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Orders</h1>
        <p className="text-text-secondary">View and manage your orders</p>
      </div>

      {/* Filters */}
      <Card className="bg-surface border-border">
        <CardHeader>
          <CardTitle className="text-white">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Search</label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder="Order #, Customer..."
                className="w-full px-3 py-2 rounded-lg bg-[#0B0B0B] border border-[#242424] text-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Order Status</label>
              <select
                value={filters.orderStatus}
                onChange={(e) => handleFilterChange('orderStatus', e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0B0B0B] border border-[#242424] text-white focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Payment Status</label>
              <select
                value={filters.paymentStatus}
                onChange={(e) => handleFilterChange('paymentStatus', e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0B0B0B] border border-[#242424] text-white focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">All Payments</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="failed">Failed</option>
                <option value="cod_pending">COD Pending</option>
                <option value="cod_collected">COD Collected</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0B0B0B] border border-[#242424] text-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0B0B0B] border border-[#242424] text-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Orders Table */}
      <Card className="bg-surface border-border">
        <CardHeader>
          <CardTitle className="text-white">
            Orders ({pagination.total})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-text-secondary mb-4">No orders found</p>
              <Button variant="secondary" onClick={fetchOrders}>
                Refresh
              </Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#242424]">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-white">Order #</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-white">Customer</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-white">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-white">Payment</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-white">Items</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-white">Total</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-white">Date</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-white">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order._id} className="border-b border-[#242424] hover:bg-[#1A1A1A] transition-colors">
                        <td className="py-3 px-4">
                          <div className="text-white font-medium">
                            {order.orderNumber || order.orderId}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-white">{order.customerName || 'Guest'}</div>
                          {order.customerEmail && (
                            <div className="text-text-secondary text-sm">{order.customerEmail}</div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className={cn('px-2 py-1 rounded text-xs font-semibold', getStatusColor(order.orderStatus))}>
                            {order.orderStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {order.paymentStatus && (
                            <span className={cn('px-2 py-1 rounded text-xs font-semibold', getPaymentStatusColor(order.paymentStatus))}>
                              {order.paymentStatus.replace('_', ' ')}
                            </span>
                          )}
                          {order.paymentMethod && (
                            <div className="text-text-secondary text-xs mt-1">{order.paymentMethod}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-text-secondary">{order.itemsCount}</td>
                        <td className="py-3 px-4 text-white font-medium">{formatCurrency(order.grandTotal)}</td>
                        <td className="py-3 px-4 text-text-secondary text-sm">{formatDate(order.createdAt)}</td>
                        <td className="py-3 px-4">
                          <div className="flex justify-end">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => router.push(`/reseller/orders/${order.orderId}`)}
                            >
                              View
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <div className="text-text-secondary text-sm">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} orders
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                      disabled={pagination.page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                      disabled={pagination.page >= pagination.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
