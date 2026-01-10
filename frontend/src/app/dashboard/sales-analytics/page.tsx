'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { salesAnalyticsAPI } from '@/lib/api';
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
  Legend,
} from 'recharts';
import { ChartCard } from '@/components/charts/ChartCard';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { storeAPI } from '@/lib/api';

interface SummaryResponse {
  summary: {
    ordersCount: number;
    grossRevenue: number;
    netRevenue: number;
    taxCollected: number;
    shippingCollected: number;
    discounts: number;
    refunds: number;
    codAmount: number;
    supplierEarnings: number;
    resellerEarnings: number;
    platformEarnings: number;
    stripeRevenue: number;
    paypalRevenue: number;
    codRevenue: number;
  };
  comparison: {
    ordersCount: { current: number; previous: number; change: number };
    grossRevenue: { current: number; previous: number; change: number };
    netRevenue: { current: number; previous: number; change: number };
    refunds: { current: number; previous: number; change: number };
    earnings: { current: number; previous: number; change: number };
  };
  dateRange: {
    start: string;
    end: string;
    previousStart: string;
    previousEnd: string;
  };
}

interface TimeseriesResponse {
  metric: string;
  interval: 'day' | 'week' | 'month';
  data: Array<{ date: string; value: number }>;
  dateRange: { start: string; end: string };
}

interface TopProductsResponse {
  products: Array<{
    productId: string;
    productName: string;
    sku?: string;
    quantity: number;
    revenue: number;
  }>;
  dateRange: { start: string; end: string };
}

interface ReturnsResponse {
  returns: {
    totalReturns: number;
    totalRefundAmount: number;
    averageRefundAmount: number;
    returnRate: number;
    byStatus: Array<{ status: string; count: number; amount: number }>;
  };
  dateRange: { start: string; end: string };
}

const PIE_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

