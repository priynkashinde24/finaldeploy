'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { conversionDashboardAPI, conversionAnalyticsAPI } from '@/lib/api';
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

interface OverviewResponse {
  summary: {
    sessions: number;
    productViewSessions: number;
    addToCartSessions: number;
    checkoutSessions: number;
    paymentSuccessSessions: number;
    overallConversionRate: number;
  };
  funnel: Array<{
    step: string;
    count: number;
    dropOff: number;
    dropOffPercent: number;
    conversionRate: number;
  }>;
}

interface TrendResponse {
  interval: 'daily' | 'weekly' | 'monthly';
  data: Array<{ date: string; sessions: number; converted: number; conversionRate: number }>;
}

interface BreakdownResponse {
  groupBy: 'device' | 'source';
  rows: Array<{ key: string; sessions: number; converted: number; conversionRate: number }>;
}

interface ConversionSummaryResponse {
  summary: {
    pageViews: number;
    productViews: number;
    addToCart: number;
    cartView: number;
    checkoutStarted: number;
    paymentInitiated: number;
    ordersConfirmed: number;
    cartAbandoned: number;
    checkoutAbandoned: number;
    recoveryConverted: number;
  };
  rates: {
    addToCartRate: number;
    checkoutConversionRate: number;
    paymentSuccessRate: number;
    overallConversionRate: number;
    cartAbandonmentRate: number;
    checkoutAbandonmentRate: number;
  };
  comparison: {
    overallConversionRate: { current: number; previous: number; change: number };
    addToCartRate: { current: number; previous: number; change: number };
    checkoutConversionRate: { current: number; previous: number; change: number };
  };
  dateRange: {
    start: string;
    end: string;
    previousStart: string;
    previousEnd: string;
  };
}

interface ConversionTimeseriesResponse {
  metric: string;
  interval: 'day' | 'week' | 'month';
  data: Array<{ date: string; value: number }>;
  dateRange: { start: string; end: string };
}

const PIE_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

