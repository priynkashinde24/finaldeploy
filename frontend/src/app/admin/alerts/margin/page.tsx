'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import {
  getAdminMarginAlerts,
  acknowledgeMarginAlert,
  resolveMarginAlert,
  MarginAlert,
} from '@/lib/adminAlerts';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

export default function AdminMarginAlertsPage() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<MarginAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [alertTypeFilter, setAlertTypeFilter] = useState<string>('');

  const currentUser = getCurrentUser();

  useEffect(() => {
    if (currentUser?.role !== 'admin') {
      router.push('/unauthorized');
      return;
    }
    loadAlerts();
  }, [currentUser, router, statusFilter, severityFilter, alertTypeFilter]);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      if (severityFilter) params.severity = severityFilter;
      if (alertTypeFilter) params.alertType = alertTypeFilter;

      const response = await getAdminMarginAlerts(params);

      if (response.success) {
        setAlerts(response.alerts || []);
      } else {
        setError('Failed to load margin alerts');
      }
    } catch (err: any) {
      console.error('[ADMIN ALERTS] Load error:', err);
      setError(err.message || 'Failed to load margin alerts');
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (id: string) => {
    try {
      setActionLoading(id);
      setError(null);

      const response = await acknowledgeMarginAlert(id);

      if (response.success) {
        setSuccessMessage('Alert acknowledged successfully');
        loadAlerts();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError('Failed to acknowledge alert');
      }
    } catch (err: any) {
      console.error('[ADMIN ALERTS] Acknowledge error:', err);
      setError(err.message || 'Failed to acknowledge alert');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolve = async (id: string) => {
    if (!confirm('Are you sure you want to resolve this alert? This action cannot be undone.')) {
      return;
    }

    try {
      setActionLoading(id);
      setError(null);

      const response = await resolveMarginAlert(id);

      if (response.success) {
        setSuccessMessage('Alert resolved successfully');
        loadAlerts();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError('Failed to resolve alert');
      }
    } catch (err: any) {
      console.error('[ADMIN ALERTS] Resolve error:', err);
      setError(err.message || 'Failed to resolve alert');
    } finally {
      setActionLoading(null);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'low':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const getAlertTypeLabel = (type: string) => {
    switch (type) {
      case 'below_min_markup':
        return 'Below Min Markup';
      case 'near_min_markup':
        return 'Near Min Markup';
      case 'abnormally_high_markup':
        return 'Abnormally High';
      case 'sudden_margin_drop':
        return 'Sudden Drop';
      default:
        return type;
    }
  };

  const getScopeLabel = (scope: string, scopeId?: string | null) => {
    if (scope === 'reseller') return 'Reseller';
    if (!scopeId) return scope.charAt(0).toUpperCase() + scope.slice(1);
    return `${scope.charAt(0).toUpperCase() + scope.slice(1)} (${scopeId.substring(0, 8)}...)`;
  };

  const calculatePriceIncrease = (alert: MarginAlert): number | null => {
    if (alert.metadata?.supplierCost && alert.expectedMinMargin > alert.currentMargin) {
      const shortfall = alert.expectedMinMargin - alert.currentMargin;
      return shortfall;
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Margin Alerts</h1>
          <p className="text-text-secondary">Monitor margin risks and pricing issues</p>
        </div>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400">
          {successMessage}
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Filters */}
      <Card className="bg-surface border-border">
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-text-secondary mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white"
              >
                <option value="">All Status</option>
                <option value="open">Open</option>
                <option value="acknowledged">Acknowledged</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-text-secondary mb-2">Severity</label>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white"
              >
                <option value="">All Severities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-text-secondary mb-2">Alert Type</label>
              <select
                value={alertTypeFilter}
                onChange={(e) => setAlertTypeFilter(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white"
              >
                <option value="">All Types</option>
                <option value="below_min_markup">Below Min Markup</option>
                <option value="near_min_markup">Near Min Markup</option>
                <option value="abnormally_high_markup">Abnormally High</option>
                <option value="sudden_margin_drop">Sudden Drop</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerts Table */}
      <Card className="bg-surface border-border">
        <CardHeader>
          <CardTitle className="text-white">Margin Alerts</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-text-secondary">Loading...</div>
          ) : alerts.length === 0 ? (
            <div className="p-8 text-center text-text-secondary">No margin alerts found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-background border-b border-border">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Severity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Alert Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Scope
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Reseller
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Current Margin
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Expected Margin
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {alerts.map((alert) => {
                    const priceIncrease = calculatePriceIncrease(alert);
                    return (
                      <tr key={alert._id} className="hover:bg-background/50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={cn(
                              'px-2 py-1 text-xs font-medium rounded-full border',
                              getSeverityColor(alert.severity)
                            )}
                          >
                            {alert.severity.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                          {getAlertTypeLabel(alert.alertType)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                          {getScopeLabel(alert.scope, alert.scopeId)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                          {alert.resellerId ? alert.resellerId.name : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                          <div>
                            <div>₹{alert.currentMargin.toFixed(2)}</div>
                            <div className="text-xs text-text-secondary">
                              ({alert.currentMarginPercent.toFixed(1)}%)
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                          <div>
                            <div>₹{alert.expectedMinMargin.toFixed(2)}</div>
                            <div className="text-xs text-text-secondary">
                              ({alert.expectedMinMarginPercent.toFixed(1)}%)
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={cn(
                              'px-2 py-1 text-xs font-medium rounded-full',
                              alert.status === 'open'
                                ? 'bg-yellow-500/10 text-yellow-400'
                                : alert.status === 'acknowledged'
                                ? 'bg-blue-500/10 text-blue-400'
                                : 'bg-green-500/10 text-green-400'
                            )}
                          >
                            {alert.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex flex-col gap-2">
                            {priceIncrease !== null && (
                              <div className="text-xs text-yellow-400 mb-1">
                                Increase by ₹{priceIncrease.toFixed(2)}
                              </div>
                            )}
                            <div className="flex gap-2">
                              {alert.status === 'open' && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleAcknowledge(alert._id)}
                                  disabled={actionLoading === alert._id}
                                >
                                  {actionLoading === alert._id ? 'Acknowledging...' : 'Acknowledge'}
                                </Button>
                              )}
                              {alert.status !== 'resolved' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleResolve(alert._id)}
                                  disabled={actionLoading === alert._id}
                                  className="border-green-500/50 text-green-400 hover:bg-green-500/10"
                                >
                                  {actionLoading === alert._id ? 'Resolving...' : 'Resolve'}
                                </Button>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alert Details Modal (optional - can be added later) */}
    </div>
  );
}

