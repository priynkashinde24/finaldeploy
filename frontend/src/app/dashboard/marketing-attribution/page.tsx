'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { attributionAPI, storeAPI } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

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

const CHART_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00', '#0088fe', '#00c49f', '#ffbb28', '#ff8042'];

export default function MarketingAttributionPage() {
  const router = useRouter();
  const user = getCurrentUser();

  const [summary, setSummary] = useState<AttributionSummary | null>(null);
  const [channelPerformance, setChannelPerformance] = useState<ChannelPerformance[]>([]);
  const [paths, setPaths] = useState<Array<{ path: string; orders: number; revenue: number }>>([]);
  const [modelCompare, setModelCompare] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [userStores, setUserStores] = useState<any[]>([]);
  const [attributionModel, setAttributionModel] = useState<'first_touch' | 'last_touch' | 'linear' | 'time_decay'>('last_touch');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

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
  }, [selectedStoreId, dateRange, attributionModel]);

  const loadStores = async () => {
    try {
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
      console.error('[MARKETING ATTRIBUTION] Load stores error:', err);
      setError('Failed to load stores');
      setLoading(false);
    }
  };

  const fetchData = async () => {
    if (!selectedStoreId) {
      setLoading(false);
      return;
    }

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
      console.error('[MARKETING ATTRIBUTION] Fetch error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load attribution data');
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

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading marketing attribution data...</p>
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
            <h1 className="text-3xl font-bold text-white mb-2">Marketing Channel Attribution</h1>
            <p className="text-text-secondary">Track and analyze marketing channel performance</p>
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
              value={attributionModel}
              onChange={(e) => setAttributionModel(e.target.value as any)}
              className="px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="first_touch">First Touch</option>
              <option value="last_touch">Last Touch</option>
              <option value="linear">Linear</option>
              <option value="time_decay">Time Decay</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-surface border-border">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-text-secondary">Total Visits</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{summary.totalVisits.toLocaleString()}</div>
                <p className="text-xs text-text-muted mt-1">Marketing visits</p>
              </CardContent>
            </Card>

            <Card className="bg-surface border-border">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-text-secondary">Total Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{summary.totalOrders.toLocaleString()}</div>
                <div className="text-xs text-text-muted mt-1">
                  Conversion: {formatPercentage(summary.overallConversionRate)}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-surface border-border">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-text-secondary">Total Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{formatCurrency(summary.totalRevenue)}</div>
                <div className="text-xs text-text-muted mt-1">AOV: {formatCurrency(summary.overallAOV)}</div>
              </CardContent>
            </Card>

            <Card className="bg-surface border-border">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-text-secondary">ROI</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${summary.overallROI >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatPercentage(summary.overallROI)}
                </div>
                <div className="text-xs text-text-muted mt-1">Cost: {formatCurrency(summary.totalCost)}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Channel Performance Table */}
        {summary && summary.channels.length > 0 ? (
          <Card className="bg-surface border-border">
            <CardHeader>
              <CardTitle className="text-white">Channel Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary">Channel</th>
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary text-right">Visits</th>
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary text-right">Signups</th>
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary text-right">Orders</th>
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary text-right">Revenue</th>
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary text-right">Cost</th>
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary text-right">Conversion</th>
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary text-right">AOV</th>
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary text-right">ROI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.channels.map((channel) => (
                      <tr key={channel.channel} className="border-b border-border hover:bg-muted/20">
                        <td className="py-3 px-4 text-text-primary font-semibold">{channel.channel}</td>
                        <td className="py-3 px-4 text-right text-text-secondary">{channel.visits.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right text-text-secondary">{channel.signups.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right text-text-primary font-medium">{channel.orders.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right text-text-primary font-medium">{formatCurrency(channel.revenue)}</td>
                        <td className="py-3 px-4 text-right text-text-secondary">{formatCurrency(channel.cost)}</td>
                        <td className="py-3 px-4 text-right text-text-secondary">{formatPercentage(channel.conversionRate)}</td>
                        <td className="py-3 px-4 text-right text-text-secondary">{formatCurrency(channel.aov)}</td>
                        <td className="py-3 px-4 text-right">
                          <span className={channel.roi >= 0 ? 'text-green-400' : 'text-red-400'}>
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
          !loading && (
            <Card className="bg-surface border-border">
              <CardContent className="p-12">
                <div className="text-center text-text-secondary">
                  <p className="text-lg font-medium mb-2">No attribution data available</p>
                  <p className="text-sm">Try selecting a different date range or attribution model.</p>
                </div>
              </CardContent>
            </Card>
          )
        )}

        {/* Revenue by Channel Chart */}
        {channelPerformance.length > 0 && (() => {
          // Combine all timeseries data for the chart
          const allDates = new Set<string>();
          channelPerformance.forEach((ch) => {
            ch.timeseries.forEach((ts) => allDates.add(ts.date));
          });
          const sortedDates = Array.from(allDates).sort();

          // Create combined data array
          const combinedData = sortedDates.map((date) => {
            const dataPoint: any = { date };
            channelPerformance.forEach((ch) => {
              const tsPoint = ch.timeseries.find((ts) => ts.date === date);
              dataPoint[ch.channel] = tsPoint?.revenue || 0;
            });
            return dataPoint;
          });

          return (
            <Card className="bg-surface border-border">
              <CardHeader>
                <CardTitle className="text-white">Revenue by Channel (Time Series)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={combinedData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis
                        dataKey="date"
                        stroke="#9CA3AF"
                        tickFormatter={(value) => new Date(value).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                      />
                      <YAxis
                        stroke="#9CA3AF"
                        tickFormatter={(value) => formatCurrency(Number(value))}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                        formatter={(value: any) => formatCurrency(Number(value))}
                        labelFormatter={(label) => new Date(label).toLocaleDateString('en-IN')}
                      />
                      <Legend />
                      {channelPerformance.map((ch, idx) => (
                        <Line
                          key={ch.channel}
                          type="monotone"
                          dataKey={ch.channel}
                          name={ch.channel}
                          stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                          strokeWidth={2}
                          dot={false}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Revenue Distribution Pie Chart */}
        {summary && summary.channels.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-surface border-border">
              <CardHeader>
                <CardTitle className="text-white">Revenue Distribution by Channel</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={summary.channels.map((ch) => ({ name: ch.channel, value: ch.revenue }))}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {summary.channels.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                        formatter={(value: any) => formatCurrency(Number(value))}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Model Comparison */}
            {modelCompare && (
              <Card className="bg-surface border-border">
                <CardHeader>
                  <CardTitle className="text-white">Attribution Model Comparison</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={Object.entries(modelCompare).map(([model, v]: any) => ({
                          model: model.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
                          revenue: v?.revenue || 0,
                          orders: v?.orders || 0,
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis
                          dataKey="model"
                          stroke="#9CA3AF"
                        />
                        <YAxis
                          stroke="#9CA3AF"
                          tickFormatter={(value) => formatCurrency(Number(value))}
                        />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                          formatter={(value: any) => formatCurrency(Number(value))}
                        />
                        <Legend />
                        <Bar dataKey="revenue" fill="#8884d8" name="Revenue" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Conversion Paths */}
        {paths.length > 0 && (
          <Card className="bg-surface border-border">
            <CardHeader>
              <CardTitle className="text-white">Top Conversion Paths</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary">Path</th>
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary text-right">Orders</th>
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paths.map((p) => (
                      <tr key={p.path} className="border-b border-border hover:bg-muted/20">
                        <td className="py-3 px-4 text-text-primary font-medium">{p.path || 'Direct'}</td>
                        <td className="py-3 px-4 text-right text-text-secondary">{Number(p.orders || 0).toLocaleString()}</td>
                        <td className="py-3 px-4 text-right text-text-primary font-medium">{formatCurrency(Number(p.revenue || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

