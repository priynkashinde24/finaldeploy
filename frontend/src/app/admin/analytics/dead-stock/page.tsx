'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { deadStockAPI } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface DeadStockAlert {
  _id: string;
  skuId: {
    _id: string;
    sku: string;
    attributes?: any[];
  };
  productId: {
    _id: string;
    name: string;
  };
  severity: 'warning' | 'critical';
  status: 'open' | 'acknowledged' | 'resolved';
  stockLevel: number;
  stockValue: number;
  daysSinceLastSale: number;
  lastSoldAt: string | null;
  suggestions: {
    discountPercent?: number;
    liquidation?: boolean;
    supplierReturn?: boolean;
    delist?: boolean;
  };
  createdAt: string;
}

interface DeadStockMetrics {
  openAlerts: number;
  criticalAlerts: number;
  totalStockValueAtRisk: number;
  recoveryRate: number;
  avgTimeToResolution: number;
  inventoryAtRiskPercent: number;
}

export default function AdminDeadStockPage() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<DeadStockAlert[]>([]);
  const [metrics, setMetrics] = useState<DeadStockMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [selectedAlert, setSelectedAlert] = useState<DeadStockAlert | null>(null);

  useEffect(() => {
    fetchAlerts();
    fetchAnalytics();
  }, [statusFilter, severityFilter]);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (severityFilter !== 'all') params.severity = severityFilter;

      const response = await deadStockAPI.getAlerts(params);
      if (response.success) {
        setAlerts(response.data.alerts || []);
        if (response.data.metrics) {
          setMetrics(response.data.metrics);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load dead stock alerts');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await deadStockAPI.getAnalytics();
      if (response.success) {
        setMetrics(response.data.metrics);
      }
    } catch (err: any) {
      console.error('Failed to load analytics:', err);
    }
  };

  const handleAcknowledge = async (alertId: string) => {
    try {
      await deadStockAPI.acknowledgeAlert(alertId);
      await fetchAlerts();
      setSelectedAlert(null);
    } catch (err: any) {
      alert('Failed to acknowledge alert: ' + err.message);
    }
  };

  const handleResolve = async (alertId: string, reason?: string) => {
    try {
      await deadStockAPI.resolveAlert(alertId, reason || 'Manually resolved');
      await fetchAlerts();
      setSelectedAlert(null);
    } catch (err: any) {
      alert('Failed to resolve alert: ' + err.message);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getSeverityBadge = (severity: string) => {
    if (severity === 'critical') {
      return <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-semibold">Critical</span>;
    }
    return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-semibold">Warning</span>;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">Open</span>;
      case 'acknowledged':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">Acknowledged</span>;
      case 'resolved':
        return <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Resolved</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs">{status}</span>;
    }
  };

  const filteredAlerts = alerts.filter((alert) => {
    if (statusFilter !== 'all' && alert.status !== statusFilter) return false;
    if (severityFilter !== 'all' && alert.severity !== severityFilter) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Dead Stock Alerts</h1>
      </div>

      {/* Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">Open Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.openAlerts}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">Critical Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{metrics.criticalAlerts}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">Stock Value at Risk</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(metrics.totalStockValueAtRisk)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">Recovery Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.recoveryRate.toFixed(1)}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">Avg Resolution Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.avgTimeToResolution.toFixed(1)} days</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">Inventory at Risk</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.inventoryAtRiskPercent.toFixed(1)}%</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border rounded px-3 py-2"
              >
                <option value="all">All</option>
                <option value="open">Open</option>
                <option value="acknowledged">Acknowledged</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Severity</label>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="border rounded px-3 py-2"
              >
                <option value="all">All</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerts Table */}
      {loading ? (
        <div className="text-center py-8">Loading alerts...</div>
      ) : error ? (
        <div className="text-center py-8 text-red-600">{error}</div>
      ) : filteredAlerts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No dead stock alerts found</div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Dead Stock Alerts ({filteredAlerts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">SKU</th>
                    <th className="text-left p-2">Product</th>
                    <th className="text-left p-2">Severity</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-right p-2">Stock Level</th>
                    <th className="text-right p-2">Stock Value</th>
                    <th className="text-right p-2">Days Since Last Sale</th>
                    <th className="text-left p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAlerts.map((alert) => (
                    <tr key={alert._id} className="border-b hover:bg-gray-50">
                      <td className="p-2 font-mono text-sm">{alert.skuId?.sku || 'N/A'}</td>
                      <td className="p-2">{alert.productId?.name || 'N/A'}</td>
                      <td className="p-2">{getSeverityBadge(alert.severity)}</td>
                      <td className="p-2">{getStatusBadge(alert.status)}</td>
                      <td className="p-2 text-right">{alert.stockLevel}</td>
                      <td className="p-2 text-right">{formatCurrency(alert.stockValue)}</td>
                      <td className="p-2 text-right">{alert.daysSinceLastSale} days</td>
                      <td className="p-2">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => setSelectedAlert(alert)}
                            className="text-xs"
                          >
                            View
                          </Button>
                          {alert.status === 'open' && (
                            <Button
                              size="sm"
                              onClick={() => handleAcknowledge(alert._id)}
                              className="text-xs bg-yellow-500"
                            >
                              Acknowledge
                            </Button>
                          )}
                          {alert.status !== 'resolved' && (
                            <Button
                              size="sm"
                              onClick={() => handleResolve(alert._id)}
                              className="text-xs bg-green-500"
                            >
                              Resolve
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alert Detail Modal */}
      {selectedAlert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Alert Details</CardTitle>
                <Button onClick={() => setSelectedAlert(null)}>Close</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold">SKU Information</h3>
                <p className="text-sm text-gray-600">SKU: {selectedAlert.skuId?.sku}</p>
                <p className="text-sm text-gray-600">Product: {selectedAlert.productId?.name}</p>
              </div>

              <div>
                <h3 className="font-semibold">Alert Details</h3>
                <p className="text-sm">Severity: {getSeverityBadge(selectedAlert.severity)}</p>
                <p className="text-sm">Status: {getStatusBadge(selectedAlert.status)}</p>
                <p className="text-sm">Stock Level: {selectedAlert.stockLevel}</p>
                <p className="text-sm">Stock Value: {formatCurrency(selectedAlert.stockValue)}</p>
                <p className="text-sm">Days Since Last Sale: {selectedAlert.daysSinceLastSale}</p>
                {selectedAlert.lastSoldAt && (
                  <p className="text-sm">Last Sold: {new Date(selectedAlert.lastSoldAt).toLocaleDateString()}</p>
                )}
              </div>

              {Object.keys(selectedAlert.suggestions).length > 0 && (
                <div>
                  <h3 className="font-semibold">Action Suggestions</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {selectedAlert.suggestions.discountPercent && (
                      <li>Apply {selectedAlert.suggestions.discountPercent}% discount</li>
                    )}
                    {selectedAlert.suggestions.liquidation && <li>Consider liquidation sale</li>}
                    {selectedAlert.suggestions.supplierReturn && <li>Return to supplier (if allowed)</li>}
                    {selectedAlert.suggestions.delist && <li>Consider delisting this SKU</li>}
                  </ul>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                {selectedAlert.status === 'open' && (
                  <Button onClick={() => handleAcknowledge(selectedAlert._id)}>Acknowledge</Button>
                )}
                {selectedAlert.status !== 'resolved' && (
                  <Button onClick={() => handleResolve(selectedAlert._id)} className="bg-green-500">
                    Resolve
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

