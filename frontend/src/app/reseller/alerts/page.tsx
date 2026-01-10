'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getResellerMarginAlerts, MarginAlert } from '@/lib/resellerAlerts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

export default function ResellerAlertsPage() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<MarginAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('');

  const currentUser = getCurrentUser();

  useEffect(() => {
    if (currentUser?.role !== 'reseller') {
      router.push('/unauthorized');
      return;
    }
    loadAlerts();
  }, [currentUser, router, statusFilter, severityFilter]);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      if (severityFilter) params.severity = severityFilter;

      const response = await getResellerMarginAlerts(params);

      if (response.success) {
        setAlerts(response.alerts || []);
      } else {
        setError('Failed to load margin alerts');
      }
    } catch (err: any) {
      console.error('[RESELLER ALERTS] Load error:', err);
      setError(err.message || 'Failed to load margin alerts');
    } finally {
      setLoading(false);
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
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Margin Alerts</h1>
        <p className="text-text-secondary">Monitor your product margins and pricing risks</p>
      </div>

      {/* Error Message */}
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
          </div>
        </CardContent>
      </Card>

      {/* Alerts List */}
      <Card className="bg-surface border-border">
        <CardHeader>
          <CardTitle className="text-white">Your Margin Alerts</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-text-secondary">Loading...</div>
          ) : alerts.length === 0 ? (
            <div className="p-8 text-center text-text-secondary">No margin alerts found</div>
          ) : (
            <div className="divide-y divide-border">
              {alerts.map((alert) => {
                const priceIncrease = calculatePriceIncrease(alert);
                return (
                  <div key={alert._id} className="p-6 hover:bg-background/50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span
                            className={cn(
                              'px-2 py-1 text-xs font-medium rounded-full border',
                              getSeverityColor(alert.severity)
                            )}
                          >
                            {alert.severity.toUpperCase()}
                          </span>
                          <span className="text-sm text-text-secondary">
                            {getAlertTypeLabel(alert.alertType)}
                          </span>
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
                        </div>
                        <p className="text-white mb-3">{alert.message}</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="text-text-secondary">Current Margin</div>
                            <div className="text-white font-semibold">
                              ₹{alert.currentMargin.toFixed(2)} ({alert.currentMarginPercent.toFixed(1)}%)
                            </div>
                          </div>
                          <div>
                            <div className="text-text-secondary">Expected Min</div>
                            <div className="text-white font-semibold">
                              ₹{alert.expectedMinMargin.toFixed(2)} ({alert.expectedMinMarginPercent.toFixed(1)}%)
                            </div>
                          </div>
                          <div>
                            <div className="text-text-secondary">Deviation</div>
                            <div
                              className={cn(
                                'font-semibold',
                                alert.deviationPercentage < 0 ? 'text-red-400' : 'text-green-400'
                              )}
                            >
                              {alert.deviationPercentage >= 0 ? '+' : ''}
                              {alert.deviationPercentage.toFixed(1)}%
                            </div>
                          </div>
                          {priceIncrease !== null && (
                            <div>
                              <div className="text-text-secondary">Recommended Increase</div>
                              <div className="text-yellow-400 font-semibold">
                                ₹{priceIncrease.toFixed(2)}
                              </div>
                            </div>
                          )}
                        </div>
                        {priceIncrease !== null && (
                          <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                            <p className="text-yellow-400 text-sm">
                              💡 <strong>Guidance:</strong> Consider increasing price by ₹
                              {priceIncrease.toFixed(2)} to meet minimum margin requirements.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

