'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { analyticsDashboardAPI } from '@/lib/api';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartCard } from '@/components/charts/ChartCard';
import Link from 'next/link';

interface OverviewResponse {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  revenueGrowthPercent: number;
  dateRange: { start: string; end: string; previousStart: string; previousEnd: string };
}

interface RevenueResponse {
  range: 'daily' | 'weekly' | 'monthly';
  data: Array<{ date: string; revenue: number }>;
  dateRange: { start: string; end: string };
}

interface CategorySalesResponse {
  categories: Array<{ categoryId: string; categoryName: string; revenue: number; quantity: number }>;
  dateRange: { start: string; end: string };
}

interface OrderStatusResponse {
  statuses: Array<{ status: string; count: number }>;
  dateRange: { start: string; end: string };
}

interface OrdersResponse {
  items: Array<{
    orderId: string;
    orderNumber?: string;
    customerName?: string;
    customerEmail?: string;
    orderStatus: string;
    paymentStatus: string;
    paymentMethod?: string;
    grandTotal?: number;
    createdAt: string;
    itemsCount: number;
  }>;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const PIE_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function AdminAnalyticsPage() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [revenue, setRevenue] = useState<RevenueResponse | null>(null);
  const [categorySales, setCategorySales] = useState<CategorySalesResponse | null>(null);
  const [orderStatus, setOrderStatus] = useState<OrderStatusResponse | null>(null);
  const [orders, setOrders] = useState<OrdersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [revenueRange, setRevenueRange] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersLimit, setOrdersLimit] = useState(10);
  const [ordersSearch, setOrdersSearch] = useState('');
  const [ordersStatus, setOrdersStatus] = useState<string>('');

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, revenueRange, ordersPage, ordersLimit, ordersStatus]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [overviewRes, revenueRes, categoriesRes, statusRes, ordersRes] = await Promise.all([
        analyticsDashboardAPI.getOverview({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        }),
        analyticsDashboardAPI.getRevenue({
          range: revenueRange,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        }),
        analyticsDashboardAPI.getCategorySales({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        }),
        analyticsDashboardAPI.getOrderStatusDistribution({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        }),
        analyticsDashboardAPI.getOrders({
          page: ordersPage,
          limit: ordersLimit,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          orderStatus: ordersStatus || undefined,
          q: ordersSearch || undefined,
        }),
      ]);

      if (overviewRes?.success) setOverview(overviewRes.data);
      if (revenueRes?.success) setRevenue(revenueRes.data);
      if (categoriesRes?.success) setCategorySales(categoriesRes.data);
      if (statusRes?.success) setOrderStatus(statusRes.data);
      if (ordersRes?.success) setOrders(ordersRes.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  };

  const formatChange = (change: number) => {
    const sign = change >= 0 ? '+' : '';
    const color = change >= 0 ? 'text-green-600' : 'text-red-600';
    return <span className={color}>{sign}{change.toFixed(1)}%</span>;
  };

  const handleExport = async () => {
    try {
      // Export revenue timeseries via existing sales export endpoint for now (CSV).
      // This keeps exports consistent with SalesAnalyticsSnapshot.
      const { salesAnalyticsAPI } = await import('@/lib/api');
      const blob = await salesAnalyticsAPI.exportAnalytics({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        format: 'csv',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${dateRange.startDate}-${dateRange.endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.message || 'Failed to export analytics');
    }
  };

  const applySearch = () => {
    setOrdersPage(1);
    fetchData();
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Sales Dashboard</h1>
        <div className="flex items-center space-x-4">
          <input
            type="date"
            value={dateRange.startDate}
            onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
            className="px-3 py-2 border rounded"
          />
          <span>to</span>
          <input
            type="date"
            value={dateRange.endDate}
            onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
            className="px-3 py-2 border rounded"
          />
          <Button onClick={handleExport}>Export CSV</Button>
          <Link href="/admin/analytics/tally-export" className="inline-flex">
            <Button variant="outline">Tally Export</Button>
          </Link>
        </div>
      </div>

      {overview && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-gray-500">Total Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(overview.totalRevenue)}</div>
                <div className="text-sm text-gray-500 mt-1">{formatChange(overview.revenueGrowthPercent)} vs previous period</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-gray-500">Total Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overview.totalOrders.toLocaleString()}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-gray-500">Average Order Value</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(overview.averageOrderValue)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-gray-500">Revenue Growth</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overview.revenueGrowthPercent.toFixed(1)}%</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <ChartCard
              title="Revenue over time"
              className="lg:col-span-2"
              right={
                <select
                  value={revenueRange}
                  onChange={(e) => setRevenueRange(e.target.value as any)}
                  className="px-3 py-2 border rounded"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              }
            >
              {revenue?.data?.length ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={revenue.data}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} minTickGap={24} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatCurrency(Number(v))} />
                      <Tooltip
                        formatter={(value: any) => formatCurrency(Number(value))}
                        labelFormatter={(label) => `Date: ${label}`}
                      />
                      <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-gray-500">No revenue data.</div>
              )}
            </ChartCard>

            <ChartCard title="Order status distribution">
              {orderStatus?.statuses?.length ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={orderStatus.statuses}
                        dataKey="count"
                        nameKey="status"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={2}
                      >
                        {orderStatus.statuses.map((_, idx) => (
                          <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => formatNumber(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-gray-500">No status data.</div>
              )}
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <ChartCard title="Sales by product category">
              {categorySales?.categories?.length ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categorySales.categories}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="categoryName" tick={{ fontSize: 12 }} interval={0} angle={-15} height={60} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatCurrency(Number(v))} />
                      <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                      <Bar dataKey="revenue" fill="#2563eb" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-gray-500">No category sales data.</div>
              )}
            </ChartCard>

            <ChartCard title="Recent orders">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
                <div className="flex gap-2">
                  <input
                    value={ordersSearch}
                    onChange={(e) => setOrdersSearch(e.target.value)}
                    placeholder="Search order number / email / name"
                    className="px-3 py-2 border rounded w-full md:w-72"
                  />
                  <Button onClick={applySearch}>Search</Button>
                </div>
                <div className="flex gap-2">
                  <select
                    value={ordersStatus}
                    onChange={(e) => {
                      setOrdersPage(1);
                      setOrdersStatus(e.target.value);
                    }}
                    className="px-3 py-2 border rounded"
                  >
                    <option value="">All statuses</option>
                    <option value="pending">pending</option>
                    <option value="confirmed">confirmed</option>
                    <option value="processing">processing</option>
                    <option value="shipped">shipped</option>
                    <option value="delivered">delivered</option>
                    <option value="cancelled">cancelled</option>
                    <option value="refunded">refunded</option>
                  </select>
                  <select
                    value={ordersLimit}
                    onChange={(e) => {
                      setOrdersPage(1);
                      setOrdersLimit(Number(e.target.value));
                    }}
                    className="px-3 py-2 border rounded"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>

              {orders?.items?.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="py-2 pr-4">Order</th>
                        <th className="py-2 pr-4">Customer</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-4">Payment</th>
                        <th className="py-2 pr-4">Total</th>
                        <th className="py-2 pr-4">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.items.map((o) => (
                        <tr key={o.orderId} className="border-b last:border-b-0">
                          <td className="py-2 pr-4">
                            <div className="font-medium">{o.orderNumber || o.orderId}</div>
                            <div className="text-xs text-gray-500">{o.itemsCount} items</div>
                          </td>
                          <td className="py-2 pr-4">
                            <div className="font-medium">{o.customerName || '—'}</div>
                            <div className="text-xs text-gray-500">{o.customerEmail || '—'}</div>
                          </td>
                          <td className="py-2 pr-4">{o.orderStatus}</td>
                          <td className="py-2 pr-4">
                            <div>{o.paymentStatus}</div>
                            <div className="text-xs text-gray-500">{o.paymentMethod || '—'}</div>
                          </td>
                          <td className="py-2 pr-4 font-medium">{formatCurrency(o.grandTotal || 0)}</td>
                          <td className="py-2 pr-4 text-gray-600">
                            {new Date(o.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-gray-500">No orders found.</div>
              )}

              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-sm text-gray-500">
                  {orders ? (
                    <span>
                      Page {orders.page} of {orders.totalPages} • {orders.total.toLocaleString()} orders
                    </span>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setOrdersPage((p) => Math.max(1, p - 1))}
                    disabled={!orders || orders.page <= 1}
                  >
                    Prev
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setOrdersPage((p) => (orders ? Math.min(orders.totalPages, p + 1) : p + 1))}
                    disabled={!orders || orders.page >= orders.totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}

