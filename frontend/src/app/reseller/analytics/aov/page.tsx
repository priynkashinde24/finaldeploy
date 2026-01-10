'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { aovAnalyticsAPI } from '@/lib/api';
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

export default function ResellerAOVPage() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesData[]>([]);
  const [breakdown, setBreakdown] = useState<BreakdownData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    fetchData();
  }, [dateRange]);

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
        setTimeseries(timeseriesResponse.data.timeseries);
      }
      if (breakdownResponse.success) {
        setBreakdown(breakdownResponse.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load AOV analytics');
    } finally {
      setLoading(false);
    }
  };

  const formatChange = (change: number) => {
    const sign = change >= 0 ? '+' : '';
    const color = change >= 0 ? 'text-green-600' : 'text-red-600';
    return <span className={color}>{sign}{change.toFixed(1)}%</span>;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const handleExport = async () => {
    try {
      const blob = await aovAnalyticsAPI.exportData({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aov-analytics-${dateRange.startDate}-${dateRange.endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert('Failed to export data: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading AOV analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Average Order Value (AOV) Analytics</h1>
        <div className="flex gap-4">
          <div className="flex gap-2">
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="border rounded px-3 py-2"
            />
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="border rounded px-3 py-2"
            />
          </div>
          <Button onClick={handleExport}>Export CSV</Button>
        </div>
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">Gross AOV</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.summary.grossAOV)}</div>
              {summary.comparison.grossAOV && (
                <div className="text-sm mt-1">
                  {formatChange(summary.comparison.grossAOV.changePercent)} vs previous period
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">Net AOV</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.summary.netAOV)}</div>
              {summary.comparison.netAOV && (
                <div className="text-sm mt-1">
                  {formatChange(summary.comparison.netAOV.changePercent)} vs previous period
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">Online AOV</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.summary.onlineAOV)}</div>
              <div className="text-sm mt-1 text-gray-500">
                Stripe: {formatCurrency(summary.summary.stripeAOV)} | PayPal: {formatCurrency(summary.summary.paypalAOV)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">COD AOV</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.summary.codAOV)}</div>
              <div className="text-sm mt-1 text-gray-500">
                Refund Impact: {summary.summary.refundImpact.toFixed(2)}%
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* AOV Trend Chart */}
      {timeseries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>AOV Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={timeseries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value: number | string | undefined) => {
                  if (value === undefined || value === null) return '$0.00';
                  return formatCurrency(Number(value));
                }} />
                <Legend />
                <Line type="monotone" dataKey="grossAOV" stroke="#8884d8" name="Gross AOV" />
                <Line type="monotone" dataKey="netAOV" stroke="#82ca9d" name="Net AOV" />
                <Line type="monotone" dataKey="onlineAOV" stroke="#ffc658" name="Online AOV" />
                <Line type="monotone" dataKey="codAOV" stroke="#ff7300" name="COD AOV" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Payment Method Breakdown */}
      {breakdown && breakdown.breakdown && (
        <Card>
          <CardHeader>
            <CardTitle>AOV by Payment Method</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={[
                {
                  method: 'Stripe',
                  aov: breakdown.breakdown.stripe?.aov || 0,
                  orders: breakdown.breakdown.stripe?.ordersCount || 0,
                },
                {
                  method: 'PayPal',
                  aov: breakdown.breakdown.paypal?.aov || 0,
                  orders: breakdown.breakdown.paypal?.ordersCount || 0,
                },
                {
                  method: 'COD',
                  aov: breakdown.breakdown.cod?.aov || 0,
                  orders: breakdown.breakdown.cod?.ordersCount || 0,
                },
              ]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="method" />
                <YAxis />
                <Tooltip formatter={(value: number | string | undefined) => {
                  if (value === undefined || value === null) return '$0.00';
                  return formatCurrency(Number(value));
                }} />
                <Legend />
                <Bar dataKey="aov" fill="#8884d8" name="AOV" />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-3 gap-4">
              {breakdown.breakdown.stripe && (
                <div className="text-center">
                  <div className="text-sm text-gray-600">Stripe</div>
                  <div className="text-lg font-bold">{formatCurrency(breakdown.breakdown.stripe.aov)}</div>
                  <div className="text-xs text-gray-500">{breakdown.breakdown.stripe.ordersCount} orders</div>
                </div>
              )}
              {breakdown.breakdown.paypal && (
                <div className="text-center">
                  <div className="text-sm text-gray-600">PayPal</div>
                  <div className="text-lg font-bold">{formatCurrency(breakdown.breakdown.paypal.aov)}</div>
                  <div className="text-xs text-gray-500">{breakdown.breakdown.paypal.ordersCount} orders</div>
                </div>
              )}
              {breakdown.breakdown.cod && (
                <div className="text-center">
                  <div className="text-sm text-gray-600">COD</div>
                  <div className="text-lg font-bold">{formatCurrency(breakdown.breakdown.cod.aov)}</div>
                  <div className="text-xs text-gray-500">{breakdown.breakdown.cod.ordersCount} orders</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      {summary && (
        <Card>
          <CardHeader>
            <CardTitle>Summary Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-gray-600">Total Orders</div>
                <div className="text-xl font-bold">{summary.summary.totalOrders.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Gross Revenue</div>
                <div className="text-xl font-bold">{formatCurrency(summary.summary.totalGrossRevenue)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Net Revenue</div>
                <div className="text-xl font-bold">{formatCurrency(summary.summary.totalNetRevenue)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Total Refunds</div>
                <div className="text-xl font-bold text-red-600">{formatCurrency(summary.summary.totalRefunds)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

