'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { aovAnalyticsAPI } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface SummaryData {
  summary: {
    grossAOV: number;
    netAOV: number;
    onlineAOV: number;
    codAOV: number;
    stripeAOV: number;
    paypalAOV: number;
    supplierAOV: number | null;
    refundImpact: number;
    totalOrders: number;
    totalGrossRevenue: number;
    totalNetRevenue: number;
    totalRefunds: number;
  };
  comparison: {
    grossAOV: { current: number; previous: number; change: number; changePercent: number };
    netAOV: { current: number; previous: number; change: number; changePercent: number };
    refundImpact: { current: number; previous: number; change: number };
  };
  dateRange: { start: string; end: string };
  previousDateRange: { start: string; end: string };
}

interface TimeseriesData {
  date: string;
  grossAOV: number;
  netAOV: number;
  onlineAOV: number;
  codAOV: number;
  stripeAOV: number;
  paypalAOV: number;
  supplierAOV: number | null;
  ordersCount: number;
  grossRevenue: number;
  netRevenue: number;
  refunds: number;
}

interface BreakdownData {
  breakdown: {
    stripe?: { ordersCount: number; revenue: number; aov: number };
    paypal?: { ordersCount: number; revenue: number; aov: number };
    cod?: { ordersCount: number; revenue: number; aov: number };
  };
  breakdownBy: string;
  dateRange: { start: string; end: string };
}

