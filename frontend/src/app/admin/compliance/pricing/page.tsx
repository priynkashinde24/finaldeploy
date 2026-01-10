'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import {
  getComplianceSummary,
  getComplianceViolations,
  getComplianceTrends,
  ComplianceSummary,
  ComplianceViolation,
  ComplianceTrends,
} from '@/lib/compliance';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export default function AdminComplianceDashboardPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<ComplianceSummary | null>(null);
  const [violations, setViolations] = useState<ComplianceViolation[]>([]);
  const [trends, setTrends] = useState<ComplianceTrends | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [brandFilter, setBrandFilter] = useState<string>('');
  const [regionFilter, setRegionFilter] = useState<string>('');
  const [resellerFilter, setResellerFilter] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('');

  const currentUser = getCurrentUser();

  useEffect(() => {
    if (currentUser?.role !== 'admin') {
      router.push('/unauthorized');
      return;
    }
    loadData();
  }, [currentUser, router, brandFilter, regionFilter, resellerFilter, severityFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {};
      if (brandFilter) params.brandId = brandFilter;
      if (regionFilter) params.regionId = regionFilter;
      if (resellerFilter) params.resellerId = resellerFilter;
      if (severityFilter) params.severity = severityFilter;

      const [summaryRes, violationsRes, trendsRes] = await Promise.all([
        getComplianceSummary(params),
        getComplianceViolations({ ...params, limit: 100 }),
        getComplianceTrends({ days: 30 }),
      ]);

      if (summaryRes.success) {
        setSummary(summaryRes.data);
      }
      if (violationsRes.success) {
        setViolations(violationsRes.violations || []);
      }
      if (trendsRes.success) {
        setTrends(trendsRes.data);
      }
    } catch (err: any) {
      console.error('[COMPLIANCE] Load error:', err);
      setError(err.message || 'Failed to load compliance data');
    } finally {
      setLoading(false);
    }
  };

  const getComplianceColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-400';
    if (percentage >= 70) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getComplianceBgColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-green-500/10 border-green-500/20';
    if (percentage >= 70) return 'bg-yellow-500/10 border-yellow-500/20';
    return 'bg-red-500/10 border-red-500/20';
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Pricing Compliance Dashboard</h1>
          <p className="text-text-secondary">Monitor pricing health, violations, and trends</p>
        </div>
        <Button variant="secondary" size="md" onClick={loadData} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className={cn('bg-surface border-border', getComplianceBgColor(summary.totals.compliantPercentage))}>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-text-secondary">Overall Compliance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn('text-3xl font-bold mb-1', getComplianceColor(summary.totals.compliantPercentage))}>
                {summary.totals.compliantPercentage.toFixed(1)}%
              </div>
              <p className="text-xs text-text-muted">
                {summary.totals.products} products evaluated
              </p>
            </CardContent>
          </Card>

          <Card className="bg-surface border-border bg-yellow-500/10 border-yellow-500/20">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-text-secondary">Products at Risk</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-400 mb-1">
                {summary.totals.nearRiskPercentage.toFixed(1)}%
              </div>
              <p className="text-xs text-text-muted">
                Near minimum margin threshold
              </p>
            </CardContent>
          </Card>

          <Card className="bg-surface border-border bg-red-500/10 border-red-500/20">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-text-secondary">Active Violations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-400 mb-1">
                {summary.totals.violationPercentage.toFixed(1)}%
              </div>
              <p className="text-xs text-text-muted">
                {summary.alertsSummary.open} open alerts
              </p>
            </CardContent>
          </Card>

          <Card className="bg-surface border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-text-secondary">Average Margin</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white mb-1">
                {summary.marginStats.averageMargin.toFixed(1)}%
              </div>
              <p className="text-xs text-text-muted">
                Across all products
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="bg-surface border-border">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Brand</label>
              <select
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white"
              >
                <option value="">All Brands</option>
                {summary?.marginStats.byBrand.map((brand) => (
                  <option key={brand.brandId} value={brand.brandId}>
                    {brand.brandName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Region</label>
              <select
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white"
              >
                <option value="">All Regions</option>
                {/* Regions would be populated from API */}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Reseller</label>
              <select
                value={resellerFilter}
                onChange={(e) => setResellerFilter(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white"
              >
                <option value="">All Resellers</option>
                {/* Resellers would be populated from API */}
              </select>
            </div>
            <div>
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

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compliance by Brand */}
        {summary && summary.marginStats.byBrand.length > 0 && (
          <Card className="bg-surface border-border">
            <CardHeader>
              <CardTitle className="text-white">Compliance by Brand</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {summary.marginStats.byBrand.map((brand) => (
                  <div key={brand.brandId}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-white">{brand.brandName}</span>
                      <span className="text-sm text-text-secondary">
                        {brand.averageMargin.toFixed(1)}% ({brand.productCount} products)
                      </span>
                    </div>
                    <div className="w-full bg-background rounded-full h-2">
                      <div
                        className={cn(
                          'h-2 rounded-full',
                          brand.averageMargin >= 20
                            ? 'bg-green-500'
                            : brand.averageMargin >= 10
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        )}
                        style={{ width: `${Math.min(100, (brand.averageMargin / 50) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Margin Distribution */}
        {trends && (
          <Card className="bg-surface border-border">
            <CardHeader>
              <CardTitle className="text-white">Margin Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(trends.marginDistribution).map(([bucket, count]) => (
                  <div key={bucket}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-white">{bucket}</span>
                      <span className="text-sm text-text-secondary">{count} products</span>
                    </div>
                    <div className="w-full bg-background rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-blue-500"
                        style={{
                          width: `${
                            Math.max(
                              5,
                              (count / Math.max(...Object.values(trends.marginDistribution))) * 100
                            )
                          }%`
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Margin Trend Chart (Simple Line) */}
      {trends && trends.timeSeries.length > 0 && (
        <Card className="bg-surface border-border">
          <CardHeader>
            <CardTitle className="text-white">Margin Trend (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-end gap-1">
              {trends.timeSeries.slice(-30).map((point, index) => {
                const maxMargin = Math.max(...trends.timeSeries.map((p) => p.avgMargin));
                return (
                  <div
                    key={index}
                    className="flex-1 flex flex-col items-center group"
                    title={`${point.date}: ${point.avgMargin.toFixed(1)}%`}
                  >
                    <div
                      className="w-full bg-blue-500 rounded-t hover:bg-blue-400 transition-colors"
                      style={{
                        height: `${Math.max(5, (point.avgMargin / maxMargin) * 100)}%`,
                      }}
                    />
                    {index % 5 === 0 && (
                      <span className="text-xs text-text-secondary mt-1 transform -rotate-45 origin-left">
                        {new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Violations Table */}
      <Card className="bg-surface border-border">
        <CardHeader>
          <CardTitle className="text-white">Pricing Violations</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-text-secondary">Loading...</div>
          ) : violations.length === 0 ? (
            <div className="p-8 text-center text-text-secondary">No violations found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-background border-b border-border">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Severity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Brand
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Reseller
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Current Margin
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Min Required
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Deviation
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Rule
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {violations.map((violation, index) => (
                    <tr key={index} className="hover:bg-background/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={cn(
                            'px-2 py-1 text-xs font-medium rounded-full border',
                            getSeverityColor(violation.severity)
                          )}
                        >
                          {violation.severity.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        {violation.productName}
                        {violation.variantId && (
                          <span className="text-text-secondary ml-1">(Variant)</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                        {violation.brandName || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                        {violation.resellerName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        <div>
                          <div>₹{violation.currentMargin.toFixed(2)}</div>
                          <div className="text-xs text-text-secondary">
                            ({violation.currentMarginPercent.toFixed(1)}%)
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        <div>
                          <div>₹{violation.requiredMinMargin.toFixed(2)}</div>
                          <div className="text-xs text-text-secondary">
                            ({violation.requiredMinMarginPercent.toFixed(1)}%)
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span
                          className={cn(
                            violation.deviationPercentage < 0 ? 'text-red-400' : 'text-green-400'
                          )}
                        >
                          {violation.deviationPercentage >= 0 ? '+' : ''}
                          {violation.deviationPercentage.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                        {violation.ruleViolated}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

