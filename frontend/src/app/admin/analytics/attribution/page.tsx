'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { attributionAPI } from '@/lib/api';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface AttributionSummary {
  totalVisits: number;
  totalSignups: number;
  totalOrders: number;
  totalRevenue: number;
  totalCost: number;
  overallConversionRate: number;
  overallAOV: number;
  overallROI: number;
  channels: Array<{
    channel: string;
    visits: number;
    signups: number;
    orders: number;
    revenue: number;
    cost: number;
    conversionRate: number;
    aov: number;
    roi: number;
  }>;
}

interface ChannelPerformance {
  channel: string;
  timeseries: Array<{
    date: string;
    visits: number;
    signups: number;
    orders: number;
    revenue: number;
    conversionRate: number;
    aov: number;
    cost: number;
    roi: number;
  }>;
  totals: {
    visits: number;
    signups: number;
    orders: number;
    revenue: number;
    cost: number;
  };
}

export default function AdminAttributionPage() {
  const [summary, setSummary] = useState<AttributionSummary | null>(null);
  const [channelPerformance, setChannelPerformance] = useState<ChannelPerformance[]>([]);
  const [paths, setPaths] = useState<Array<{ path: string; orders: number; revenue: number }>>([]);
  const [modelCompare, setModelCompare] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attributionModel, setAttributionModel] = useState<'first_touch' | 'last_touch' | 'linear' | 'time_decay'>('last_touch');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    fetchData();
  }, [dateRange, attributionModel]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [summaryResponse, channelsResponse, pathsResponse, compareResponse] = await Promise.all([
        attributionAPI.getOverview({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          attributionModel,
        }),
        attributionAPI.getByChannel({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          attributionModel,
        }),
        attributionAPI.getPaths({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          attributionModel,
          limit: 20,
        }),
        attributionAPI.compareModels({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        }),
      ]);

      if (summaryResponse.success) {
        setSummary(summaryResponse.data.summary);
      }
      if (channelsResponse.success) {
        setChannelPerformance(channelsResponse.data.channels || []);
      }
      if (pathsResponse.success) {
        setPaths(pathsResponse.data.paths || []);
      }
      if (compareResponse.success) {
        setModelCompare(compareResponse.data.comparison || null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load attribution data');
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

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Marketing Attribution</h1>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Attribution Model</label>
              <select
                value={attributionModel}
                onChange={(e) => setAttributionModel(e.target.value as any)}
                className="border rounded px-3 py-2"
              >
                <option value="first_touch">First Touch</option>
                <option value="last_touch">Last Touch</option>
                <option value="linear">Linear</option>
                <option value="time_decay">Time Decay</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Start Date</label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                className="border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End Date</label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                className="border rounded px-3 py-2"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">Total Visits</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalVisits.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">Total Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalOrders.toLocaleString()}</div>
              <div className="text-sm text-gray-500 mt-1">
                Conversion: {formatPercentage(summary.overallConversionRate)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.totalRevenue)}</div>
              <div className="text-sm text-gray-500 mt-1">AOV: {formatCurrency(summary.overallAOV)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">ROI</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatPercentage(summary.overallROI)}</div>
              <div className="text-sm text-gray-500 mt-1">Cost: {formatCurrency(summary.totalCost)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Channel Performance Table */}
      {loading ? (
        <div className="text-center py-8">Loading attribution data...</div>
      ) : error ? (
        <div className="text-center py-8 text-red-600">{error}</div>
      ) : summary && summary.channels.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Channel Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Channel</th>
                    <th className="text-right p-2">Visits</th>
                    <th className="text-right p-2">Signups</th>
                    <th className="text-right p-2">Orders</th>
                    <th className="text-right p-2">Revenue</th>
                    <th className="text-right p-2">Cost</th>
                    <th className="text-right p-2">Conversion</th>
                    <th className="text-right p-2">AOV</th>
                    <th className="text-right p-2">ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.channels.map((channel) => (
                    <tr key={channel.channel} className="border-b hover:bg-gray-50">
                      <td className="p-2 font-semibold">{channel.channel}</td>
                      <td className="p-2 text-right">{channel.visits.toLocaleString()}</td>
                      <td className="p-2 text-right">{channel.signups.toLocaleString()}</td>
                      <td className="p-2 text-right">{channel.orders.toLocaleString()}</td>
                      <td className="p-2 text-right">{formatCurrency(channel.revenue)}</td>
                      <td className="p-2 text-right">{formatCurrency(channel.cost)}</td>
                      <td className="p-2 text-right">{formatPercentage(channel.conversionRate)}</td>
                      <td className="p-2 text-right">{formatCurrency(channel.aov)}</td>
                      <td className="p-2 text-right">
                        <span className={channel.roi >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {formatPercentage(channel.roi)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-8 text-gray-500">No attribution data available</div>
      )}

      {/* Revenue by Channel Chart */}
      {channelPerformance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Channel (Time Series)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={channelPerformance.flatMap((ch) => ch.timeseries.map((t) => ({ ...t, channel: ch.channel })))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip
                  formatter={(value: number | string | undefined) => {
                    if (value === undefined || value === null) return '$0.00';
                    return formatCurrency(Number(value));
                  }}
                />
                <Legend />
                {channelPerformance.map((ch, idx) => (
                  <Line
                    key={ch.channel}
                    type="monotone"
                    dataKey="revenue"
                    data={ch.timeseries}
                    name={ch.channel}
                    stroke={['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00'][idx % 5]}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Model comparison */}
      {modelCompare && (
        <Card>
          <CardHeader>
            <CardTitle>Attribution Model Comparison (Total Revenue)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={Object.entries(modelCompare).map(([model, v]: any) => ({
                  model,
                  revenue: v?.revenue || 0,
                  orders: v?.orders || 0,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="model" />
                <YAxis />
                <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                <Bar dataKey="revenue" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Conversion paths */}
      {paths.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Conversion Paths</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Path</th>
                    <th className="text-right p-2">Orders</th>
                    <th className="text-right p-2">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {paths.map((p) => (
                    <tr key={p.path} className="border-b hover:bg-gray-50">
                      <td className="p-2 font-medium">{p.path}</td>
                      <td className="p-2 text-right">{Number(p.orders || 0).toLocaleString()}</td>
                      <td className="p-2 text-right">{formatCurrency(Number(p.revenue || 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

