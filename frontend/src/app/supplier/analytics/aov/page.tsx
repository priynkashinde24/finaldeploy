'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { aovAnalyticsAPI } from '@/lib/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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

export default function SupplierAOVPage() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesData[]>([]);
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

      const [summaryResponse, timeseriesResponse] = await Promise.all([
        aovAnalyticsAPI.getSummary({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        }),
        aovAnalyticsAPI.getTimeseries({
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
      setError('Failed to export data: ' + (err.message || 'Unknown error'));
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mb-4"></div>
          <div className="text-center text-gray-600">Loading AOV analytics...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800 font-semibold mb-2">Error loading analytics</div>
          <div className="text-red-600 mb-4">{error}</div>
          <Button onClick={() => { setError(null); fetchData(); }} className="bg-red-600 hover:bg-red-700">
            Retry
          </Button>
        </div>
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

      {/* KPI Cards - Supplier Focus */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">Supplier AOV</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary.summary.supplierAOV ? formatCurrency(summary.summary.supplierAOV) : 'N/A'}
              </div>
              {summary.comparison.grossAOV && summary.summary.supplierAOV && (
                <div className="text-sm mt-1">
                  {formatChange(summary.comparison.grossAOV.changePercent)} vs previous period
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">Total Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.summary.totalOrders.toLocaleString()}</div>
              <div className="text-sm mt-1 text-gray-500">
                Supplier Revenue: {formatCurrency(summary.summary.totalGrossRevenue)}
              </div>
              {summary.summary.totalOrders > 0 && (
                <div className="text-xs mt-1 text-gray-400">
                  Avg per order: {formatCurrency(summary.summary.totalGrossRevenue / summary.summary.totalOrders)}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">Net Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.summary.totalNetRevenue)}</div>
              <div className="text-sm mt-1 text-gray-500">
                After refunds and adjustments
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Supplier AOV Trend Chart */}
      {timeseries.length > 0 && timeseries.some(d => d.supplierAOV !== null) && (
        <Card>
          <CardHeader>
            <CardTitle>Supplier AOV Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={timeseries.filter(d => d.supplierAOV !== null)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value: string) => {
                    const date = new Date(value);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                  }}
                />
                <YAxis />
                <Tooltip 
                  formatter={(value: number | string | undefined) => {
                    if (value === undefined || value === null) return '$0.00';
                    return formatCurrency(Number(value));
                  }}
                  labelFormatter={(label: string) => {
                    const date = new Date(label);
                    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="supplierAOV" 
                  stroke="#8884d8" 
                  name="Supplier AOV"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Empty State for Chart */}
      {timeseries.length > 0 && !timeseries.some(d => d.supplierAOV !== null) && (
        <Card>
          <CardHeader>
            <CardTitle>Supplier AOV Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-gray-500">
              <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-lg font-medium mb-2">No supplier AOV data available</p>
              <p className="text-sm">Try selecting a different date range.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State - No data at all */}
      {!summary && timeseries.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>No Data Available</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-gray-500">
              <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-lg font-medium mb-2">No AOV data found</p>
              <p className="text-sm">No supplier orders found for the selected date range.</p>
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
                <div className="text-sm text-gray-600">Supplier Revenue</div>
                <div className="text-xl font-bold">{formatCurrency(summary.summary.totalGrossRevenue)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Net Revenue</div>
                <div className="text-xl font-bold">{formatCurrency(summary.summary.totalNetRevenue)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Average AOV</div>
                <div className="text-xl font-bold">
                  {summary.summary.supplierAOV ? formatCurrency(summary.summary.supplierAOV) : 'N/A'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

