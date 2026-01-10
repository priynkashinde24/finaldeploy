'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Navbar } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Footer } from '@/components/marketing';
import { analyticsAPI } from '@/lib/api';
import { cn } from '@/lib/utils';

interface AnalyticsSummary {
  storeId: string;
  totalSalesToday: number;
  ordersCountToday: number;
  aov: number;
  conversionRate: number;
  period: {
    from: string;
    to: string;
  };
}

interface TimeseriesPoint {
  timestamp: string;
  value: number;
}

interface TimeseriesData {
  storeId: string;
  metric: string;
  from: string;
  to: string;
  points: TimeseriesPoint[];
}

interface SSEMessage {
  type: 'connected' | 'event' | 'metric' | 'heartbeat';
  data?: any;
  storeId?: string;
  timestamp?: string;
}

export default function StoreAnalyticsPage() {
  const params = useParams();
  const storeId = params.id as string;

  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sseConnected, setSseConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    fetchAnalytics();
    connectSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch summary
      const summaryResponse = await analyticsAPI.getSummary(storeId);
      if (summaryResponse.success) {
        setSummary(summaryResponse.data);
      }

      // Fetch timeseries (last 7 days)
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 7);

      const timeseriesResponse = await analyticsAPI.getTimeseries(storeId, {
        metric: 'orders.count',
        from: from.toISOString(),
        to: to.toISOString(),
      });

      if (timeseriesResponse.success) {
        setTimeseries(timeseriesResponse.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const connectSSE = () => {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const sseUrl = `${apiBaseUrl}/api/events/stream?storeId=${storeId}`;

    const eventSource = new EventSource(sseUrl);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setSseConnected(true);
      console.log('[SSE] Connected to event stream');
    };

    eventSource.onmessage = (event) => {
      try {
        const message: SSEMessage = JSON.parse(event.data);

        if (message.type === 'connected') {
          setSseConnected(true);
        } else if (message.type === 'metric') {
          // Update summary when metric arrives
          handleMetricUpdate(message.data);
        } else if (message.type === 'event') {
          // Handle event updates
          handleEventUpdate(message.data);
        } else if (message.type === 'heartbeat') {
          // Keep connection alive
        }
      } catch (err) {
        console.error('[SSE] Error parsing message:', err);
      }
    };

    eventSource.onerror = (error) => {
      console.error('[SSE] Connection error:', error);
      setSseConnected(false);
      // Attempt to reconnect after 5 seconds
      setTimeout(() => {
        if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
          connectSSE();
        }
      }, 5000);
    };
  };

  const handleMetricUpdate = (metric: any) => {
    // Refresh summary when relevant metrics update
    if (metric.metricName === 'orders.count' || metric.metricName === 'orders.revenue') {
      fetchAnalytics();
    }

    // Update timeseries if it's an orders metric
    if (metric.metricName === 'orders.count' && timeseries) {
      // Add new point to timeseries
      const newPoint: TimeseriesPoint = {
        timestamp: metric.timestamp,
        value: metric.value,
      };

      setTimeseries({
        ...timeseries,
        points: [...timeseries.points, newPoint].slice(-30), // Keep last 30 points
      });
    }
  };

  const handleEventUpdate = (event: any) => {
    // Refresh analytics when order events occur
    if (event.eventType === 'order.created' || event.eventType === 'order.paid') {
      fetchAnalytics();
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  // Simple line chart component (SVG-based)
  const SimpleLineChart = ({ data }: { data: TimeseriesPoint[] }) => {
    if (data.length === 0) return null;

    const width = 600;
    const height = 200;
    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const values = data.map((p) => p.value);
    const maxValue = Math.max(...values, 1);
    const minValue = Math.min(...values, 0);

    const points = data.map((point, index) => {
      const x = padding + (index / (data.length - 1 || 1)) * chartWidth;
      const y = padding + chartHeight - ((point.value - minValue) / (maxValue - minValue || 1)) * chartHeight;
      return `${x},${y}`;
    });

    const pathData = `M ${points.join(' L ')}`;

    return (
      <svg width={width} height={height} className="w-full h-auto">
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padding + chartHeight * (1 - ratio);
          return (
            <line
              key={ratio}
              x1={padding}
              y1={y}
              x2={width - padding}
              y2={y}
              stroke="#e5e7eb"
              strokeWidth="1"
            />
          );
        })}
        {/* Area under curve */}
        <path
          d={`${pathData} L ${width - padding},${padding + chartHeight} L ${padding},${padding + chartHeight} Z`}
          fill="url(#gradient)"
        />
        {/* Line */}
        <path d={pathData} fill="none" stroke="#3b82f6" strokeWidth="2" />
        {/* Points */}
        {points.map((point, index) => {
          const [x, y] = point.split(',').map(Number);
          return <circle key={index} cx={x} cy={y} r="4" fill="#3b82f6" />;
        })}
        {/* Y-axis labels */}
        {[0, 0.5, 1].map((ratio) => {
          const value = minValue + (maxValue - minValue) * ratio;
          const y = padding + chartHeight * (1 - ratio);
          return (
            <text key={ratio} x={padding - 10} y={y + 5} textAnchor="end" className="text-xs fill-gray-600">
              {Math.round(value)}
            </text>
          );
        })}
      </svg>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <SectionTitle>Store Analytics</SectionTitle>
            <p className="text-gray-600 mt-2">Real-time insights for your store</p>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'w-3 h-3 rounded-full',
                sseConnected ? 'bg-green-500' : 'bg-gray-400'
              )}
            />
            <span className="text-sm text-gray-600">
              {sseConnected ? 'Live' : 'Disconnected'}
            </span>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8">
            <p className="text-gray-500">Loading analytics...</p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-gray-600">Total Sales Today</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-gray-900">
                    {summary ? formatCurrency(summary.totalSalesToday) : '$0.00'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-gray-600">Orders Today</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-gray-900">
                    {summary ? summary.ordersCountToday : 0}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-gray-600">Average Order Value</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-gray-900">
                    {summary ? formatCurrency(summary.aov) : '$0.00'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-gray-600">Conversion Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-gray-900">
                    {summary ? `${summary.conversionRate}%` : '0%'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Timeseries Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Orders Over Time (Last 7 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                {timeseries && timeseries.points.length > 0 ? (
                  <div>
                    <SimpleLineChart data={timeseries.points} />
                    <div className="mt-4 flex justify-between text-xs text-gray-500">
                      <span>{formatDate(timeseries.points[0]?.timestamp || '')}</span>
                      <span>{formatDate(timeseries.points[timeseries.points.length - 1]?.timestamp || '')}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