export default function AOVReportsPage() {
  const router = useRouter();
  const user = getCurrentUser();

  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesData[]>([]);
  const [breakdown, setBreakdown] = useState<BreakdownData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [userStores, setUserStores] = useState<any[]>([]);

  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  const [granularity, setGranularity] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    loadStores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, router]);

  useEffect(() => {
    if (selectedStoreId) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStoreId, dateRange, granularity]);

  const loadStores = async () => {
    try {
      const { storeAPI } = await import('@/lib/api');
      const resp = await storeAPI.getByOwner(user!.id);
      const stores = resp?.data || [];
      setUserStores(Array.isArray(stores) ? stores : []);

      // Auto-select first store or use stored selection
      if (stores.length > 0) {
        const storedStoreId = localStorage.getItem('storeId');
        const firstStoreId = stores[0]._id || stores[0].id;
        const storeIdToUse = storedStoreId && stores.some((s: any) => (s._id || s.id) === storedStoreId)
          ? storedStoreId
          : firstStoreId;
        setSelectedStoreId(storeIdToUse);
        localStorage.setItem('storeId', storeIdToUse);
      } else {
        setError('No stores found. Please create a store first.');
        setLoading(false);
      }
    } catch (err: any) {
      console.error('[AOV REPORTS] Load stores error:', err);
      setError('Failed to load stores');
      setLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [summaryResponse, timeseriesResponse, breakdownResponse] = await Promise.all([
        aovAnalyticsAPI.getSummary({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        }),
        aovAnalyticsAPI.getTimeseries({
          granularity,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        }),
        aovAnalyticsAPI.getBreakdown({
          breakdownBy: 'paymentMethod',
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        }),
      ]);

      if (summaryResponse.success) {
        setSummary(summaryResponse.data);
      }
      if (timeseriesResponse.success) {
        setTimeseries(timeseriesResponse.data.timeseries || []);
      }
      if (breakdownResponse.success) {
        setBreakdown(breakdownResponse.data);
      }
    } catch (err: any) {
      console.error('[AOV REPORTS] Fetch error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load AOV reports');
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

  const formatChange = (change: number) => {
    const sign = change >= 0 ? '+' : '';
    const color = change >= 0 ? 'text-green-400' : 'text-red-400';
    return <span className={color}>{sign}{change.toFixed(1)}%</span>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading AOV reports...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Average Order Value (AOV) Reports</h1>
            <p className="text-text-secondary">Analyze order value trends and insights</p>
          </div>
          <div className="flex gap-4 flex-wrap">
            {userStores.length > 1 && (
              <select
                value={selectedStoreId || ''}
                onChange={(e) => {
                  const storeId = e.target.value;
                  setSelectedStoreId(storeId);
                  localStorage.setItem('storeId', storeId);
                }}
                className="px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {userStores.map((store: any) => (
                  <option key={store._id || store.id} value={store._id || store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            )}
            <Input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="w-auto"
            />
            <Input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="w-auto"
            />
            <select
              value={granularity}
              onChange={(e) => setGranularity(e.target.value as 'daily' | 'weekly' | 'monthly')}
              className="px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>

        {/* KPI Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-surface border-border">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-text-secondary">Gross AOV</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white mb-1">
                  {formatCurrency(summary.summary.grossAOV)}
                </div>
                {summary.comparison.grossAOV && (
                  <div className="text-xs text-text-muted">
                    {formatChange(summary.comparison.grossAOV.changePercent)} vs previous period
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-surface border-border">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-text-secondary">Net AOV</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white mb-1">
                  {formatCurrency(summary.summary.netAOV)}
                </div>
                {summary.comparison.netAOV && (
                  <div className="text-xs text-text-muted">
                    {formatChange(summary.comparison.netAOV.changePercent)} vs previous period
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-surface border-border">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-text-secondary">Online AOV</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white mb-1">
                  {formatCurrency(summary.summary.onlineAOV)}
                </div>
                <div className="text-xs text-text-muted mt-1">
                  Stripe: {formatCurrency(summary.summary.stripeAOV)} | PayPal: {formatCurrency(summary.summary.paypalAOV)}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-surface border-border">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-text-secondary">COD AOV</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white mb-1">
                  {formatCurrency(summary.summary.codAOV)}
                </div>
                <div className="text-xs text-text-muted mt-1">
                  Cash on Delivery orders
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Additional Metrics */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-surface border-border">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-text-secondary">Total Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{summary.summary.totalOrders.toLocaleString()}</div>
              </CardContent>
            </Card>

            <Card className="bg-surface border-border">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-text-secondary">Gross Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{formatCurrency(summary.summary.totalGrossRevenue)}</div>
              </CardContent>
            </Card>

            <Card className="bg-surface border-border">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-text-secondary">Net Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{formatCurrency(summary.summary.totalNetRevenue)}</div>
                {summary.summary.totalRefunds > 0 && (
                  <div className="text-xs text-red-400 mt-1">
                    Refunds: {formatCurrency(summary.summary.totalRefunds)}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* AOV Trend Chart */}
        <Card className="bg-surface border-border">
          <CardHeader>
            <CardTitle className="text-white">AOV Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {timeseries.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeseries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="date"
                      stroke="#9CA3AF"
                      tickFormatter={(value) => formatDate(value)}
                    />
                    <YAxis
                      stroke="#9CA3AF"
                      tickFormatter={(v) => formatCurrency(Number(v))}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                      formatter={(value: any) => formatCurrency(Number(value))}
                      labelFormatter={(label) => formatDate(label)}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="grossAOV"
                      stroke="#8884d8"
                      name="Gross AOV"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="netAOV"
                      stroke="#82ca9d"
                      name="Net AOV"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="onlineAOV"
                      stroke="#ffc658"
                      name="Online AOV"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="codAOV"
                      stroke="#ff7300"
                      name="COD AOV"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-12 text-text-secondary">No trend data available</div>
            )}
          </CardContent>
        </Card>

        {/* AOV by Payment Method */}
        {breakdown && breakdown.breakdown && (
          <Card className="bg-surface border-border">
            <CardHeader>
              <CardTitle className="text-white">AOV by Payment Method</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                {breakdown.breakdown.stripe && (
                  <div className="text-center p-4 bg-muted/20 rounded-lg">
                    <div className="text-sm text-text-secondary mb-1">Stripe</div>
                    <div className="text-2xl font-bold text-white mb-1">
                      {formatCurrency(breakdown.breakdown.stripe.aov)}
                    </div>
                    <div className="text-xs text-text-muted">
                      {breakdown.breakdown.stripe.ordersCount} orders
                    </div>
                  </div>
                )}
                {breakdown.breakdown.paypal && (
                  <div className="text-center p-4 bg-muted/20 rounded-lg">
                    <div className="text-sm text-text-secondary mb-1">PayPal</div>
                    <div className="text-2xl font-bold text-white mb-1">
                      {formatCurrency(breakdown.breakdown.paypal.aov)}
                    </div>
                    <div className="text-xs text-text-muted">
                      {breakdown.breakdown.paypal.ordersCount} orders
                    </div>
                  </div>
                )}
                {breakdown.breakdown.cod && (
                  <div className="text-center p-4 bg-muted/20 rounded-lg">
                    <div className="text-sm text-text-secondary mb-1">COD</div>
                    <div className="text-2xl font-bold text-white mb-1">
                      {formatCurrency(breakdown.breakdown.cod.aov)}
                    </div>
                    <div className="text-xs text-text-muted">
                      {breakdown.breakdown.cod.ordersCount} orders
                    </div>
                  </div>
                )}
              </div>

              {breakdown.breakdown.stripe || breakdown.breakdown.paypal || breakdown.breakdown.cod ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        breakdown.breakdown.stripe
                          ? { name: 'Stripe', aov: breakdown.breakdown.stripe.aov }
                          : null,
                        breakdown.breakdown.paypal
                          ? { name: 'PayPal', aov: breakdown.breakdown.paypal.aov }
                          : null,
                        breakdown.breakdown.cod
                          ? { name: 'COD', aov: breakdown.breakdown.cod.aov }
                          : null,
                      ].filter(Boolean)}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="name" stroke="#9CA3AF" />
                      <YAxis
                        stroke="#9CA3AF"
                        tickFormatter={(v) => formatCurrency(Number(v))}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                        formatter={(value: any) => formatCurrency(Number(value))}
                      />
                      <Bar dataKey="aov" fill="#8884d8" radius={[6, 6, 0, 0]} name="AOV" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-center py-12 text-text-secondary">No payment method breakdown available</div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Export Button */}
        <div className="flex justify-end">
          <Button
            variant="primary"
            onClick={async () => {
              try {
                const blob = await aovAnalyticsAPI.exportData({
                  startDate: dateRange.startDate,
                  endDate: dateRange.endDate,
                });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `aov-reports-${dateRange.startDate}-${dateRange.endDate}.csv`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
              } catch (err: any) {
                console.error('[AOV REPORTS] Export error:', err);
                alert('Failed to export data');
              }
            }}
          >
            Export CSV
          </Button>
        </div>
      </div>
    </div>
  );
}

