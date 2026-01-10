'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { skuHeatmapAPI, storeAPI } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface HeatmapItem {
  skuId: string;
  sku: string;
  productId: string;
  productName?: string;
  views: number;
  ordersCount: number;
  grossRevenue: number;
  conversionRate: number;
  returnRate: number;
  stockLevel: number;
  metricValue: number;
  color: 'hot' | 'warm' | 'cold';
}

export default function SKUHeatmapPage() {
  const router = useRouter();
  const user = getCurrentUser();

  const [heatmapData, setHeatmapData] = useState<HeatmapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<'sales' | 'conversion' | 'returns' | 'inventory'>('sales');
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [userStores, setUserStores] = useState<any[]>([]);
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
  }, [selectedStoreId, dateRange, selectedMetric]);

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
      console.error('[SKU HEATMAP] Load stores error:', err);
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

      const response = await skuHeatmapAPI.getHeatmap({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        metric: selectedMetric,
      });

      if (response.success) {
        setHeatmapData(response.data.heatmap || []);
      } else {
        setError(response.message || 'Failed to load SKU heatmap');
      }
    } catch (err: any) {
      console.error('[SKU HEATMAP] Fetch error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load SKU heatmap');
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

  const getColorClass = (color: string) => {
    switch (color) {
      case 'hot':
        return 'bg-red-500 hover:bg-red-600 border-red-600';
      case 'warm':
        return 'bg-yellow-400 hover:bg-yellow-500 border-yellow-500';
      case 'cold':
        return 'bg-blue-400 hover:bg-blue-500 border-blue-500';
      default:
        return 'bg-gray-300 border-gray-400';
    }
  };

  const getColorLabel = (color: string) => {
    switch (color) {
      case 'hot':
        return 'Hot (Top 20%)';
      case 'warm':
        return 'Warm (Middle 60%)';
      case 'cold':
        return 'Cold (Bottom 20%)';
      default:
        return 'Unknown';
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
      console.error('[SKU HEATMAP] Export error:', err);
      alert('Failed to export data: ' + (err.message || 'Unknown error'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading SKU heatmap...</p>
        </div>
      </div>
    );
  }

  if (error && !heatmapData.length) {
    return (
      <div className="p-6">
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          <div className="font-semibold mb-2">Error loading heatmap</div>
          <div className="mb-4">{error}</div>
          <Button onClick={() => { setError(null); fetchData(); }} variant="primary">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Calculate summary statistics
  const totalSKUs = heatmapData.length;
  const hotSKUs = heatmapData.filter((item) => item.color === 'hot').length;
  const warmSKUs = heatmapData.filter((item) => item.color === 'warm').length;
  const coldSKUs = heatmapData.filter((item) => item.color === 'cold').length;
  const totalRevenue = heatmapData.reduce((sum, item) => sum + item.grossRevenue, 0);
  const totalOrders = heatmapData.reduce((sum, item) => sum + item.ordersCount, 0);
  const avgConversionRate = heatmapData.length > 0
    ? heatmapData.reduce((sum, item) => sum + item.conversionRate, 0) / heatmapData.length
    : 0;

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">SKU Heatmap Analytics</h1>
            <p className="text-text-secondary">Visualize SKU performance across multiple metrics</p>
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
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value as any)}
              className="px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="sales">Sales</option>
              <option value="conversion">Conversion</option>
              <option value="returns">Returns</option>
              <option value="inventory">Inventory</option>
            </select>
            <Button onClick={handleExport} variant="primary">
              Export CSV
            </Button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-400">
            {error}
          </div>
        )}

        {/* Summary Statistics */}
        {heatmapData.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card className="bg-surface border-border">
              <CardContent className="p-4">
                <div className="text-sm text-text-secondary mb-1">Total SKUs</div>
                <div className="text-2xl font-bold text-white">{totalSKUs}</div>
              </CardContent>
            </Card>
            <Card className="bg-surface border-border">
              <CardContent className="p-4">
                <div className="text-sm text-text-secondary mb-1">Hot SKUs</div>
                <div className="text-2xl font-bold text-red-400">{hotSKUs}</div>
              </CardContent>
            </Card>
            <Card className="bg-surface border-border">
              <CardContent className="p-4">
                <div className="text-sm text-text-secondary mb-1">Warm SKUs</div>
                <div className="text-2xl font-bold text-yellow-400">{warmSKUs}</div>
              </CardContent>
            </Card>
            <Card className="bg-surface border-border">
              <CardContent className="p-4">
                <div className="text-sm text-text-secondary mb-1">Cold SKUs</div>
                <div className="text-2xl font-bold text-blue-400">{coldSKUs}</div>
              </CardContent>
            </Card>
            <Card className="bg-surface border-border">
              <CardContent className="p-4">
                <div className="text-sm text-text-secondary mb-1">Total Revenue</div>
                <div className="text-2xl font-bold text-white">{formatCurrency(totalRevenue)}</div>
              </CardContent>
            </Card>
            <Card className="bg-surface border-border">
              <CardContent className="p-4">
                <div className="text-sm text-text-secondary mb-1">Total Orders</div>
                <div className="text-2xl font-bold text-white">{totalOrders.toLocaleString()}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Color Legend */}
        <Card className="bg-surface border-border">
          <CardHeader>
            <CardTitle className="text-white">Heatmap Legend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-red-500 rounded border border-red-600"></div>
                <span className="text-sm text-text-secondary">Hot (Top 20%) - Best performing SKUs</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-yellow-400 rounded border border-yellow-500"></div>
                <span className="text-sm text-text-secondary">Warm (Middle 60%) - Average performing SKUs</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-400 rounded border border-blue-500"></div>
                <span className="text-sm text-text-secondary">Cold (Bottom 20%) - Underperforming SKUs</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Heatmap Grid */}
        <Card className="bg-surface border-border">
          <CardHeader>
            <CardTitle className="text-white">
              SKU Performance Heatmap - {selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {heatmapData.length === 0 ? (
              <div className="text-center py-12 text-text-secondary">
                <p className="text-lg font-medium mb-2">No SKU data available</p>
                <p className="text-sm">Try selecting a different date range or metric.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {heatmapData.map((item) => (
                  <div
                    key={item.skuId}
                    className={`${getColorClass(item.color)} text-white p-4 rounded-lg cursor-pointer transition-all transform hover:scale-105 border-2 shadow-lg`}
                    title={`${item.sku} - ${getColorLabel(item.color)}`}
                  >
                    <div className="font-bold text-sm mb-1 truncate" title={item.sku}>
                      {item.sku}
                    </div>
                    {item.productName && (
                      <div className="text-xs opacity-75 mb-2 truncate" title={item.productName}>
                        {item.productName}
                      </div>
                    )}
                    <div className="text-xs font-semibold mb-1">
                      {selectedMetric === 'sales' && formatCurrency(item.metricValue)}
                      {selectedMetric === 'conversion' && `${item.metricValue.toFixed(1)}%`}
                      {selectedMetric === 'returns' && `${item.metricValue.toFixed(1)}%`}
                      {selectedMetric === 'inventory' && item.metricValue.toLocaleString()}
                    </div>
                    <div className="text-xs mt-2 opacity-90 border-t border-white/20 pt-2">
                      <div>{item.ordersCount} orders</div>
                      {selectedMetric !== 'sales' && (
                        <div className="mt-1">Revenue: {formatCurrency(item.grossRevenue)}</div>
                      )}
                      {selectedMetric === 'sales' && (
                        <div className="mt-1">Conv: {item.conversionRate.toFixed(1)}%</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detailed Statistics Table */}
        {heatmapData.length > 0 && (
          <Card className="bg-surface border-border">
            <CardHeader>
              <CardTitle className="text-white">SKU Performance Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary">SKU</th>
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary">Product</th>
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary">Status</th>
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary">Revenue</th>
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary">Orders</th>
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary">Conversion</th>
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary">Return Rate</th>
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary">Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {heatmapData.map((item) => (
                      <tr key={item.skuId} className="border-b border-border hover:bg-muted/20">
                        <td className="py-3 px-4 text-text-primary font-medium">{item.sku}</td>
                        <td className="py-3 px-4 text-text-secondary">
                          {item.productName || 'N/A'}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              item.color === 'hot'
                                ? 'bg-red-500/20 text-red-400'
                                : item.color === 'warm'
                                ? 'bg-yellow-400/20 text-yellow-400'
                                : 'bg-blue-400/20 text-blue-400'
                            }`}
                          >
                            {getColorLabel(item.color)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-text-primary">{formatCurrency(item.grossRevenue)}</td>
                        <td className="py-3 px-4 text-text-secondary">{item.ordersCount}</td>
                        <td className="py-3 px-4 text-text-secondary">{item.conversionRate.toFixed(1)}%</td>
                        <td className="py-3 px-4 text-text-secondary">{item.returnRate.toFixed(1)}%</td>
                        <td className="py-3 px-4 text-text-secondary">{item.stockLevel.toLocaleString()}</td>
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

