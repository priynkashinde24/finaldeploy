'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import {
  getPricingInsights,
  PricingInsight,
} from '@/lib/adminPricingInsights';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';

export default function AdminPricingInsightsPage() {
  const router = useRouter();
  const [insights, setInsights] = useState<PricingInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [scopeFilter, setScopeFilter] = useState<'product' | 'variant' | ''>('');
  const [showExpired, setShowExpired] = useState(false);

  // Modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState<PricingInsight | null>(null);

  const currentUser = getCurrentUser();

  useEffect(() => {
    if (currentUser?.role !== 'admin') {
      router.push('/unauthorized');
      return;
    }
    loadInsights();
  }, [currentUser, router, scopeFilter, showExpired]);

  const loadInsights = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await getPricingInsights({
        scope: scopeFilter || undefined,
        expired: showExpired,
      });

      if (response.success && response.data) {
        setInsights(response.data.insights);
      } else {
        setError(response.message || 'Failed to load pricing insights');
      }
    } catch (err: any) {
      console.error('[PRICING INSIGHTS] Load error:', err);
      setError(err.message || 'Failed to load pricing insights');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (insight: PricingInsight) => {
    setSelectedInsight(insight);
    setShowDetailModal(true);
  };

  const handleApplyPrice = (insight: PricingInsight) => {
    // Navigate to product/variant edit page with suggested price
    if (insight.scope === 'product') {
      router.push(`/admin/products/${insight.scopeId}/edit?suggestedPrice=${insight.suggestedPrice}`);
    } else {
      // For variants, navigate to variant edit or product page
      router.push(`/admin/products?variantId=${insight.scopeId}&suggestedPrice=${insight.suggestedPrice}`);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getPriceChangePercent = (current: number, suggested: number) => {
    return ((suggested - current) / current) * 100;
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 70) return 'text-green-400';
    if (score >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getConfidenceBadgeColor = (score: number) => {
    if (score >= 70) return 'bg-green-500/20 text-green-400';
    if (score >= 50) return 'bg-yellow-500/20 text-yellow-400';
    return 'bg-red-500/20 text-red-400';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Pricing Insights</h1>
          <p className="text-text-secondary">
            AI-generated pricing suggestions based on sales, demand, stock, and margin data
          </p>
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
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-white mb-2">Scope</label>
              <select
                value={scopeFilter}
                onChange={(e) => setScopeFilter(e.target.value as 'product' | 'variant' | '')}
                className="w-full px-4 py-2 rounded-lg bg-[#0B0B0B] border border-[#242424] text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              >
                <option value="">All Scopes</option>
                <option value="product">Products</option>
                <option value="variant">Variants</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showExpired}
                  onChange={(e) => setShowExpired(e.target.checked)}
                  className="w-4 h-4 rounded border-[#242424] bg-[#0B0B0B] text-primary focus:ring-2 focus:ring-[#D4AF37]"
                />
                <span className="text-sm text-white">Show expired insights</span>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Insights Table */}
      <Card className="bg-surface border-border">
        <CardHeader>
          <CardTitle>Pricing Insights ({insights.length} total)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-text-secondary">Loading pricing insights...</p>
            </div>
          ) : insights.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-text-secondary">
                No pricing insights found. Insights are generated automatically or can be triggered manually.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#242424]">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Product / Variant</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Current Price</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Suggested Price</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Change</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Confidence</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Reason</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-white">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {insights.map((insight) => {
                    const priceChange = getPriceChangePercent(insight.currentPrice, insight.suggestedPrice);
                    const isExpired = new Date(insight.expiresAt) < new Date();

                    return (
                      <tr
                        key={insight._id}
                        className={cn(
                          'border-b border-[#242424] hover:bg-[#1A1A1A] transition-colors',
                          isExpired && 'opacity-50'
                        )}
                      >
                        <td className="py-3 px-4">
                          <div>
                            <div className="text-white font-medium">{insight.scopeName || 'Unknown'}</div>
                            <div className="text-text-secondary text-xs">
                              {insight.scopeSku && `SKU: ${insight.scopeSku}`}
                              {insight.scope === 'variant' && ' (Variant)'}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-white">{formatCurrency(insight.currentPrice)}</td>
                        <td className="py-3 px-4 text-white font-semibold">
                          {formatCurrency(insight.suggestedPrice)}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={cn(
                              'px-2 py-1 rounded text-xs font-semibold',
                              priceChange > 0
                                ? 'bg-green-500/20 text-green-400'
                                : priceChange < 0
                                  ? 'bg-red-500/20 text-red-400'
                                  : 'bg-gray-500/20 text-gray-400'
                            )}
                          >
                            {priceChange > 0 ? '+' : ''}
                            {priceChange.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={cn('px-2 py-1 rounded text-xs font-semibold', getConfidenceBadgeColor(insight.confidenceScore))}>
                            {insight.confidenceScore}%
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="max-w-xs truncate text-text-secondary text-sm" title={insight.suggestionReason}>
                            {insight.suggestionReason}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetails(insight)}
                              className="text-blue-400 hover:text-blue-300"
                            >
                              Details
                            </Button>
                            {!isExpired && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleApplyPrice(insight)}
                              >
                                Apply Price
                              </Button>
                            )}
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

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedInsight(null);
        }}
        title="Pricing Insight Details"
        size="lg"
      >
        {selectedInsight && (
          <div className="space-y-6">
            {/* Basic Info */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Product Information</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Name:</span>
                  <span className="text-white">{selectedInsight.scopeName || 'Unknown'}</span>
                </div>
                {selectedInsight.scopeSku && (
                  <div className="flex justify-between">
                    <span className="text-text-secondary">SKU:</span>
                    <span className="text-white">{selectedInsight.scopeSku}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-text-secondary">Scope:</span>
                  <span className="text-white capitalize">{selectedInsight.scope}</span>
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Pricing</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Current Price:</span>
                  <span className="text-white font-semibold">{formatCurrency(selectedInsight.currentPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Suggested Price:</span>
                  <span className="text-white font-semibold text-green-400">
                    {formatCurrency(selectedInsight.suggestedPrice)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Change:</span>
                  <span
                    className={cn(
                      'font-semibold',
                      getPriceChangePercent(selectedInsight.currentPrice, selectedInsight.suggestedPrice) > 0
                        ? 'text-green-400'
                        : 'text-red-400'
                    )}
                  >
                    {getPriceChangePercent(selectedInsight.currentPrice, selectedInsight.suggestedPrice) > 0
                      ? '+'
                      : ''}
                    {getPriceChangePercent(selectedInsight.currentPrice, selectedInsight.suggestedPrice).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Confidence Score:</span>
                  <span className={cn('font-semibold', getConfidenceColor(selectedInsight.confidenceScore))}>
                    {selectedInsight.confidenceScore}%
                  </span>
                </div>
              </div>
            </div>

            {/* Metrics Snapshot */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Metrics Snapshot</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-text-secondary">Avg Daily Orders:</span>
                  <span className="text-white ml-2">{selectedInsight.metricsSnapshot.avgDailyOrders.toFixed(1)}</span>
                </div>
                <div>
                  <span className="text-text-secondary">Stock Level:</span>
                  <span className="text-white ml-2">{selectedInsight.metricsSnapshot.stockLevel}</span>
                </div>
                <div>
                  <span className="text-text-secondary">Stock Velocity:</span>
                  <span className="text-white ml-2">
                    {selectedInsight.metricsSnapshot.stockVelocity.toFixed(1)} days
                  </span>
                </div>
                <div>
                  <span className="text-text-secondary">Avg Margin:</span>
                  <span className="text-white ml-2">
                    {selectedInsight.metricsSnapshot.avgMargin.toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span className="text-text-secondary">Price Elasticity:</span>
                  <span className="text-white ml-2">
                    {selectedInsight.metricsSnapshot.priceElasticityScore.toFixed(0)}/100
                  </span>
                </div>
              </div>
            </div>

            {/* Expected Impact */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Expected Impact</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Sales Change:</span>
                  <span
                    className={cn(
                      'font-semibold capitalize',
                      selectedInsight.expectedImpact.salesChange === 'increase'
                        ? 'text-green-400'
                        : selectedInsight.expectedImpact.salesChange === 'decrease'
                          ? 'text-red-400'
                          : 'text-gray-400'
                    )}
                  >
                    {selectedInsight.expectedImpact.salesChange}
                    {selectedInsight.expectedImpact.estimatedSalesChangePercent !== undefined &&
                      ` (${selectedInsight.expectedImpact.estimatedSalesChangePercent > 0 ? '+' : ''}${selectedInsight.expectedImpact.estimatedSalesChangePercent.toFixed(1)}%)`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Margin Change:</span>
                  <span
                    className={cn(
                      'font-semibold capitalize',
                      selectedInsight.expectedImpact.marginChange === 'increase'
                        ? 'text-green-400'
                        : selectedInsight.expectedImpact.marginChange === 'decrease'
                          ? 'text-red-400'
                          : 'text-gray-400'
                    )}
                  >
                    {selectedInsight.expectedImpact.marginChange}
                    {selectedInsight.expectedImpact.estimatedMarginChangePercent !== undefined &&
                      ` (${selectedInsight.expectedImpact.estimatedMarginChangePercent > 0 ? '+' : ''}${selectedInsight.expectedImpact.estimatedMarginChangePercent.toFixed(1)}%)`}
                  </span>
                </div>
              </div>
            </div>

            {/* Admin Constraints */}
            {selectedInsight.adminConstraints.minPrice !== null ||
              selectedInsight.adminConstraints.maxPrice !== null ? (
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">Admin Pricing Rules</h3>
                  <div className="space-y-2 text-sm">
                    {selectedInsight.adminConstraints.minPrice !== null && (
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Minimum Price:</span>
                        <span className="text-white">{formatCurrency(selectedInsight.adminConstraints.minPrice)}</span>
                      </div>
                    )}
                    {selectedInsight.adminConstraints.maxPrice !== null && (
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Maximum Price:</span>
                        <span className="text-white">{formatCurrency(selectedInsight.adminConstraints.maxPrice)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Within Limits:</span>
                      <span
                        className={cn(
                          'font-semibold',
                          selectedInsight.adminConstraints.withinLimits ? 'text-green-400' : 'text-red-400'
                        )}
                      >
                        {selectedInsight.adminConstraints.withinLimits ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}

            {/* Reason */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Suggestion Reason</h3>
              <p className="text-text-secondary text-sm">{selectedInsight.suggestionReason}</p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-[#242424]">
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  handleApplyPrice(selectedInsight);
                  setShowDetailModal(false);
                }}
                className="flex-1"
              >
                Apply Suggested Price
              </Button>
              <Button
                variant="ghost"
                size="md"
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedInsight(null);
                }}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

