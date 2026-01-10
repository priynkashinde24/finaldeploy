'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import {
  getPricingRules,
  createPricingRule,
  updatePricingRule,
  disablePricingRule,
  PricingRule,
  CreatePricingRuleData,
  UpdatePricingRuleData,
} from '@/lib/adminPricing';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

export default function AdminPricingPage() {
  const router = useRouter();
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<PricingRule | null>(null);
  const [scopeFilter, setScopeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const currentUser = getCurrentUser();

  useEffect(() => {
    if (currentUser?.role !== 'admin') {
      router.push('/unauthorized');
      return;
    }
    loadRules();
  }, [currentUser, router, scopeFilter, statusFilter]);

  const loadRules = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {};
      if (scopeFilter) params.scope = scopeFilter;
      if (statusFilter) params.status = statusFilter;

      const response = await getPricingRules(params);

      if (response.success && response.data) {
        setRules(response.data.rules);
      } else {
        setError(response.message || 'Failed to load pricing rules');
      }
    } catch (err: any) {
      console.error('[ADMIN PRICING] Load error:', err);
      setError(err.message || 'Failed to load pricing rules');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async (id: string) => {
    if (!confirm('Are you sure you want to disable this pricing rule?')) {
      return;
    }

    try {
      setActionLoading(id);
      setError(null);

      const response = await disablePricingRule(id);

      if (response.success) {
        setSuccessMessage('Pricing rule disabled successfully');
        loadRules();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(response.message || 'Failed to disable pricing rule');
      }
    } catch (err: any) {
      console.error('[ADMIN PRICING] Disable error:', err);
      setError(err.message || 'Failed to disable pricing rule');
    } finally {
      setActionLoading(null);
    }
  };

  const openEditModal = (rule: PricingRule) => {
    setEditingRule(rule);
    setShowModal(true);
  };

  const openCreateModal = () => {
    setEditingRule(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingRule(null);
  };

  const handleModalSuccess = () => {
    closeModal();
    loadRules();
  };

  const getScopeLabel = (scope: string, scopeId?: string | null) => {
    if (scope === 'global') return 'Global';
    if (!scopeId) return scope.charAt(0).toUpperCase() + scope.slice(1);
    return `${scope.charAt(0).toUpperCase() + scope.slice(1)} (${scopeId.substring(0, 8)}...)`;
  };

  const formatMargin = (type: string, value: number) => {
    if (type === 'amount') {
      return `₹${value.toFixed(2)}`;
    }
    return `${value}%`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Pricing Rules</h1>
          <p className="text-text-secondary">Control product pricing system-wide</p>
        </div>
        <Button variant="primary" size="md" onClick={openCreateModal}>
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Pricing Rule
        </Button>
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
              <label className="block text-sm font-medium text-text-secondary mb-2">Scope</label>
              <select
                value={scopeFilter}
                onChange={(e) => setScopeFilter(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white"
              >
                <option value="">All Scopes</option>
                <option value="global">Global</option>
                <option value="category">Category</option>
                <option value="product">Product</option>
                <option value="variant">Variant</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-text-secondary mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rules Table */}
      <Card className="bg-surface border-border">
        <CardHeader>
          <CardTitle className="text-white">Pricing Rules</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-text-secondary">Loading...</div>
          ) : rules.length === 0 ? (
            <div className="p-8 text-center text-text-secondary">No pricing rules found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-background border-b border-border">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Scope
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Target
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Min Margin
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Min / Max Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Enforce On
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
                  {rules.map((rule) => (
                    <tr key={rule._id} className="hover:bg-background/50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        {rule.scope.charAt(0).toUpperCase() + rule.scope.slice(1)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                        {getScopeLabel(rule.scope, rule.scopeId)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        {formatMargin(rule.minMarginType, rule.minMarginValue)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        {rule.minSellingPrice || rule.maxSellingPrice
                          ? `₹${rule.minSellingPrice?.toFixed(2) || '0'} / ${rule.maxSellingPrice ? `₹${rule.maxSellingPrice.toFixed(2)}` : '∞'}`
                          : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                        {rule.enforceOn.join(', ')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={cn(
                            'px-2 py-1 text-xs font-medium rounded-full',
                            rule.status === 'active'
                              ? 'bg-green-500/10 text-green-400'
                              : 'bg-gray-500/10 text-gray-400'
                          )}
                        >
                          {rule.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openEditModal(rule)}
                            disabled={actionLoading === rule._id}
                          >
                            Edit
                          </Button>
                          {rule.status === 'active' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDisable(rule._id)}
                              disabled={actionLoading === rule._id}
                              className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                            >
                              {actionLoading === rule._id ? 'Disabling...' : 'Disable'}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      {showModal && (
        <PricingRuleModal
          rule={editingRule}
          onClose={closeModal}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  );
}

// Pricing Rule Modal Component
interface PricingRuleModalProps {
  rule: PricingRule | null;
  onClose: () => void;
  onSuccess: () => void;
}

function PricingRuleModal({ rule, onClose, onSuccess }: PricingRuleModalProps) {
  const [formData, setFormData] = useState<CreatePricingRuleData>({
    scope: 'global',
    scopeId: null,
    minMarginType: 'amount',
    minMarginValue: 0,
    maxDiscountPercentage: null,
    minSellingPrice: null,
    maxSellingPrice: null,
    enforceOn: ['reseller'],
    status: 'active',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scopeTargets, setScopeTargets] = useState<any[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(false);

  useEffect(() => {
    if (rule) {
      setFormData({
        scope: rule.scope,
        scopeId: rule.scopeId || null,
        minMarginType: rule.minMarginType,
        minMarginValue: rule.minMarginValue,
        maxDiscountPercentage: rule.maxDiscountPercentage || null,
        minSellingPrice: rule.minSellingPrice || null,
        maxSellingPrice: rule.maxSellingPrice || null,
        enforceOn: rule.enforceOn,
        status: rule.status,
      });
    }
    if (formData.scope !== 'global') {
      loadScopeTargets();
    }
  }, [rule, formData.scope]);

  const loadScopeTargets = async () => {
    // TODO: Load products/categories/variants based on scope
    // For now, we'll use a simple input
    setLoadingTargets(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (formData.scope !== 'global' && !formData.scopeId) {
      setError(`${formData.scope} scope requires a target`);
      return;
    }

    if (
      formData.minSellingPrice !== null &&
      formData.minSellingPrice !== undefined &&
      formData.maxSellingPrice !== null &&
      formData.maxSellingPrice !== undefined &&
      formData.minSellingPrice > formData.maxSellingPrice
    ) {
      setError('Minimum selling price must be less than or equal to maximum selling price');
      return;
    }

    try {
      setLoading(true);

      let response;
      if (rule) {
        const updateData: UpdatePricingRuleData = {
          minMarginType: formData.minMarginType,
          minMarginValue: formData.minMarginValue,
          maxDiscountPercentage: formData.maxDiscountPercentage,
          minSellingPrice: formData.minSellingPrice,
          maxSellingPrice: formData.maxSellingPrice,
          enforceOn: formData.enforceOn,
          status: formData.status,
        };
        response = await updatePricingRule(rule._id, updateData);
      } else {
        response = await createPricingRule(formData);
      }

      if (response.success) {
        onSuccess();
      } else {
        setError(response.message || 'Failed to save pricing rule');
      }
    } catch (err: any) {
      console.error('[PRICING RULE MODAL] Submit error:', err);
      setError(err.message || 'Failed to save pricing rule');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface border border-border rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">
            {rule ? 'Edit Pricing Rule' : 'Add Pricing Rule'}
          </h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Scope */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Scope</label>
            <select
              value={formData.scope}
              onChange={(e) =>
                setFormData({ ...formData, scope: e.target.value as any, scopeId: null })
              }
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white"
              required
            >
              <option value="global">Global</option>
              <option value="category">Category</option>
              <option value="product">Product</option>
              <option value="variant">Variant</option>
            </select>
          </div>

          {/* Scope Target */}
          {formData.scope !== 'global' && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                {formData.scope.charAt(0).toUpperCase() + formData.scope.slice(1)} ID
              </label>
              <input
                type="text"
                value={formData.scopeId || ''}
                onChange={(e) => setFormData({ ...formData, scopeId: e.target.value || null })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white"
                placeholder={`Enter ${formData.scope} ID`}
                required
              />
            </div>
          )}

          {/* Min Margin */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Min Margin Type
              </label>
              <select
                value={formData.minMarginType}
                onChange={(e) => setFormData({ ...formData, minMarginType: e.target.value as any })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white"
                required
              >
                <option value="amount">Amount (₹)</option>
                <option value="percentage">Percentage (%)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Min Margin Value
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.minMarginValue}
                onChange={(e) =>
                  setFormData({ ...formData, minMarginValue: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white"
                required
              />
            </div>
          </div>

          {/* Price Limits */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Min Selling Price (₹)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.minSellingPrice || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    minSellingPrice: e.target.value ? parseFloat(e.target.value) : null,
                  })
                }
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Max Selling Price (₹)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.maxSellingPrice || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    maxSellingPrice: e.target.value ? parseFloat(e.target.value) : null,
                  })
                }
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white"
                placeholder="Optional"
              />
            </div>
          </div>

          {/* Max Discount */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Max Discount Percentage (%)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={formData.maxDiscountPercentage || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  maxDiscountPercentage: e.target.value ? parseFloat(e.target.value) : null,
                })
              }
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white"
              placeholder="Optional"
            />
          </div>

          {/* Enforce On */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Enforce On</label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.enforceOn.includes('reseller')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setFormData({
                        ...formData,
                        enforceOn: [...formData.enforceOn, 'reseller'],
                      });
                    } else {
                      setFormData({
                        ...formData,
                        enforceOn: formData.enforceOn.filter((v) => v !== 'reseller'),
                      });
                    }
                  }}
                  className="mr-2"
                />
                <span className="text-white">Reseller Pricing</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.enforceOn.includes('storefront')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setFormData({
                        ...formData,
                        enforceOn: [...formData.enforceOn, 'storefront'],
                      });
                    } else {
                      setFormData({
                        ...formData,
                        enforceOn: formData.enforceOn.filter((v) => v !== 'storefront'),
                      });
                    }
                  }}
                  className="mr-2"
                />
                <span className="text-white">Checkout</span>
              </label>
            </div>
          </div>

          {/* Status */}
          {rule && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-4 pt-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Saving...' : rule ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