export default function SalesAnalyticsPage() {
  const router = useRouter();
  const user = getCurrentUser();
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [revenueTimeseries, setRevenueTimeseries] = useState<TimeseriesResponse | null>(null);
  const [ordersTimeseries, setOrdersTimeseries] = useState<TimeseriesResponse | null>(null);
  const [topProducts, setTopProducts] = useState<TopProductsResponse | null>(null);
  const [returns, setReturns] = useState<ReturnsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [timeseriesInterval, setTimeseriesInterval] = useState<'day' | 'week' | 'month'>('day');
  const [selectedMetric, setSelectedMetric] = useState<'netRevenue' | 'ordersCount'>('netRevenue');

  // Load stores and set default store
  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    const loadStores = async () => {
      try {
        const resp = await storeAPI.getByOwner(user.id);
        const storeList = resp?.data || [];
        const storesArray = Array.isArray(storeList) ? storeList : [];
        setStores(storesArray);

        // If no stores, show error
        if (storesArray.length === 0) {
          setError('No stores found. Please create a store first.');
          setLoading(false);
          return;
        }

        // Check if storeId is in localStorage
        const storedStoreId = localStorage.getItem('storeId');
        
        // If stored storeId exists and is in the list, use it
        if (storedStoreId && storesArray.some((s: any) => (s._id || s.id) === storedStoreId)) {
          setSelectedStoreId(storedStoreId);
        } else {
          // Otherwise, use the first store
          const firstStoreId = storesArray[0]?._id || storesArray[0]?.id;
          if (firstStoreId) {
            setSelectedStoreId(firstStoreId);
            localStorage.setItem('storeId', firstStoreId);
          }
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load stores');
        setLoading(false);
      }
    };

    loadStores();
  }, [user, router]);

  // Fetch data when store is selected
  useEffect(() => {
    if (!user || !selectedStoreId) {
      return;
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, timeseriesInterval, selectedMetric, selectedStoreId]);

  const handleStoreChange = (storeId: string) => {
    setSelectedStoreId(storeId);
    localStorage.setItem('storeId', storeId);
  };

  const fetchData = async () => {
    if (!selectedStoreId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [summaryRes, revenueTsRes, ordersTsRes, topProductsRes, returnsRes] = await Promise.all([
        salesAnalyticsAPI.getSummary({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        }),
        salesAnalyticsAPI.getTimeseries({
          metric: 'netRevenue',
          interval: timeseriesInterval,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        }),
        salesAnalyticsAPI.getTimeseries({
          metric: 'ordersCount',
          interval: timeseriesInterval,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        }),
        salesAnalyticsAPI.getTopProducts({
          limit: 10,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        }),
        salesAnalyticsAPI.getReturns({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        }),
      ]);

      if (summaryRes?.success) setSummary(summaryRes.data);
      if (revenueTsRes?.success) setRevenueTimeseries(revenueTsRes.data);
      if (ordersTsRes?.success) setOrdersTimeseries(ordersTsRes.data);
      if (topProductsRes?.success) setTopProducts(topProductsRes.data);
      if (returnsRes?.success) setReturns(returnsRes.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load sales analytics');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
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
      const blob = await salesAnalyticsAPI.exportAnalytics({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        format: 'csv',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sales-analytics-${dateRange.startDate}-${dateRange.endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.message || 'Failed to export analytics');
    }
  };

  // Determine earnings based on user role
  const getEarnings = () => {
    if (!summary) return { current: 0, previous: 0, change: 0 };
    if (user?.role === 'supplier') {
      return summary.comparison.earnings;
    } else if (user?.role === 'reseller') {
      return summary.comparison.earnings;
    } else {
      // Admin sees platform earnings
      return summary.comparison.earnings;
    }
  };

  const earnings = getEarnings();

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6 md:p-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-text-secondary">Loading sales analytics...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-6 md:p-10">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">Error: {error}</p>
            {stores.length === 0 ? (
              <div className="mt-4">
                <Link href="/create-store">
                  <Button variant="primary">Create Store</Button>
                </Link>
              </div>
            ) : (
              <Button onClick={fetchData} className="mt-4" variant="secondary">
                Retry
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!selectedStoreId) {
    return (
      <div className="min-h-screen bg-background p-6 md:p-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-text-secondary">Loading store information...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-text-primary">Sales Analytics</h1>
            <p className="text-text-secondary mt-1">Comprehensive sales insights and performance metrics</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {stores.length > 1 && (
              <select
                value={selectedStoreId || ''}
                onChange={(e) => handleStoreChange(e.target.value)}
                className="px-3 py-2 border border-border rounded-md bg-surface text-text-primary"
              >
                {stores.map((store: any) => (
                  <option key={store._id || store.id} value={store._id || store.id}>
                    {store.name || store.storeName || 'Unnamed Store'}
                  </option>
                ))}
              </select>
            )}
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="px-3 py-2 border border-border rounded-md bg-surface text-text-primary"
            />
            <span className="text-text-secondary">to</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="px-3 py-2 border border-border rounded-md bg-surface text-text-primary"
            />
            <Button onClick={handleExport} variant="secondary">
              Export CSV
            </Button>
            <Link href="/dashboard">
              <Button variant="outline">Back to Dashboard</Button>
            </Link>
          </div>
        </div>

        {summary && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-surface border-border">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-text-secondary">Net Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-text-primary">
                    {formatCurrency(summary.summary.netRevenue)}
                  </div>
                  <div className="text-sm text-text-muted mt-1">
                    {formatChange(summary.comparison.netRevenue.change)} vs previous period
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-surface border-border">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-text-secondary">Total Orders</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-text-primary">
                    {summary.summary.ordersCount.toLocaleString()}
                  </div>
                  <div className="text-sm text-text-muted mt-1">
                    {formatChange(summary.comparison.ordersCount.change)} vs previous period
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-surface border-border">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-text-secondary">Average Order Value</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-text-primary">
                    {summary.summary.ordersCount > 0
                      ? formatCurrency(summary.summary.netRevenue / summary.summary.ordersCount)
                      : formatCurrency(0)}
                  </div>
                  <div className="text-sm text-text-muted mt-1">Per order</div>
                </CardContent>
              </Card>

              <Card className="bg-surface border-border">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-text-secondary">
                    {user?.role === 'supplier'
                      ? 'Supplier Earnings'
                      : user?.role === 'reseller'
                      ? 'Reseller Earnings'
                      : 'Platform Earnings'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-text-primary">{formatCurrency(earnings.current)}</div>
                  <div className="text-sm text-text-muted mt-1">
                    {formatChange(earnings.change)} vs previous period
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Additional Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-surface border-border">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-text-secondary">Gross Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-semibold text-text-primary">
                    {formatCurrency(summary.summary.grossRevenue)}
                  </div>
                  <div className="text-sm text-text-muted mt-1">
                    {formatChange(summary.comparison.grossRevenue.change)} vs previous
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-surface border-border">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-text-secondary">Discounts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-semibold text-text-primary">
                    {formatCurrency(summary.summary.discounts)}
                  </div>
                  <div className="text-sm text-text-muted mt-1">
                    {summary.summary.grossRevenue > 0
                      ? `${((summary.summary.discounts / summary.summary.grossRevenue) * 100).toFixed(1)}% of gross`
                      : '0% of gross'}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-surface border-border">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-text-secondary">Refunds</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-semibold text-text-primary">
                    {formatCurrency(summary.summary.refunds)}
                  </div>
                  <div className="text-sm text-text-muted mt-1">
                    {formatChange(summary.comparison.refunds.change)} vs previous
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-surface border-border">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-text-secondary">Tax Collected</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-semibold text-text-primary">
                    {formatCurrency(summary.summary.taxCollected)}
                  </div>
                  <div className="text-sm text-text-muted mt-1">Total tax</div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row 1: Revenue & Orders Timeseries */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartCard
                title="Revenue Over Time"
                right={
                  <div className="flex items-center gap-2">
                    <select
                      value={timeseriesInterval}
                      onChange={(e) => setTimeseriesInterval(e.target.value as any)}
                      className="px-2 py-1 text-sm border border-border rounded bg-surface text-text-primary"
                    >
                      <option value="day">Daily</option>
                      <option value="week">Weekly</option>
                      <option value="month">Monthly</option>
                    </select>
                  </div>
                }
              >
                {revenueTimeseries?.data?.length ? (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={revenueTimeseries.data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 12, fill: '#6b7280' }}
                          minTickGap={24}
                        />
                        <YAxis
                          tick={{ fontSize: 12, fill: '#6b7280' }}
                          tickFormatter={(v) => formatCurrency(Number(v))}
                        />
                        <Tooltip
                          formatter={(value: any) => formatCurrency(Number(value))}
                          labelFormatter={(label) => `Date: ${label}`}
                          contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="#2563eb"
                          strokeWidth={2}
                          dot={false}
                          name="Revenue"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-48 flex items-center justify-center text-text-muted">
                    No revenue data available
                  </div>
                )}
              </ChartCard>

              <ChartCard title="Orders Over Time">
                {ordersTimeseries?.data?.length ? (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={ordersTimeseries.data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 12, fill: '#6b7280' }}
                          minTickGap={24}
                        />
                        <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
                        <Tooltip
                          formatter={(value: any) => formatNumber(Number(value))}
                          labelFormatter={(label) => `Date: ${label}`}
                          contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="#10b981"
                          strokeWidth={2}
                          dot={false}
                          name="Orders"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-48 flex items-center justify-center text-text-muted">
                    No orders data available
                  </div>
                )}
              </ChartCard>
            </div>

            {/* Charts Row 2: Top Products & Payment Methods */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartCard title="Top Products by Revenue">
                {topProducts?.products?.length ? (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topProducts.products.slice(0, 10)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="productName"
                          tick={{ fontSize: 11, fill: '#6b7280' }}
                          angle={-45}
                          textAnchor="end"
                          height={80}
                        />
                        <YAxis
                          tick={{ fontSize: 12, fill: '#6b7280' }}
                          tickFormatter={(v) => formatCurrency(Number(v))}
                        />
                        <Tooltip
                          formatter={(value: any) => formatCurrency(Number(value))}
                          contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }}
                        />
                        <Bar dataKey="revenue" fill="#2563eb" radius={[6, 6, 0, 0]} name="Revenue" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-48 flex items-center justify-center text-text-muted">
                    No product data available
                  </div>
                )}
              </ChartCard>

              <ChartCard title="Payment Method Breakdown">
                {summary.summary.stripeRevenue > 0 ||
                summary.summary.paypalRevenue > 0 ||
                summary.summary.codRevenue > 0 ? (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Stripe', value: summary.summary.stripeRevenue },
                            { name: 'PayPal', value: summary.summary.paypalRevenue },
                            { name: 'COD', value: summary.summary.codRevenue },
                          ].filter((item) => item.value > 0)}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={(entry) => `${entry.name}: ${formatCurrency(entry.value)}`}
                        >
                          {[
                            { name: 'Stripe', value: summary.summary.stripeRevenue },
                            { name: 'PayPal', value: summary.summary.paypalRevenue },
                            { name: 'COD', value: summary.summary.codRevenue },
                          ]
                            .filter((item) => item.value > 0)
                            .map((_, idx) => (
                              <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-48 flex items-center justify-center text-text-muted">
                    No payment data available
                  </div>
                )}
              </ChartCard>
            </div>

            {/* Returns Analytics */}
            {returns && returns.returns && (
              <ChartCard title="Returns & Refunds Analytics">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div>
                    <div className="text-sm text-text-secondary">Total Returns</div>
                    <div className="text-2xl font-bold text-text-primary">
                      {returns.returns.totalReturns || 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-text-secondary">Total Refund Amount</div>
                    <div className="text-2xl font-bold text-text-primary">
                      {formatCurrency(returns.returns.totalRefundAmount || 0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-text-secondary">Average Refund</div>
                    <div className="text-2xl font-bold text-text-primary">
                      {formatCurrency(returns.returns.averageRefundAmount || 0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-text-secondary">Return Rate</div>
                    <div className="text-2xl font-bold text-text-primary">
                      {(returns.returns.returnRate || 0).toFixed(2)}%
                    </div>
                  </div>
                </div>
                {returns.returns.byStatus && returns.returns.byStatus.length > 0 && (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={returns.returns.byStatus}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="status" tick={{ fontSize: 12, fill: '#6b7280' }} />
                        <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
                        <Tooltip
                          formatter={(value: any, name?: string) => {
                            if (name === 'amount') return formatCurrency(Number(value));
                            return formatNumber(Number(value));
                          }}
                          contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }}
                        />
                        <Legend />
                        <Bar dataKey="count" fill="#2563eb" name="Count" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="amount" fill="#10b981" name="Amount" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </ChartCard>
            )}
          </>
        )}
      </div>
    </div>
  );
}

