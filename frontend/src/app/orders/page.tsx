'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

interface Order {
  id: string;
  orderId: string;
  orderNumber?: string;
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

export default function CustomerOrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = getCurrentUser();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [orderStatusFilter, setOrderStatusFilter] = useState(searchParams.get('orderStatus') || '');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState(searchParams.get('paymentStatus') || '');
  const [startDate, setStartDate] = useState(searchParams.get('startDate') || '');
  const [endDate, setEndDate] = useState(searchParams.get('endDate') || '');

  // Pagination
  const [currentPage, setCurrentPage] = useState(Number(searchParams.get('page')) || 1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const limit = 20;

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, router, currentPage, orderStatusFilter, paymentStatusFilter, startDate, endDate]);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('page', currentPage.toString());
      params.append('limit', limit.toString());
      if (orderStatusFilter) params.append('orderStatus', orderStatusFilter);
      if (paymentStatusFilter) params.append('paymentStatus', paymentStatusFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await api.get(`/customer/orders?${params.toString()}`);
      const data: OrdersResponse = response.data;

      if (data.success && data.data) {
        setOrders(data.data.orders);
        setTotalPages(data.data.pagination.totalPages);
        setTotalOrders(data.data.pagination.total);
      } else {
        setError(data.message || 'Failed to fetch orders');
      }
    } catch (err: any) {
      console.error('[CUSTOMER ORDERS] Fetch error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = () => {
    setCurrentPage(1);
    const newParams = new URLSearchParams();
    if (orderStatusFilter) newParams.set('orderStatus', orderStatusFilter);
    if (paymentStatusFilter) newParams.set('paymentStatus', paymentStatusFilter);
    if (startDate) newParams.set('startDate', startDate);
    if (endDate) newParams.set('endDate', endDate);
    newParams.set('page', '1');
    router.push(`/orders?${newParams.toString()}`);
  };

  const getStatusBadgeClass = (status: string, type: 'order' | 'payment') => {
    if (type === 'order') {
      switch (status) {
        case 'delivered':
          return 'bg-green-500/20 text-green-400';
        case 'shipped':
        case 'processing':
        case 'confirmed':
          return 'bg-blue-500/20 text-blue-400';
        case 'cancelled':
        case 'refunded':
          return 'bg-red-500/20 text-red-400';
        default:
          return 'bg-gray-500/20 text-gray-400';
      }
    } else {
      switch (status) {
        case 'paid':
        case 'cod_collected':
          return 'bg-green-500/20 text-green-400';
        case 'pending':
        case 'cod_pending':
        case 'cod_partial_paid':
          return 'bg-yellow-500/20 text-yellow-400';
        case 'failed':
        case 'cod_failed':
          return 'bg-red-500/20 text-red-400';
        default:
          return 'bg-gray-500/20 text-gray-400';
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading orders...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">My Orders</h1>
          <p className="text-text-secondary">View and track your orders ({totalOrders})</p>
        </div>

        {/* Filters */}
        <Card className="bg-surface border-border">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <select
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">All Order Statuses</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
                <option value="refunded">Refunded</option>
              </select>
              <select
                value={paymentStatusFilter}
                onChange={(e) => setPaymentStatusFilter(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">All Payment Statuses</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="failed">Failed</option>
                <option value="cod_pending">COD Pending</option>
                <option value="cod_collected">COD Collected</option>
                <option value="cod_failed">COD Failed</option>
              </select>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="Start Date"
              />
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="End Date"
              />
              <Button onClick={handleFilterChange} className="col-span-full">Apply Filters</Button>
            </div>
          </CardContent>
        </Card>

        {/* Orders Table */}
        <Card className="bg-surface border-border">
          <CardHeader>
            <CardTitle>Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <div className="text-center py-12 text-text-secondary">No orders found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary">Order #</th>
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary">Total</th>
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary">Items</th>
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary">Order Status</th>
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary">Payment Status</th>
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary">Date</th>
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id} className="border-b border-border hover:bg-muted/20">
                        <td className="py-3 px-4 text-text-primary font-medium">
                          {order.orderNumber || order.orderId}
                        </td>
                        <td className="py-3 px-4 text-text-primary">{formatCurrency(order.grandTotal)}</td>
                        <td className="py-3 px-4 text-text-secondary">{order.itemsCount}</td>
                        <td className="py-3 px-4">
                          <span
                            className={cn(
                              'px-2 py-1 rounded-full text-xs font-semibold',
                              getStatusBadgeClass(order.orderStatus, 'order')
                            )}
                          >
                            {order.orderStatus.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {order.paymentStatus && (
                            <span
                              className={cn(
                                'px-2 py-1 rounded-full text-xs font-semibold',
                                getStatusBadgeClass(order.paymentStatus, 'payment')
                              )}
                            >
                              {order.paymentStatus.replace(/_/g, ' ')}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-text-secondary">{formatDate(order.createdAt)}</td>
                        <td className="py-3 px-4 text-right">
                          <Link href={`/orders/${order.id}`}>
                            <Button variant="secondary" size="sm">
                              View
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-6">
            <Button
              variant="outline"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="text-text-secondary">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
