'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import {
  getStore,
  getPriceOverrides,
  createPriceOverride,
  updatePriceOverride,
  disablePriceOverride,
  Store,
  StorePriceOverride,
  CreatePriceOverrideData,
} from '@/lib/adminStores';
import { getCategories, Category } from '@/lib/adminCatalog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';

export default function StorePricingPage() {
  const router = useRouter();
  const params = useParams();
  const storeId = params.id as string;

  const [store, setStore] = useState<Store | null>(null);
  const [priceOverrides, setPriceOverrides] = useState<StorePriceOverride[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | ''>('');
  const [scopeFilter, setScopeFilter] = useState<'product' | 'variant' | 'category' | ''>('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedOverride, setSelectedOverride] = useState<StorePriceOverride | null>(null);

  // Form state
  const [formData, setFormData] = useState<CreatePriceOverrideData>({
    scope: 'product',
    scopeId: '',
    overrideType: 'fixed_price',
    overrideValue: 0,
    status: 'active',
  });

  const currentUser = getCurrentUser();

  useEffect(() => {
    if (currentUser?.role !== 'admin') {
      router.push('/unauthorized');
      return;
    }
    loadData();
  }, [currentUser, router, storeId, statusFilter, scopeFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [storeResponse, overridesResponse, categoriesResponse] = await Promise.all([
        getStore(storeId),
        getPriceOverrides(storeId, {
          status: statusFilter || undefined,
          scope: scopeFilter || undefined,
        }),
        getCategories(),
      ]);

      if (storeResponse.success && storeResponse.data) {
        setStore(storeResponse.data.store);
      } else {
        setError(storeResponse.message || 'Failed to load store');
      }

      if (overridesResponse.success && overridesResponse.data) {
        setPriceOverrides(overridesResponse.data.priceOverrides);
      } else {
        setError(overridesResponse.message || 'Failed to load price overrides');
      }

      if (categoriesResponse.success && categoriesResponse.data) {
        setCategories(categoriesResponse.data.categories);
      }
    } catch (err: any) {
      console.error('[STORE PRICING] Load error:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setFormData({
      scope: 'product',
      scopeId: '',
      overrideType: 'fixed_price',
      overrideValue: 0,
      status: 'active',
    });
    setSelectedOverride(null);
    setShowAddModal(true);
  };

  const handleEdit = (override: StorePriceOverride) => {
    setFormData({
      scope: override.scope,
      scopeId: override.scopeId,
      overrideType: override.overrideType,
      overrideValue: override.overrideValue,
      status: override.status,
    });
    setSelectedOverride(override);
    setShowEditModal(true);
  };

  const handleSubmit = async () => {
    if (!formData.scopeId.trim()) {
      setError('Scope ID is required');
      return;
    }

    try {
      setActionLoading('submit');
      setError(null);

      let response;
      if (showEditModal && selectedOverride) {
        response = await updatePriceOverride(storeId, selectedOverride._id, formData);
      } else {
        response = await createPriceOverride(storeId, formData);
      }

      if (response.success) {
        setSuccessMessage(
          showEditModal ? 'Price override updated successfully' : 'Price override created successfully'
        );
        setShowAddModal(false);
        setShowEditModal(false);
        setFormData({
          scope: 'product',
          scopeId: '',
          overrideType: 'fixed_price',
          overrideValue: 0,
          status: 'active',
        });
        setSelectedOverride(null);
        setTimeout(() => setSuccessMessage(null), 3000);
        loadData();
      } else {
        setError(response.message || 'Failed to save price override');
      }
    } catch (err: any) {
      console.error('[STORE PRICING] Submit error:', err);
      setError(err.message || 'Failed to save price override');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisable = async (override: StorePriceOverride) => {
    if (!confirm(`Are you sure you want to disable this price override?`)) {
      return;
    }

    try {
      setActionLoading(override._id);
      setError(null);

      const response = await disablePriceOverride(storeId, override._id);

      if (response.success) {
        setSuccessMessage('Price override disabled successfully');
        setTimeout(() => setSuccessMessage(null), 3000);
        loadData();
      } else {
        setError(response.message || 'Failed to disable price override');
      }
    } catch (err: any) {
      console.error('[STORE PRICING] Disable error:', err);
      setError(err.message || 'Failed to disable price override');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => router.push('/admin/stores')}
            className="text-text-secondary hover:text-white mb-2 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Stores
          </button>
          <h1 className="text-3xl font-bold text-white mb-2">
            {store ? `${store.name} - Price Overrides` : 'Price Overrides'}
          </h1>
          <p className="text-text-secondary">Manage store-specific price overrides</p>
        </div>
        <Button variant="primary" size="md" onClick={handleAdd} disabled={actionLoading !== null}>
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Price Override
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
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-white mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'active' | 'inactive' | '')}
                className="w-full px-4 py-2 rounded-lg bg-[#0B0B0B] border border-[#242424] text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-white mb-2">Scope</label>
              <select
                value={scopeFilter}
                onChange={(e) => setScopeFilter(e.target.value as 'product' | 'variant' | 'category' | '')}
                className="w-full px-4 py-2 rounded-lg bg-[#0B0B0B] border border-[#242424] text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              >
                <option value="">All Scopes</option>
                <option value="variant">Variant</option>
                <option value="product">Product</option>
                <option value="category">Category</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Price Overrides Table */}
      <Card className="bg-surface border-border">
        <CardHeader>
          <CardTitle>Price Overrides ({priceOverrides.length} total)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-text-secondary">Loading price overrides...</p>
            </div>
          ) : priceOverrides.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-text-secondary">
                No price overrides found. Create your first override to get started.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#242424]">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Scope</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Scope ID</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Type</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Value</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Status</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-white">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {priceOverrides.map((override) => (
                    <tr
                      key={override._id}
                      className="border-b border-[#242424] hover:bg-[#1A1A1A] transition-colors"
                    >
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-500/20 text-blue-400 uppercase">
                          {override.scope}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-white text-sm font-mono">{override.scopeId}</td>
                      <td className="py-3 px-4">
                        <span className="text-text-secondary text-sm capitalize">
                          {override.overrideType.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-white">
                        {override.overrideType === 'fixed_price'
                          ? `₹${override.overrideValue.toFixed(2)}`
                          : override.overrideValue > 0
                            ? `+${override.overrideValue}%`
                            : `${override.overrideValue}%`}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={cn(
                            'px-2 py-1 rounded text-xs font-semibold',
                            override.status === 'active'
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-gray-500/20 text-gray-400'
                          )}
                        >
                          {override.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleEdit(override)}
                            disabled={actionLoading !== null}
                          >
                            Edit
                          </Button>
                          {override.status === 'active' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDisable(override)}
                              disabled={actionLoading === override._id}
                              className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
                            >
                              {actionLoading === override._id ? '...' : 'Disable'}
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

      {/* Add/Edit Price Override Modal */}
      <Modal
        isOpen={showAddModal || showEditModal}
        onClose={() => {
          setShowAddModal(false);
          setShowEditModal(false);
          setFormData({
            scope: 'product',
            scopeId: '',
            overrideType: 'fixed_price',
            overrideValue: 0,
            status: 'active',
          });
          setSelectedOverride(null);
          setError(null);
        }}
        title={showEditModal ? 'Edit Price Override' : 'Add Price Override'}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white mb-2">Scope *</label>
            <select
              value={formData.scope}
              onChange={(e) => setFormData({ ...formData, scope: e.target.value as 'product' | 'variant' | 'category' })}
              className="w-full px-4 py-3 rounded-lg bg-[#0B0B0B] border border-[#242424] text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              disabled={showEditModal}
            >
              <option value="variant">Variant (Highest Priority)</option>
              <option value="product">Product</option>
              <option value="category">Category (Lowest Priority)</option>
            </select>
          </div>

          <Input
            label="Scope ID *"
            value={formData.scopeId}
            onChange={(e) => setFormData({ ...formData, scopeId: e.target.value })}
            placeholder="Product/Variant/Category ID"
            required
            disabled={showEditModal}
          />

          <div>
            <label className="block text-sm font-medium text-white mb-2">Override Type *</label>
            <select
              value={formData.overrideType}
              onChange={(e) =>
                setFormData({ ...formData, overrideType: e.target.value as 'fixed_price' | 'price_delta' })
              }
              className="w-full px-4 py-3 rounded-lg bg-[#0B0B0B] border border-[#242424] text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
            >
              <option value="fixed_price">Fixed Price</option>
              <option value="price_delta">Price Delta (Percentage or Amount)</option>
            </select>
          </div>

          <Input
            label={
              formData.overrideType === 'fixed_price'
                ? 'Fixed Price (₹) *'
                : 'Delta Value (Percentage or Amount) *'
            }
            type="number"
            value={formData.overrideValue.toString()}
            onChange={(e) => setFormData({ ...formData, overrideValue: parseFloat(e.target.value) || 0 })}
            placeholder={formData.overrideType === 'fixed_price' ? 'e.g., 999' : 'e.g., 10 (for +10%) or -5 (for -5%)'}
            step={formData.overrideType === 'fixed_price' ? '0.01' : '0.1'}
            required
          />

          <div>
            <label className="block text-sm font-medium text-white mb-2">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
              className="w-full px-4 py-3 rounded-lg bg-[#0B0B0B] border border-[#242424] text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="primary"
              size="md"
              onClick={handleSubmit}
              disabled={actionLoading === 'submit' || !formData.scopeId.trim()}
              className="flex-1"
            >
              {actionLoading === 'submit' ? 'Saving...' : showEditModal ? 'Update' : 'Create'}
            </Button>
            <Button
              variant="ghost"
              size="md"
              onClick={() => {
                setShowAddModal(false);
                setShowEditModal(false);
                setFormData({
                  scope: 'product',
                  scopeId: '',
                  overrideType: 'fixed_price',
                  overrideValue: 0,
                  status: 'active',
                });
                setSelectedOverride(null);
                setError(null);
              }}
              disabled={actionLoading === 'submit'}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