export default function ConversionAnalyticsPage() {
  const router = useRouter();
  const user = getCurrentUser();
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [trend, setTrend] = useState<TrendResponse | null>(null);
  const [breakdown, setBreakdown] = useState<BreakdownResponse | null>(null);
  const [summary, setSummary] = useState<ConversionSummaryResponse | null>(null);
  const [conversionTimeseries, setConversionTimeseries] = useState<ConversionTimeseriesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [interval, setInterval] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [groupBy, setGroupBy] = useState<'device' | 'source'>('device');
  const [device, setDevice] = useState<string>('');
  const [source, setSource] = useState<string>('');

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
  }, [dateRange, interval, groupBy, device, source, selectedStoreId]);

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

      const params = {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        device: device || undefined,
        source: source || undefined,
      };

      const [overviewRes, trendRes, breakdownRes, summaryRes, timeseriesRes] = await Promise.all([
        conversionDashboardAPI.getOverview(params),
        conversionDashboardAPI.getTrend({ ...params, interval }),
        conversionDashboardAPI.getBreakdown({ ...params, groupBy }),
        conversionAnalyticsAPI.getSummary({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        }),
        conversionAnalyticsAPI.getTimeseries({
          metric: 'overallConversionRate',
          interval: interval === 'daily' ? 'day' : interval === 'weekly' ? 'week' : 'month',
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        }),
      ]);

      if (overviewRes?.success) setOverview(overviewRes.data);
      if (trendRes?.success) setTrend(trendRes.data);
      if (breakdownRes?.success) setBreakdown(breakdownRes.data);
      if (summaryRes?.success) setSummary(summaryRes.data);
      if (timeseriesRes?.success) setConversionTimeseries(timeseriesRes.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load conversion analytics');
    } finally {
      setLoading(false);
    }
  };

  const formatPercent = (value: number) => `${value.toFixed(2)}%`;

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
      const blob = await conversionAnalyticsAPI.exportAnalytics({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        format: 'csv',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conversion-analytics-${dateRange.startDate}-${dateRange.endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.message || 'Failed to export analytics');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6 md:p-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-text-secondary">Loading conversion analytics...</p>
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
            <h1 className="text-3xl font-bold text-text-primary">Conversion Rate Analytics</h1>
            <p className="text-text-secondary mt-1">Track conversion funnel performance and optimize your sales process</p>
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
            <select
              value={device}
              onChange={(e) => setDevice(e.target.value)}
              className="px-3 py-2 border border-border rounded-md bg-surface text-text-primary"
            >
              <option value="">All Devices</option>
              <option value="desktop">Desktop</option>
              <option value="mobile">Mobile</option>
              <option value="tablet">Tablet</option>
            </select>
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="Source filter"
              className="px-3 py-2 border border-border rounded-md bg-surface text-text-primary w-32"
            />
            <Button onClick={handleExport} variant="secondary">
              Export CSV
            </Button>
            <Link href="/dashboard">
              <Button variant="outline">Back to Dashboard</Button>
            </Link>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-surface border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-text-secondary">Overall Conversion Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-text-primary">
                {overview?.summary?.overallConversionRate
                  ? formatPercent(overview.summary.overallConversionRate)
                  : summary?.rates?.overallConversionRate
                  ? formatPercent(summary.rates.overallConversionRate)
                  : '0.00%'}
              </div>
              {summary?.comparison?.overallConversionRate && (
                <div className="text-sm text-text-muted mt-1">
                  {formatChange(summary.comparison.overallConversionRate.change)} vs previous period
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-surface border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-text-secondary">Total Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-text-primary">
                {overview?.summary?.sessions
                  ? overview.summary.sessions.toLocaleString()
                  : summary?.summary?.pageViews
                  ? summary.summary.pageViews.toLocaleString()
                  : '0'}
              </div>
              <div className="text-sm text-text-muted mt-1">Page views</div>
            </CardContent>
          </Card>

          <Card className="bg-surface border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-text-secondary">Add to Cart Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-text-primary">
                {summary?.rates?.addToCartRate ? formatPercent(summary.rates.addToCartRate) : '0.00%'}
              </div>
              {summary?.comparison?.addToCartRate && (
                <div className="text-sm text-text-muted mt-1">
                  {formatChange(summary.comparison.addToCartRate.change)} vs previous
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-surface border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-text-secondary">Checkout Conversion</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-text-primary">
                {summary?.rates?.checkoutConversionRate
                  ? formatPercent(summary.rates.checkoutConversionRate)
                  : '0.00%'}
              </div>
              {summary?.comparison?.checkoutConversionRate && (
                <div className="text-sm text-text-muted mt-1">
                  {formatChange(summary.comparison.checkoutConversionRate.change)} vs previous
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Additional Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-surface border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-text-secondary">Product Views</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold text-text-primary">
                {summary?.summary?.productViews
                  ? formatNumber(summary.summary.productViews)
                  : overview?.summary?.productViewSessions
                  ? formatNumber(overview.summary.productViewSessions)
                  : '0'}
              </div>
              <div className="text-sm text-text-muted mt-1">Total product views</div>
            </CardContent>
          </Card>

          <Card className="bg-surface border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-text-secondary">Add to Cart</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold text-text-primary">
                {summary?.summary?.addToCart
                  ? formatNumber(summary.summary.addToCart)
                  : overview?.summary?.addToCartSessions
                  ? formatNumber(overview.summary.addToCartSessions)
                  : '0'}
              </div>
              <div className="text-sm text-text-muted mt-1">Cart additions</div>
            </CardContent>
          </Card>

          <Card className="bg-surface border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-text-secondary">Cart Abandonment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold text-text-primary">
                {summary?.rates?.cartAbandonmentRate ? formatPercent(summary.rates.cartAbandonmentRate) : '0.00%'}
              </div>
              <div className="text-sm text-text-muted mt-1">
                {summary?.summary?.cartAbandoned ? `${formatNumber(summary.summary.cartAbandoned)} abandoned` : '0 abandoned'}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-surface border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-text-secondary">Recovery Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold text-text-primary">
                {summary?.summary?.cartAbandoned && summary.summary.cartAbandoned > 0
                  ? formatPercent((summary.summary.recoveryConverted || 0) / summary.summary.cartAbandoned * 100)
                  : '0.00%'}
              </div>
              <div className="text-sm text-text-muted mt-1">
                {summary?.summary?.recoveryConverted
                  ? `${formatNumber(summary.summary.recoveryConverted)} recovered`
                  : '0 recovered'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 1: Conversion Trend & Funnel */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard
            title="Conversion Rate Trend"
            right={
              <select
                value={interval}
                onChange={(e) => setInterval(e.target.value as any)}
                className="px-2 py-1 text-sm border border-border rounded bg-surface text-text-primary"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            }
          >
            {trend?.data?.length || conversionTimeseries?.data?.length ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend?.data || conversionTimeseries?.data || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                      minTickGap={24}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                      tickFormatter={(v) => `${Number(v).toFixed(1)}%`}
                    />
                    <Tooltip
                      formatter={(value: any) => `${Number(value).toFixed(2)}%`}
                      labelFormatter={(label) => `Date: ${label}`}
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }}
                    />
                    <Line
                      type="monotone"
                      dataKey={trend?.data ? 'conversionRate' : 'value'}
                      stroke="#2563eb"
                      strokeWidth={2}
                      dot={false}
                      name="Conversion Rate"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-text-muted">
                No conversion trend data available
              </div>
            )}
          </ChartCard>

          <ChartCard title="Conversion Funnel">
            {overview?.funnel?.length ? (
              <div className="space-y-4">
                {overview.funnel.map((step, index) => (
                  <div key={step.step} className="border-l-4 border-blue-500 pl-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <span className="text-sm font-semibold text-text-primary">{step.step}</span>
                        <span className="text-lg font-bold text-text-primary">{formatNumber(step.count)}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-text-secondary">
                          {formatPercent(step.conversionRate)} conversion
                        </div>
                        {step.dropOff > 0 && (
                          <div className="text-xs text-red-600">
                            {formatNumber(step.dropOff)} dropped ({formatPercent(step.dropOffPercent)})
                          </div>
                        )}
                      </div>
                    </div>
                    {index < overview.funnel.length - 1 && (
                      <div className="ml-4 text-text-muted text-sm">↓</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-text-muted">
                No funnel data available
              </div>
            )}
          </ChartCard>
        </div>

        {/* Charts Row 2: Breakdown by Device/Source */}
        <ChartCard
          title="Conversion Breakdown"
          right={
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as any)}
              className="px-2 py-1 text-sm border border-border rounded bg-surface text-text-primary"
            >
              <option value="device">By Device</option>
              <option value="source">By Source</option>
            </select>
          }
        >
          {breakdown?.rows?.length ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={breakdown.rows.slice(0, 8).map((r) => ({
                        name: r.key,
                        value: r.conversionRate,
                      }))}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={(entry) => `${entry.name}: ${formatPercent(entry.value)}`}
                    >
                      {breakdown.rows.slice(0, 8).map((_, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => formatPercent(Number(v))} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-text-secondary border-b border-border">
                      <th className="py-2 pr-4">{breakdown.groupBy === 'device' ? 'Device' : 'Source'}</th>
                      <th className="py-2 pr-4">Sessions</th>
                      <th className="py-2 pr-4">Converted</th>
                      <th className="py-2 pr-4">Conv. Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.rows.map((r) => (
                      <tr key={r.key} className="border-b border-border last:border-b-0">
                        <td className="py-2 pr-4 font-medium text-text-primary">{r.key || 'Unknown'}</td>
                        <td className="py-2 pr-4 text-text-secondary">{r.sessions.toLocaleString()}</td>
                        <td className="py-2 pr-4 text-text-secondary">{r.converted.toLocaleString()}</td>
                        <td className="py-2 pr-4 font-semibold text-text-primary">{formatPercent(r.conversionRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-text-muted">
              No breakdown data available
            </div>
          )}
        </ChartCard>

        {/* Detailed Metrics */}
        {summary && summary.summary && summary.rates && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard title="Funnel Metrics">
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-surface rounded">
                  <span className="text-text-secondary">Page Views</span>
                  <span className="font-bold text-text-primary">{formatNumber(summary.summary.pageViews || 0)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-surface rounded">
                  <span className="text-text-secondary">Product Views</span>
                  <span className="font-bold text-text-primary">{formatNumber(summary.summary.productViews || 0)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-surface rounded">
                  <span className="text-text-secondary">Add to Cart</span>
                  <span className="font-bold text-text-primary">{formatNumber(summary.summary.addToCart || 0)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-surface rounded">
                  <span className="text-text-secondary">Checkout Started</span>
                  <span className="font-bold text-text-primary">{formatNumber(summary.summary.checkoutStarted || 0)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-surface rounded">
                  <span className="text-text-secondary">Payment Initiated</span>
                  <span className="font-bold text-text-primary">{formatNumber(summary.summary.paymentInitiated || 0)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-surface rounded">
                  <span className="text-text-secondary">Orders Confirmed</span>
                  <span className="font-bold text-text-primary">{formatNumber(summary.summary.ordersConfirmed || 0)}</span>
                </div>
              </div>
            </ChartCard>

            <ChartCard title="Abandonment & Recovery">
              <div className="space-y-4">
                <div className="p-4 bg-surface rounded">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-text-secondary">Cart Abandonment Rate</span>
                    <span className="font-bold text-text-primary">
                      {formatPercent(summary.rates.cartAbandonmentRate || 0)}
                    </span>
                  </div>
                  <div className="text-sm text-text-muted">
                    {formatNumber(summary.summary.cartAbandoned || 0)} carts abandoned
                  </div>
                </div>
                <div className="p-4 bg-surface rounded">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-text-secondary">Checkout Abandonment Rate</span>
                    <span className="font-bold text-text-primary">
                      {formatPercent(summary.rates.checkoutAbandonmentRate || 0)}
                    </span>
                  </div>
                  <div className="text-sm text-text-muted">
                    {formatNumber(summary.summary.checkoutAbandoned || 0)} checkouts abandoned
                  </div>
                </div>
                <div className="p-4 bg-surface rounded">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-text-secondary">Recovery Rate</span>
                    <span className="font-bold text-text-primary">
                      {summary.summary.cartAbandoned && summary.summary.cartAbandoned > 0
                        ? formatPercent(((summary.summary.recoveryConverted || 0) / summary.summary.cartAbandoned) * 100)
                        : '0.00%'}
                    </span>
                  </div>
                  <div className="text-sm text-text-muted">
                    {formatNumber(summary.summary.recoveryConverted || 0)} carts recovered
                  </div>
                </div>
              </div>
            </ChartCard>
          </div>
        )}
      </div>
    </div>
  );
}

