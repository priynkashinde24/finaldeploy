'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout';
import { Button, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Footer } from '@/components/marketing';
import { pricingAPI } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Override {
  _id: string;
  sku: string;
  markupPercent: number;
  createdAt: string;
  updatedAt: string;
}

export default function PricingPage() {
  const params = useParams();
  const router = useRouter();
  const storeId = params.id as string;
  const [globalMarkup, setGlobalMarkup] = useState<string>('');
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [newOverride, setNewOverride] = useState({ sku: '', markupPercent: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchPricingRules();
  }, [storeId]);

  const fetchPricingRules = async () => {
    try {
      setLoading(true);
      const response = await pricingAPI.getStoreRules(storeId);

      if (response.success && response.data) {
        setGlobalMarkup(response.data.globalMarkup?.toString() || '');
        setOverrides(response.data.overrides || []);
      } else {
        setError(response.message || 'Failed to load pricing rules');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load pricing rules');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGlobalMarkup = async () => {
    const markup = parseFloat(globalMarkup);
    if (isNaN(markup) || markup < -100) {
      setError('Please enter a valid markup percentage (minimum -100%)');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      const response = await pricingAPI.setGlobalMarkup(storeId, markup);

      if (response.success) {
        setSuccessMessage('Global markup saved successfully!');
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(response.message || 'Failed to save global markup');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save global markup');
    } finally {
      setSaving(false);
    }
  };

  const handleAddOverride = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newOverride.sku.trim()) {
      setError('SKU is required');
      return;
    }

    const markup = parseFloat(newOverride.markupPercent);
    if (isNaN(markup) || markup < -100) {
      setError('Please enter a valid markup percentage (minimum -100%)');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      const response = await pricingAPI.setSkuOverride(
        storeId,
        newOverride.sku.trim(),
        markup
      );

      if (response.success) {
        setSuccessMessage(`Override added for SKU: ${newOverride.sku}`);
        setNewOverride({ sku: '', markupPercent: '' });
        await fetchPricingRules();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(response.message || 'Failed to add override');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to add override');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOverride = async (overrideId: string, sku: string) => {
    if (!confirm(`Are you sure you want to delete the override for SKU: ${sku}?`)) {
      return;
    }

    try {
      setError(null);
      const response = await pricingAPI.deleteOverride(storeId, overrideId);

      if (response.success) {
        setSuccessMessage(`Override removed for SKU: ${sku}`);
        await fetchPricingRules();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(response.message || 'Failed to delete override');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete override');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-secondary-off-white dark:bg-dark-background">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-deep-red mx-auto mb-4"></div>
            <p className="text-neutral-600 dark:text-dark-text-secondary">Loading pricing rules...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-secondary-off-white dark:bg-dark-background">
      <Navbar />
      <main className="flex-1 py-12 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8 text-center">
            <SectionTitle size="xl" variant="default" className="mb-4">
              Pricing Rules
            </SectionTitle>
            <p className="text-lg text-neutral-600 dark:text-dark-text-secondary">
              Configure pricing markup for your store
            </p>
          </div>

          {/* Success Toast */}
          {successMessage && (
            <div className="mb-6 p-4 rounded-lg bg-success/10 border border-success">
              <p className="text-sm text-success font-medium">{successMessage}</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 rounded-lg bg-error/10 border border-error">
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          {/* Global Markup Card */}
          <Card variant="elevated" className="mb-8">
            <CardHeader>
              <CardTitle>Global Markup</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-600 dark:text-dark-text-secondary mb-4">
                Apply a markup percentage to all products in your store. This will be used unless a specific SKU override exists.
              </p>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label htmlFor="globalMarkup" className="block text-sm font-medium text-neutral-900 dark:text-dark-text mb-2">
                    Markup Percentage
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      id="globalMarkup"
                      step="0.01"
                      value={globalMarkup}
                      onChange={(e) => setGlobalMarkup(e.target.value)}
                      className={cn(
                        'flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-deep-red',
                        'bg-white dark:bg-dark-surface text-neutral-900 dark:text-dark-text',
                        'border-secondary-gray dark:border-dark-border'
                      )}
                      placeholder="0.00"
                    />
                    <span className="text-neutral-600 dark:text-dark-text-secondary">%</span>
                  </div>
                  <p className="mt-2 text-xs text-neutral-500 dark:text-dark-text-secondary">
                    Example: 10 = +10% markup, -5 = -5% discount
                  </p>
                </div>
                <div className="flex items-end">
                  <Button
                    variant="primary"
                    onClick={handleSaveGlobalMarkup}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SKU Overrides Card */}
          <Card variant="elevated" className="mb-8">
            <CardHeader>
              <CardTitle>SKU Overrides</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-600 dark:text-dark-text-secondary mb-4">
                Set specific markup percentages for individual products. Overrides take precedence over global markup.
              </p>

              {/* Add Override Form */}
              <form onSubmit={handleAddOverride} className="mb-6 p-4 bg-secondary-off-white dark:bg-dark-background rounded-lg border border-secondary-gray dark:border-dark-border">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="overrideSku" className="block text-sm font-medium text-neutral-900 dark:text-dark-text mb-2">
                      SKU <span className="text-primary-deep-red">*</span>
                    </label>
                    <input
                      type="text"
                      id="overrideSku"
                      value={newOverride.sku}
                      onChange={(e) => setNewOverride((prev) => ({ ...prev, sku: e.target.value }))}
                      className={cn(
                        'w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-deep-red',
                        'bg-white dark:bg-dark-surface text-neutral-900 dark:text-dark-text',
                        'border-secondary-gray dark:border-dark-border'
                      )}
                      placeholder="SKU001"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="overrideMarkup" className="block text-sm font-medium text-neutral-900 dark:text-dark-text mb-2">
                      Markup % <span className="text-primary-deep-red">*</span>
                    </label>
                    <input
                      type="number"
                      id="overrideMarkup"
                      step="0.01"
                      value={newOverride.markupPercent}
                      onChange={(e) => setNewOverride((prev) => ({ ...prev, markupPercent: e.target.value }))}
                      className={cn(
                        'w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-deep-red',
                        'bg-white dark:bg-dark-surface text-neutral-900 dark:text-dark-text',
                        'border-secondary-gray dark:border-dark-border'
                      )}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="submit"
                      variant="primary"
                      className="w-full"
                      disabled={saving}
                    >
                      {saving ? 'Adding...' : 'Add Override'}
                    </Button>
                  </div>
                </div>
              </form>

              {/* Overrides Table */}
              {overrides.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-secondary-gray dark:border-dark-border">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-900 dark:text-dark-text">
                          SKU
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-900 dark:text-dark-text">
                          Markup %
                        </th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-neutral-900 dark:text-dark-text">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {overrides.map((override) => (
                        <tr
                          key={override._id}
                          className="border-b border-secondary-gray dark:border-dark-border hover:bg-secondary-off-white dark:hover:bg-dark-background"
                        >
                          <td className="py-3 px-4 text-sm text-neutral-900 dark:text-dark-text font-mono">
                            {override.sku}
                          </td>
                          <td className="py-3 px-4 text-sm text-neutral-900 dark:text-dark-text">
                            {override.markupPercent > 0 ? '+' : ''}
                            {override.markupPercent.toFixed(2)}%
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteOverride(override._id, override.sku)}
                              className="text-error border-error hover:bg-error hover:text-white"
                            >
                              Remove
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-neutral-500 dark:text-dark-text-secondary">
                  <p>No SKU overrides configured</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="lg"
              onClick={() => router.push(`/stores/${storeId}/preview`)}
              className="px-8"
            >
              Back to Store
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

