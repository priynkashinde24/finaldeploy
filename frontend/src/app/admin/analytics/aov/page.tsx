'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { aovReportsAPI } from '@/lib/api';
import { ChartCard } from '@/components/charts/ChartCard';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface OverviewData {
  aov: number;
  totalRevenue: number;
  totalCompletedOrders: number;
  growthPercent: number;
  dateRange: { start: string; end: string; previousStart: string; previousEnd: string };
}

interface TrendData {
  interval: 'daily' | 'weekly' | 'monthly';
  data: Array<{ date: string; revenue: number; orders: number; aov: number }>;
}

interface ByCategoryData {
  rows: Array<{ categoryId: string | null; categoryName: string; revenue: number; completedOrders: number; aov: number }>;
}

interface ByChannelData {
  rows: Array<{ channel: string; revenue: number; orders: number; aov: number }>;
}

interface HighValueOrdersData {
  items: Array<{
    orderId: string;
    orderNumber?: string;
    customerName?: string;
    customerEmail?: string;
    orderStatus: string;
    paymentStatus: string;
    paymentMethod?: string;
    total: number;
    createdAt: string;
    channel?: string;
  }>;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  minTotal: number;
}

export default function AdminAOVPage() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [trend, setTrend] = useState<TrendData | null>(null);
  const [byCategory, setByCategory] = useState<ByCategoryData | null>(null);
  const [byChannel, setByChannel] = useState<ByChannelData | null>(null);
  const [highValue, setHighValue] = useState<HighValueOrdersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  const [interval, setInterval] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [minTotal, setMinTotal] = useState<number>(200);
  const [page, setPage] = useState<number>(1);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, interval, minTotal, page]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = { startDate: dateRange.startDate, endDate: dateRange.endDate };
      const [overviewRes, trendRes, catRes, channelRes, hvRes] = await Promise.all([
        aovReportsAPI.getOverview(params),
        aovReportsAPI.getTrend({ ...params, interval }),
        aovReportsAPI.byCategory(params),
        aovReportsAPI.byChannel(params),
        aovReportsAPI.highValueOrders({ ...params, page, limit: 10, minTotal }),
      ]);

      if (overviewRes.success) setOverview(overviewRes.data);
      if (trendRes.success) setTrend(trendRes.data);
      if (catRes.success) setByCategory(catRes.data);
      if (channelRes.success) setByChannel(channelRes.data);
      if (hvRes.success) setHighValue(hvRes.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load AOV reports');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(amount);

  const formatChange = (change: number) => {
    const sign = change >= 0 ? '+' : '';
    const color = change >= 0 ? 'text-green-600' : 'text-red-600';
    return <span className={color}>{sign}{change.toFixed(1)}%</span>;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading AOV reports...</div>
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
        <h1 className="text-3xl font-bold">Average Order Value (AOV) Reports</h1>
        <div className="flex gap-4">
          <div className="flex gap-2">
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => { setPage(1); setDateRange({ ...dateRange, startDate: e.target.value }); }}
              className="border rounded px-3 py-2"
            />
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => { setPage(1); setDateRange({ ...dateRange, endDate: e.target.value }); }}
              className="border rounded px-3 py-2"
            />
          </div>
          <select
            value={interval}
            onChange={(e) => setInterval(e.target.value as any)}
            className="border rounded px-3 py-2"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
      </div>

      {overview ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <ChartCard title="AOV">
            <div className="text-2xl font-bold">{formatCurrency(overview.aov)}</div>
            <div className="text-sm mt-1">{formatChange(overview.growthPercent)} vs previous period</div>
          </ChartCard>
          <ChartCard title="Total revenue">
            <div className="text-2xl font-bold">{formatCurrency(overview.totalRevenue)}</div>
          </ChartCard>
          <ChartCard title="Completed orders">
            <div className="text-2xl font-bold">{overview.totalCompletedOrders.toLocaleString()}</div>
          </ChartCard>
          <ChartCard title="Growth">
            <div className="text-2xl font-bold">{overview.growthPercent.toFixed(1)}%</div>
          </ChartCard>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="AOV trend">
          {trend?.data?.length ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis tickFormatter={(v) => formatCurrency(Number(v))} />
                  <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                  <Line type="monotone" dataKey="aov" stroke="#2563eb" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-gray-500">No trend data.</div>
          )}
        </ChartCard>

        <ChartCard title="AOV by channel">
          {byChannel?.rows?.length ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byChannel.rows}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="channel" />
                  <YAxis tickFormatter={(v) => formatCurrency(Number(v))} />
                  <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                  <Bar dataKey="aov" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-gray-500">No channel breakdown.</div>
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="AOV by category">
          {byCategory?.rows?.length ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byCategory.rows}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="categoryName" interval={0} angle={-15} height={60} />
                  <YAxis tickFormatter={(v) => formatCurrency(Number(v))} />
                  <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                  <Bar dataKey="aov" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-gray-500">No category breakdown.</div>
          )}
        </ChartCard>

        <ChartCard
          title="High-value orders"
          right={
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Min total</span>
              <input
                type="number"
                value={minTotal}
                onChange={(e) => { setPage(1); setMinTotal(Number(e.target.value)); }}
                className="border rounded px-3 py-2 w-28"
              />
            </div>
          }
        >
          {highValue?.items?.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-2 pr-4">Order</th>
                    <th className="py-2 pr-4">Customer</th>
                    <th className="py-2 pr-4">Channel</th>
                    <th className="py-2 pr-4">Total</th>
                    <th className="py-2 pr-4">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {highValue.items.map((o) => (
                    <tr key={o.orderId} className="border-b last:border-b-0">
                      <td className="py-2 pr-4 font-medium">{o.orderNumber || o.orderId}</td>
                      <td className="py-2 pr-4">
                        <div className="font-medium">{o.customerName || '—'}</div>
                        <div className="text-xs text-gray-500">{o.customerEmail || '—'}</div>
                      </td>
                      <td className="py-2 pr-4">{o.channel || 'direct'}</td>
                      <td className="py-2 pr-4 font-medium">{formatCurrency(o.total)}</td>
                      <td className="py-2 pr-4 text-gray-600">{new Date(o.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-sm text-gray-500">
                  Page {highValue.page} of {highValue.totalPages} • {highValue.total.toLocaleString()} orders
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={highValue.page <= 1}>
                    Prev
                  </Button>
                  <Button variant="secondary" onClick={() => setPage((p) => Math.min(highValue.totalPages, p + 1))} disabled={highValue.page >= highValue.totalPages}>
                    Next
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-gray-500">No high-value orders.</div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}

