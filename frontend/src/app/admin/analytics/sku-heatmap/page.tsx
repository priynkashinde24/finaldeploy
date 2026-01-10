'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { skuHeatmapAPI } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface HeatmapItem {
  skuId: string;
  sku: string;
  productId: string;
  views: number;
  ordersCount: number;
  grossRevenue: number;
  conversionRate: number;
  returnRate: number;
  stockLevel: number;
  metricValue: number;
  color: 'hot' | 'warm' | 'cold';
}

export default function AdminSKUHeatmapPage() {
  const router = useRouter();
  const [heatmapData, setHeatmapData] = useState<HeatmapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<'sales' | 'conversion' | 'returns' | 'inventory'>('sales');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    fetchData();
  }, [dateRange, selectedMetric]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await skuHeatmapAPI.getHeatmap({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        metric: selectedMetric,
      });

      if (response.success) {
        setHeatmapData(response.data.heatmap || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load SKU heatmap');
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

  const getColorClass = (color: string) => {
    switch (color) {
      case 'hot':
        return 'bg-red-500 hover:bg-red-600';
      case 'warm':
        return 'bg-yellow-400 hover:bg-yellow-500';
      case 'cold':
        return 'bg-blue-400 hover:bg-blue-500';
      default:
        return 'bg-gray-300';
    }
  };

  const handleExport = async () => {
    try {
      const blob = await skuHeatmapAPI.exportData({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sku-heatmap-${dateRange.startDate}-${dateRange.endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert('Failed to export data: ' + err.message);
    }
  };

  const handleSKUClick = (skuId: string) => {
    router.push(`/admin/analytics/sku/${skuId}`);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mb-4"></div>
          <div className="text-center text-gray-600">Loading SKU heatmap...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800 font-semibold mb-2">Error loading heatmap</div>
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
        <h1 className="text-3xl font-bold">SKU Heatmap Analytics</h1>
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
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value as any)}
            className="border rounded px-3 py-2"
          >
            <option value="sales">Sales</option>
            <option value="conversion">Conversion</option>
            <option value="returns">Returns</option>
            <option value="inventory">Inventory</option>
          </select>
          <Button onClick={handleExport}>Export CSV</Button>
        </div>
      </div>

      {/* Color Legend */}
      <Card>
        <CardHeader>
          <CardTitle>Heatmap Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-red-500 rounded"></div>
              <span className="text-sm">Hot (Top 20%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-yellow-400 rounded"></div>
              <span className="text-sm">Warm (Middle 60%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-blue-400 rounded"></div>
              <span className="text-sm">Cold (Bottom 20%)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Heatmap Grid */}
      <Card>
        <CardHeader>
          <CardTitle>SKU Performance Heatmap - {selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1)}</CardTitle>
        </CardHeader>
        <CardContent>
          {heatmapData.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg font-medium mb-2">No SKU data available</p>
              <p className="text-sm">Try selecting a different date range.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {heatmapData.map((item) => (
                <div
                  key={item.skuId}
                  onClick={() => handleSKUClick(item.skuId)}
                  className={`${getColorClass(item.color)} text-white p-4 rounded-lg cursor-pointer transition-all transform hover:scale-105`}
                >
                  <div className="font-bold text-sm mb-1">{item.sku}</div>
                  <div className="text-xs opacity-90">
                    {selectedMetric === 'sales' && formatCurrency(item.metricValue)}
                    {selectedMetric === 'conversion' && `${item.metricValue.toFixed(1)}%`}
                    {selectedMetric === 'returns' && `${item.metricValue.toFixed(1)}%`}
                    {selectedMetric === 'inventory' && item.metricValue}
                  </div>
                  <div className="text-xs mt-2 opacity-75">
                    {item.ordersCount} orders
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Stats */}
      {heatmapData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Summary Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-gray-600">Total SKUs</div>
                <div className="text-xl font-bold">{heatmapData.length}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Hot SKUs</div>
                <div className="text-xl font-bold text-red-600">
                  {heatmapData.filter((item) => item.color === 'hot').length}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Total Revenue</div>
                <div className="text-xl font-bold">
                  {formatCurrency(heatmapData.reduce((sum, item) => sum + item.grossRevenue, 0))}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Total Orders</div>
                <div className="text-xl font-bold">
                  {heatmapData.reduce((sum, item) => sum + item.ordersCount, 0).toLocaleString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

