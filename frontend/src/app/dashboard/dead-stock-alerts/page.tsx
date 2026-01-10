'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { deadStockAPI, storeAPI } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

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
  salesVelocity?: number;
  suggestions: {
    discountPercent?: number;
    liquidation?: boolean;
    supplierReturn?: boolean;
    delist?: boolean;
    bundleWith?: string[];
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

export default function DeadStockAlertsPage() {
  const router = useRouter();
  const user = getCurrentUser();

  const [alerts, setAlerts] = useState<DeadStockAlert[]>([]);
  const [metrics, setMetrics] = useState<DeadStockMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [userStores, setUserStores] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [selectedAlert, setSelectedAlert] = useState<DeadStockAlert | null>(null);
  const [resolutionReason, setResolutionReason] = useState<string>('');

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
      fetchAlerts();
      fetchAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStoreId, statusFilter, severityFilter]);

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
      console.error('[DEAD STOCK ALERTS] Load stores error:', err);
      setError('Failed to load stores');
      setLoading(false);
    }
  };

  const fetchAlerts = async () => {
    if (!selectedStoreId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const params: any = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (severityFilter !== 'all') params.severity = severityFilter;
      params.limit = 100; // Get more alerts

      const response = await deadStockAPI.getAlerts(params);
      if (response.success) {
        setAlerts(response.data.alerts || []);
        if (response.data.metrics) {
          setMetrics(response.data.metrics);
        }
      } else {
        setError(response.message || 'Failed to load dead stock alerts');
      }
    } catch (err: any) {
      console.error('[DEAD STOCK ALERTS] Fetch error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load dead stock alerts');
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
      console.error('[DEAD STOCK ALERTS] Analytics error:', err);
    }
  };

  const handleAcknowledge = async (alertId: string) => {
    try {
      await deadStockAPI.acknowledgeAlert(alertId);
      await fetchAlerts();
      setSelectedAlert(null);
    } catch (err: any) {
      alert('Failed to acknowledge alert: ' + (err.message || 'Unknown error'));
    }
  };

  const handleResolve = async (alertId: string, reason?: string) => {
    try {
      await deadStockAPI.resolveAlert(alertId, reason || 'Manually resolved');
      await fetchAlerts();
      setSelectedAlert(null);
      setResolutionReason('');
    } catch (err: any) {
      alert('Failed to resolve alert: ' + (err.message || 'Unknown error'));
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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getSeverityBadge = (severity: string) => {
    if (severity === 'critical') {
      return (
        <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded-full text-xs font-semibold border border-red-500/30">
          Critical
        </span>
      );
    }
    return (
      <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs font-semibold border border-yellow-500/30">
        Warning
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return (
          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-semibold border border-blue-500/30">
            Open
          </span>
        );
      case 'acknowledged':
        return (
          <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs font-semibold border border-yellow-500/30">
            Acknowledged
          </span>
        );
      case 'resolved':
        return (
          <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-semibold border border-green-500/30">
            Resolved
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 bg-gray-500/20 text-gray-400 rounded-full text-xs font-semibold border border-gray-500/30">
            {status}
          </span>
        );
    }
  };

  const filteredAlerts = alerts.filter((alert) => {
    if (statusFilter !== 'all' && alert.status !== statusFilter) return false;
    if (severityFilter !== 'all' && alert.severity !== severityFilter) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading dead stock alerts...</p>
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
            <h1 className="text-3xl font-bold text-white mb-2">Dead Stock Alerts</h1>
            <p className="text-text-secondary">Monitor and manage slow-moving inventory</p>
          </div>
          <div className="flex gap-4">
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
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* Metrics Cards */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <Card className="bg-surface border-border">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-text-secondary">Open Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{metrics.openAlerts}</div>
                <p className="text-xs text-text-muted mt-1">Requires attention</p>
              </CardContent>
            </Card>

            <Card className="bg-surface border-border">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-text-secondary">Critical Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-400">{metrics.criticalAlerts}</div>
                <p className="text-xs text-text-muted mt-1">Urgent action needed</p>
              </CardContent>
            </Card>

            <Card className="bg-surface border-border">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-text-secondary">Stock Value at Risk</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{formatCurrency(metrics.totalStockValueAtRisk)}</div>
                <p className="text-xs text-text-muted mt-1">Capital tied up</p>
              </CardContent>
            </Card>

            <Card className="bg-surface border-border">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-text-secondary">Recovery Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-400">{metrics.recoveryRate.toFixed(1)}%</div>
                <p className="text-xs text-text-muted mt-1">Alerts resolved</p>
              </CardContent>
            </Card>

            <Card className="bg-surface border-border">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-text-secondary">Avg Resolution Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{metrics.avgTimeToResolution.toFixed(1)} days</div>
                <p className="text-xs text-text-muted mt-1">Time to resolve</p>
              </CardContent>
            </Card>

            <Card className="bg-surface border-border">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-text-secondary">Inventory at Risk</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-400">{metrics.inventoryAtRiskPercent.toFixed(1)}%</div>
                <p className="text-xs text-text-muted mt-1">Of total inventory</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="bg-surface border-border">
          <CardHeader>
            <CardTitle className="text-white">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-text-secondary mb-2">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="all">All Statuses</option>
                  <option value="open">Open</option>
                  <option value="acknowledged">Acknowledged</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-text-secondary mb-2">Severity</label>
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="all">All Severities</option>
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alerts Table */}
        {loading ? (
          <div className="text-center py-12 text-text-secondary">Loading alerts...</div>
        ) : error && filteredAlerts.length === 0 ? (
          <div className="text-center py-12 text-red-400">{error}</div>
        ) : filteredAlerts.length === 0 ? (
          <Card className="bg-surface border-border">
            <CardContent className="p-12">
              <div className="text-center text-text-secondary">
                <p className="text-lg font-medium mb-2">No dead stock alerts found</p>
                <p className="text-sm">Great! Your inventory is moving well.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-surface border-border">
            <CardHeader>
              <CardTitle className="text-white">Dead Stock Alerts ({filteredAlerts.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary">SKU</th>
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary">Product</th>
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary">Severity</th>
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary">Status</th>
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary text-right">Stock Level</th>
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary text-right">Stock Value</th>
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary text-right">Days Since Last Sale</th>
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAlerts.map((alert) => (
                      <tr key={alert._id} className="border-b border-border hover:bg-muted/20">
                        <td className="py-3 px-4 text-text-primary font-mono text-sm">
                          {alert.skuId?.sku || 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-text-secondary">
                          {alert.productId?.name || 'N/A'}
                        </td>
                        <td className="py-3 px-4">{getSeverityBadge(alert.severity)}</td>
                        <td className="py-3 px-4">{getStatusBadge(alert.status)}</td>
                        <td className="py-3 px-4 text-right text-text-primary font-medium">
                          {alert.stockLevel.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right text-text-primary font-medium">
                          {formatCurrency(alert.stockValue)}
                        </td>
                        <td className="py-3 px-4 text-right text-text-secondary">
                          {alert.daysSinceLastSale} days
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setSelectedAlert(alert)}
                            >
                              View
                            </Button>
                            {alert.status === 'open' && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleAcknowledge(alert._id)}
                              >
                                Acknowledge
                              </Button>
                            )}
                            {alert.status !== 'resolved' && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => {
                                  setSelectedAlert(alert);
                                  setResolutionReason('');
                                }}
                                className="bg-green-600 hover:bg-green-700"
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
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-surface border-border">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-white">Alert Details</CardTitle>
                  <Button variant="secondary" onClick={() => setSelectedAlert(null)}>
                    Close
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold text-white mb-2">SKU Information</h3>
                  <div className="space-y-1 text-sm">
                    <p className="text-text-secondary">
                      <span className="font-medium">SKU:</span> {selectedAlert.skuId?.sku || 'N/A'}
                    </p>
                    <p className="text-text-secondary">
                      <span className="font-medium">Product:</span> {selectedAlert.productId?.name || 'N/A'}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-white mb-2">Alert Details</h3>
                  <div className="space-y-1 text-sm">
                    <p className="text-text-secondary">
                      <span className="font-medium">Severity:</span> {getSeverityBadge(selectedAlert.severity)}
                    </p>
                    <p className="text-text-secondary">
                      <span className="font-medium">Status:</span> {getStatusBadge(selectedAlert.status)}
                    </p>
                    <p className="text-text-secondary">
                      <span className="font-medium">Stock Level:</span> {selectedAlert.stockLevel.toLocaleString()} units
                    </p>
                    <p className="text-text-secondary">
                      <span className="font-medium">Stock Value:</span> {formatCurrency(selectedAlert.stockValue)}
                    </p>
                    <p className="text-text-secondary">
                      <span className="font-medium">Days Since Last Sale:</span> {selectedAlert.daysSinceLastSale} days
                    </p>
                    {selectedAlert.lastSoldAt && (
                      <p className="text-text-secondary">
                        <span className="font-medium">Last Sold:</span> {formatDate(selectedAlert.lastSoldAt)}
                      </p>
                    )}
                    {selectedAlert.salesVelocity !== undefined && (
                      <p className="text-text-secondary">
                        <span className="font-medium">Sales Velocity:</span> {selectedAlert.salesVelocity.toFixed(2)} units/day
                      </p>
                    )}
                    <p className="text-text-secondary">
                      <span className="font-medium">Alert Created:</span> {formatDate(selectedAlert.createdAt)}
                    </p>
                  </div>
                </div>

                {Object.keys(selectedAlert.suggestions).length > 0 && (
                  <div>
                    <h3 className="font-semibold text-white mb-2">Action Suggestions</h3>
                    <ul className="list-disc list-inside space-y-1 text-sm text-text-secondary">
                      {selectedAlert.suggestions.discountPercent && (
                        <li>Apply {selectedAlert.suggestions.discountPercent}% discount to boost sales</li>
                      )}
                      {selectedAlert.suggestions.liquidation && (
                        <li>Consider liquidation sale to clear inventory</li>
                      )}
                      {selectedAlert.suggestions.supplierReturn && (
                        <li>Return to supplier (if return policy allows)</li>
                      )}
                      {selectedAlert.suggestions.delist && (
                        <li>Consider delisting this SKU from storefront</li>
                      )}
                      {selectedAlert.suggestions.bundleWith && selectedAlert.suggestions.bundleWith.length > 0 && (
                        <li>Bundle with other products to increase value</li>
                      )}
                    </ul>
                  </div>
                )}

                <div className="flex gap-2 pt-4 border-t border-border">
                  {selectedAlert.status === 'open' && (
                    <Button onClick={() => handleAcknowledge(selectedAlert._id)} variant="primary">
                      Acknowledge Alert
                    </Button>
                  )}
                  {selectedAlert.status !== 'resolved' && (
                    <div className="flex-1 flex gap-2">
                      <Input
                        type="text"
                        placeholder="Resolution reason (optional)"
                        value={resolutionReason}
                        onChange={(e) => setResolutionReason(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        onClick={() => handleResolve(selectedAlert._id, resolutionReason)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Resolve Alert
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

