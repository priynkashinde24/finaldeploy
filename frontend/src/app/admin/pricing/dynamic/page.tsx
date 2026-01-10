'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import {
  getDynamicPricingRules,
  createDynamicPricingRule,
  updateDynamicPricingRule,
  disableDynamicPricingRule,
  DynamicPricingRule,
  CreateDynamicPricingRuleData,
  UpdateDynamicPricingRuleData,
} from '@/lib/adminDynamicPricing';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

export default function AdminDynamicPricingPage() {
  const router = useRouter();
  const [rules, setRules] = useState<DynamicPricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<DynamicPricingRule | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [scopeFilter, setScopeFilter] = useState<string>('');

  const currentUser = getCurrentUser();

  useEffect(() => {
    if (currentUser?.role !== 'admin') {
      router.push('/unauthorized');
      return;
    }
    loadRules();
  }, [currentUser, router, statusFilter, scopeFilter]);

  const loadRules = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      if (scopeFilter) params.scope = scopeFilter;

      const response = await getDynamicPricingRules(params);

      if (response.success && response.data) {
        setRules(response.data.rules);
      } else {
        setError(response.message || 'Failed to load dynamic pricing rules');
      }
    } catch (err: any) {
      console.error('[ADMIN DYNAMIC PRICING] Load error:', err);
      setError(err.message || 'Failed to load dynamic pricing rules');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async (id: string) => {
    if (!confirm('Are you sure you want to disable this dynamic pricing rule?')) {
      return;
    }

    try {
      setActionLoading(id);
      setError(null);

      const response = await disableDynamicPricingRule(id);

      if (response.success) {
        setSuccessMessage('Dynamic pricing rule disabled successfully');
        loadRules();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(response.message || 'Failed to disable dynamic pricing rule');
      }
    } catch (err: any) {
      console.error('[ADMIN DYNAMIC PRICING] Disable error:', err);
      setError(err.message || 'Failed to disable dynamic pricing rule');
    } finally {
      setActionLoading(null);
    }
  };

  const openEditModal = (rule: DynamicPricingRule) => {
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

  const formatAdjustment = (type: string, mode: string, value: number) => {
    const direction = type === 'increase' ? '+' : '-';
    if (mode === 'percentage') {
      return `${direction}${value}%`;
    }
    return `${direction}₹${value.toFixed(2)}`;
  };

  const formatTrigger = (triggerType: string, conditions: any) => {
    if (triggerType === 'low_stock') {
      return `Stock < ${conditions.stockBelow}`;
    }
    if (triggerType === 'high_demand') {
      return `Orders > ${conditions.ordersAbove}`;
    }
    if (triggerType === 'time_window') {
      return `${new Date(conditions.startTime).toLocaleDateString()} - ${new Date(conditions.endTime).toLocaleDateString()}`;
    }
    return triggerType;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Dynamic Pricing Rules</h1>
          <p className="text-text-secondary">Automatically adjust prices based on demand, stock, and time</p>
        </div>
        <Button variant="primary" size="md" onClick={openCreateModal}>
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Rule
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
          </div>
        </CardContent>
      </Card>

      {/* Rules Table */}
      <Card className="bg-surface border-border">
        <CardHeader>
          <CardTitle className="text-white">Dynamic Pricing Rules</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-text-secondary">Loading...</div>
          ) : rules.length === 0 ? (
            <div className="p-8 text-center text-text-secondary">No dynamic pricing rules found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-background border-b border-border">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Scope
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Trigger
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Adjustment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Priority
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
                        {formatTrigger(rule.triggerType, rule.conditions)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        {formatAdjustment(rule.adjustmentType, rule.adjustmentMode, rule.adjustmentValue)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                        {rule.priority}
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
        <DynamicPricingRuleModal
          rule={editingRule}
          onClose={closeModal}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  );
}

// Dynamic Pricing Rule Modal Component
interface DynamicPricingRuleModalProps {
  rule: DynamicPricingRule | null;
  onClose: () => void;
  onSuccess: () => void;
}

function DynamicPricingRuleModal({ rule, onClose, onSuccess }: DynamicPricingRuleModalProps) {
  const [formData, setFormData] = useState<CreateDynamicPricingRuleData>({
    scope: 'global',
    scopeId: null,
    triggerType: 'low_stock',
    conditions: {
      stockBelow: null,
      ordersAbove: null,
      startTime: null,
      endTime: null,
    },
    adjustmentType: 'increase',
    adjustmentMode: 'percentage',
    adjustmentValue: 0,
    maxAdjustmentLimit: null,
    status: 'active',
    priority: 50,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (rule) {
      setFormData({
        scope: rule.scope,
        scopeId: rule.scopeId || null,
        triggerType: rule.triggerType,
        conditions: {
          stockBelow: rule.conditions.stockBelow || null,
          ordersAbove: rule.conditions.ordersAbove || null,
          startTime: rule.conditions.startTime || null,
          endTime: rule.conditions.endTime || null,
        },
        adjustmentType: rule.adjustmentType,
        adjustmentMode: rule.adjustmentMode,
        adjustmentValue: rule.adjustmentValue,
        maxAdjustmentLimit: rule.maxAdjustmentLimit || null,
        status: rule.status,
        priority: rule.priority,
      });
    }
  }, [rule]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (formData.scope !== 'global' && !formData.scopeId) {
      setError(`${formData.scope} scope requires a target`);
      return;
    }

    if (formData.triggerType === 'low_stock' && formData.conditions.stockBelow === null) {
      setError('Low stock trigger requires stockBelow condition');
      return;
    }

    if (formData.triggerType === 'high_demand' && formData.conditions.ordersAbove === null) {
      setError('High demand trigger requires ordersAbove condition');
      return;
    }

    if (formData.triggerType === 'time_window') {
      if (!formData.conditions.startTime || !formData.conditions.endTime) {
        setError('Time window trigger requires startTime and endTime');
        return;
      }
      if (new Date(formData.conditions.startTime) >= new Date(formData.conditions.endTime)) {
        setError('Start time must be before end time');
        return;
      }
    }

    if (formData.adjustmentMode === 'percentage' && formData.adjustmentValue > 100) {
      setError('Percentage adjustment cannot exceed 100%');
      return;
    }

    try {
      setLoading(true);

      let response;
      if (rule) {
        const updateData: UpdateDynamicPricingRuleData = {
          triggerType: formData.triggerType,
          conditions: formData.conditions,
          adjustmentType: formData.adjustmentType,
          adjustmentMode: formData.adjustmentMode,
          adjustmentValue: formData.adjustmentValue,
          maxAdjustmentLimit: formData.maxAdjustmentLimit,
          status: formData.status,
          priority: formData.priority,
        };
        response = await updateDynamicPricingRule(rule._id, updateData);
      } else {
        response = await createDynamicPricingRule(formData);
      }

      if (response.success) {
        onSuccess();
      } else {
        setError(response.message || 'Failed to save dynamic pricing rule');
      }
    } catch (err: any) {
      console.error('[DYNAMIC PRICING RULE MODAL] Submit error:', err);
      setError(err.message || 'Failed to save dynamic pricing rule');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface border border-border rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">
            {rule ? 'Edit Dynamic Pricing Rule' : 'Add Dynamic Pricing Rule'}
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

          {/* Trigger Type */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Trigger Type</label>
            <select
              value={formData.triggerType}
              onChange={(e) => {
                setFormData({
                  ...formData,
                  triggerType: e.target.value as any,
                  conditions: {
                    stockBelow: null,
                    ordersAbove: null,
                    startTime: null,
                    endTime: null,
                  },
                });
              }}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white"
              required
            >
              <option value="low_stock">Low Stock</option>
              <option value="high_demand">High Demand</option>
              <option value="time_window">Time Window</option>
            </select>
          </div>

          {/* Conditions (dynamic based on trigger type) */}
          {formData.triggerType === 'low_stock' && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Stock Below (units)
              </label>
              <input
                type="number"
                min="0"
                value={formData.conditions.stockBelow || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    conditions: {
                      ...formData.conditions,
                      stockBelow: e.target.value ? parseInt(e.target.value) : null,
                    },
                  })
                }
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white"
                required
              />
            </div>
          )}

          {formData.triggerType === 'high_demand' && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Orders Above (last 24h)
              </label>
              <input
                type="number"
                min="0"
                value={formData.conditions.ordersAbove || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    conditions: {
                      ...formData.conditions,
                      ordersAbove: e.target.value ? parseInt(e.target.value) : null,
                    },
                  })
                }
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white"
                required
              />
            </div>
          )}

          {formData.triggerType === 'time_window' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Start Time</label>
                <input
                  type="datetime-local"
                  value={formData.conditions.startTime ? formData.conditions.startTime.substring(0, 16) : ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      conditions: {
                        ...formData.conditions,
                        startTime: e.target.value ? new Date(e.target.value).toISOString() : null,
                      },
                    })
                  }
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">End Time</label>
                <input
                  type="datetime-local"
                  value={formData.conditions.endTime ? formData.conditions.endTime.substring(0, 16) : ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      conditions: {
                        ...formData.conditions,
                        endTime: e.target.value ? new Date(e.target.value).toISOString() : null,
                      },
                    })
                  }
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white"
                  required
                />
              </div>
            </div>
          )}

          {/* Adjustment */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Adjustment Type
              </label>
              <select
                value={formData.adjustmentType}
                onChange={(e) => setFormData({ ...formData, adjustmentType: e.target.value as any })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white"
                required
              >
                <option value="increase">Increase</option>
                <option value="decrease">Decrease</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Adjustment Mode
              </label>
              <select
                value={formData.adjustmentMode}
                onChange={(e) => setFormData({ ...formData, adjustmentMode: e.target.value as any })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white"
                required
              >
                <option value="percentage">Percentage</option>
                <option value="amount">Fixed Amount</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Adjustment Value
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max={formData.adjustmentMode === 'percentage' ? 100 : undefined}
                value={formData.adjustmentValue}
                onChange={(e) =>
                  setFormData({ ...formData, adjustmentValue: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Priority (1-100)</label>
              <input
                type="number"
                min="1"
                max="100"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 50 })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white"
                required
              />
            </div>
          </div>

          {/* Max Adjustment Limit */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Max Adjustment Limit (₹) - Optional
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.maxAdjustmentLimit || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  maxAdjustmentLimit: e.target.value ? parseFloat(e.target.value) : null,
                })
              }
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white"
              placeholder="Optional"
            />
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

