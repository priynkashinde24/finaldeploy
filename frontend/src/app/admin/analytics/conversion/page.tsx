'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { conversionDashboardAPI } from '@/lib/api';
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface FunnelStep {
  step: string;
  count: number;
  dropOff: number;
  dropOffPercent: number;
  conversionRate: number;
}

interface OverviewResponse {
  summary: {
    sessions: number;
    productViewSessions: number;
    addToCartSessions: number;
    checkoutSessions: number;
    paymentSuccessSessions: number;
    overallConversionRate: number;
  };
  funnel: FunnelStep[];
}

interface TrendResponse {
  interval: 'daily' | 'weekly' | 'monthly';
  data: Array<{ date: string; sessions: number; converted: number; conversionRate: number }>;
}

interface BreakdownResponse {
  groupBy: 'device' | 'source';
  rows: Array<{ key: string; sessions: number; converted: number; conversionRate: number }>;
}

const PIE_COLORS = ['#2563eb', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

export default function AdminConversionPage() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [trend, setTrend] = useState<TrendResponse | null>(null);
  const [breakdown, setBreakdown] = useState<BreakdownResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [interval, setInterval] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [device, setDevice] = useState<string>('');
  const [source, setSource] = useState<string>('');
  const [groupBy, setGroupBy] = useState<'device' | 'source'>('device');

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, interval, device, source, groupBy]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        device: device || undefined,
        source: source || undefined,
      };

      const [overviewRes, trendRes, breakdownRes] = await Promise.all([
        conversionDashboardAPI.getOverview(params),
        conversionDashboardAPI.getTrend({ ...params, interval }),
        conversionDashboardAPI.getBreakdown({ ...params, groupBy }),
      ]);

      if (overviewRes.success) setOverview(overviewRes.data);
      if (trendRes.success) setTrend(trendRes.data);
      if (breakdownRes.success) setBreakdown(breakdownRes.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load conversion analytics');
    } finally {
      setLoading(false);
    }
  };

  const formatCompactNumber = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  };

  const formatPercent = (value: number) => `${value.toFixed(2)}%`;

  const formatChange = (change: number) => {
    const sign = change >= 0 ? '+' : '';
    const color = change >= 0 ? 'text-green-600' : 'text-red-600';
    return <span className={color}>{sign}{change.toFixed(1)}%</span>;
  };

  // Snapshot-based timeseries selectors were removed in favor of session-based trend.

  const handleExport = async () => {
    try {
      // Export is still available from snapshot-based export endpoint
      const { conversionAnalyticsAPI } = await import('@/lib/api');
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
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading conversion analytics...</div>
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
        <h1 className="text-3xl font-bold">Conversion Analytics</h1>
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
          <select value={interval} onChange={(e) => setInterval(e.target.value as any)} className="px-3 py-2 border rounded">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <select value={device} onChange={(e) => setDevice(e.target.value)} className="px-3 py-2 border rounded">
            <option value="">All devices</option>
            <option value="desktop">Desktop</option>
            <option value="mobile">Mobile</option>
            <option value="tablet">Tablet</option>
            <option value="unknown">Unknown</option>
          </select>
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Source (utm/referrer)"
            className="px-3 py-2 border rounded w-44"
          />
          <Button onClick={handleExport}>Export CSV</Button>
        </div>
      </div>

      {overview && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-gray-500">Overall Conversion Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overview.summary.overallConversionRate.toFixed(2)}%</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-gray-500">Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overview.summary.sessions.toLocaleString()}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-gray-500">Checkout Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overview.summary.checkoutSessions.toLocaleString()}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-gray-500">Payment Success Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overview.summary.paymentSuccessSessions.toLocaleString()}</div>
              </CardContent>
            </Card>
          </div>

          {/* Conversion Trend */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Conversion rate trend</CardTitle>
            </CardHeader>
            <CardContent>
              {trend?.data?.length ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trend.data}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} minTickGap={24} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${Number(v).toFixed(0)}%`} />
                      <Tooltip
                        formatter={(value: any) => `${Number(value).toFixed(2)}%`}
                        labelFormatter={(label) => `Date: ${label}`}
                      />
                      <Line type="monotone" dataKey="conversionRate" stroke="#2563eb" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-gray-500">
                  No timeseries data for this range.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Funnel Visualization */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Conversion Funnel</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {overview.funnel.map((step, index) => (
                  <div key={step.step} className="border-l-4 border-blue-500 pl-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <span className="text-lg font-semibold">{step.step}</span>
                        <span className="text-2xl font-bold">{step.count.toLocaleString()}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-600">
                          {step.conversionRate.toFixed(2)}% conversion
                        </div>
                        {step.dropOff > 0 && (
                          <div className="text-sm text-red-600">
                            {step.dropOff.toLocaleString()} dropped ({step.dropOffPercent.toFixed(1)}%)
                          </div>
                        )}
                      </div>
                    </div>
                    {index < overview.funnel.length - 1 && (
                      <div className="ml-4 text-gray-400">↓</div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Breakdown */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Breakdown</CardTitle>
                <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as any)} className="px-3 py-2 border rounded">
                  <option value="device">By device</option>
                  <option value="source">By source</option>
                </select>
              </div>
            </CardHeader>
            <CardContent>
              {breakdown?.rows?.length ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={breakdown.rows.slice(0, 8).map((r) => ({ name: r.key, value: r.sessions }))}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={45}
                          outerRadius={70}
                          paddingAngle={2}
                        >
                          {breakdown.rows.slice(0, 8).map((_, idx) => (
                            <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b">
                          <th className="py-2 pr-4">{breakdown.groupBy}</th>
                          <th className="py-2 pr-4">Sessions</th>
                          <th className="py-2 pr-4">Converted</th>
                          <th className="py-2 pr-4">Conv. Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {breakdown.rows.map((r) => (
                          <tr key={r.key} className="border-b last:border-b-0">
                            <td className="py-2 pr-4 font-medium">{r.key}</td>
                            <td className="py-2 pr-4">{r.sessions.toLocaleString()}</td>
                            <td className="py-2 pr-4">{r.converted.toLocaleString()}</td>
                            <td className="py-2 pr-4">{r.conversionRate.toFixed(2)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-gray-500">No breakdown data for this range.</div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

