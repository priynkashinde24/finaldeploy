'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import {
  getTaxCategories,
  createTaxCategory,
  updateTaxCategory,
  disableTaxCategory,
  TaxCategory,
  CreateTaxCategoryData,
} from '@/lib/adminTax';
import { getCategories, Category } from '@/lib/adminCatalog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';

export default function AdminTaxesPage() {
  const router = useRouter();
  const [taxCategories, setTaxCategories] = useState<TaxCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | ''>('');
  const [taxTypeFilter, setTaxTypeFilter] = useState<'gst' | 'vat' | ''>('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTaxCategory, setSelectedTaxCategory] = useState<TaxCategory | null>(null);

  // Form state
  const [formData, setFormData] = useState<CreateTaxCategoryData>({
    name: '',
    taxType: 'gst',
    taxRate: 0,
    applicableCategories: [],
    isGlobal: false,
    status: 'active',
  });

  const currentUser = getCurrentUser();

  useEffect(() => {
    if (currentUser?.role !== 'admin') {
      router.push('/unauthorized');
      return;
    }
    loadData();
  }, [currentUser, router, statusFilter, taxTypeFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [taxResponse, categoriesResponse] = await Promise.all([
        getTaxCategories({
          status: statusFilter || undefined,
          taxType: taxTypeFilter || undefined,
        }),
        getCategories(),
      ]);

      if (taxResponse.success && taxResponse.data) {
        setTaxCategories(taxResponse.data.taxCategories);
      } else {
        setError(taxResponse.message || 'Failed to load tax categories');
      }

      if (categoriesResponse.success && categoriesResponse.data) {
        setCategories(categoriesResponse.data.categories);
      }
    } catch (err: any) {
      console.error('[ADMIN TAXES] Load error:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setFormData({
      name: '',
      taxType: 'gst',
      taxRate: 0,
      applicableCategories: [],
      isGlobal: false,
      status: 'active',
    });
    setSelectedTaxCategory(null);
    setShowAddModal(true);
  };

  const handleEdit = (taxCategory: TaxCategory) => {
    setFormData({
      name: taxCategory.name,
      taxType: taxCategory.taxType,
      taxRate: taxCategory.taxRate,
      applicableCategories: taxCategory.applicableCategories.map((cat) => cat._id),
      isGlobal: taxCategory.isGlobal,
      status: taxCategory.status,
    });
    setSelectedTaxCategory(taxCategory);
    setShowEditModal(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError('Tax category name is required');
      return;
    }

    if (formData.taxRate < 0 || formData.taxRate > 100) {
      setError('Tax rate must be between 0 and 100');
      return;
    }

    try {
      setActionLoading('submit');
      setError(null);

      let response;
      if (showEditModal && selectedTaxCategory) {
        response = await updateTaxCategory(selectedTaxCategory._id, formData);
      } else {
        response = await createTaxCategory(formData);
      }

      if (response.success) {
        setSuccessMessage(
          showEditModal ? 'Tax category updated successfully' : 'Tax category created successfully'
        );
        setShowAddModal(false);
        setShowEditModal(false);
        setFormData({
          name: '',
          taxType: 'gst',
          taxRate: 0,
          applicableCategories: [],
          isGlobal: false,
          status: 'active',
        });
        setSelectedTaxCategory(null);
        setTimeout(() => setSuccessMessage(null), 3000);
        loadData();
      } else {
        setError(response.message || 'Failed to save tax category');
      }
    } catch (err: any) {
      console.error('[ADMIN TAXES] Submit error:', err);
      setError(err.message || 'Failed to save tax category');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisable = async (taxCategory: TaxCategory) => {
    if (!confirm(`Are you sure you want to disable "${taxCategory.name}"?`)) {
      return;
    }

    try {
      setActionLoading(taxCategory._id);
      setError(null);

      const response = await disableTaxCategory(taxCategory._id);

      if (response.success) {
        setSuccessMessage('Tax category disabled successfully');
        setTimeout(() => setSuccessMessage(null), 3000);
        loadData();
      } else {
        setError(response.message || 'Failed to disable tax category');
      }
    } catch (err: any) {
      console.error('[ADMIN TAXES] Disable error:', err);
      setError(err.message || 'Failed to disable tax category');
    } finally {
      setActionLoading(null);
    }
  };

  const toggleCategorySelection = (categoryId: string) => {
    const current = formData.applicableCategories || [];
    if (current.includes(categoryId)) {
      setFormData({
        ...formData,
        applicableCategories: current.filter((id) => id !== categoryId),
      });
    } else {
      setFormData({
        ...formData,
        applicableCategories: [...current, categoryId],
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Tax Categories</h1>
          <p className="text-text-secondary">Manage GST/VAT rates and their applicability</p>
        </div>
        <Button variant="primary" size="md" onClick={handleAdd} disabled={actionLoading !== null}>
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Tax Category
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
              <label className="block text-sm font-medium text-white mb-2">Tax Type</label>
              <select
                value={taxTypeFilter}
                onChange={(e) => setTaxTypeFilter(e.target.value as 'gst' | 'vat' | '')}
                className="w-full px-4 py-2 rounded-lg bg-[#0B0B0B] border border-[#242424] text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              >
                <option value="">All Types</option>
                <option value="gst">GST</option>
                <option value="vat">VAT</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tax Categories Table */}
      <Card className="bg-surface border-border">
        <CardHeader>
          <CardTitle>Tax Categories ({taxCategories.length} total)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-text-secondary">Loading tax categories...</p>
            </div>
          ) : taxCategories.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-text-secondary">
                No tax categories found. Create your first tax category to get started.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#242424]">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Name</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Tax Type</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Rate</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Categories</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Status</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-white">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {taxCategories.map((taxCategory) => (
                    <tr key={taxCategory._id} className="border-b border-[#242424] hover:bg-[#1A1A1A] transition-colors">
                      <td className="py-3 px-4 text-white">{taxCategory.name}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-500/20 text-blue-400 uppercase">
                          {taxCategory.taxType}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-white">{taxCategory.taxRate}%</td>
                      <td className="py-3 px-4">
                        {taxCategory.isGlobal ? (
                          <span className="text-text-secondary text-sm">Global (All Categories)</span>
                        ) : taxCategory.applicableCategories.length > 0 ? (
                          <span className="text-text-secondary text-sm">
                            {taxCategory.applicableCategories.length} category
                            {taxCategory.applicableCategories.length !== 1 ? 'ies' : ''}
                          </span>
                        ) : (
                          <span className="text-text-muted text-sm">None</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={cn(
                            'px-2 py-1 rounded text-xs font-semibold',
                            taxCategory.status === 'active'
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-gray-500/20 text-gray-400'
                          )}
                        >
                          {taxCategory.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleEdit(taxCategory)}
                            disabled={actionLoading !== null}
                          >
                            Edit
                          </Button>
                          {taxCategory.status === 'active' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDisable(taxCategory)}
                              disabled={actionLoading === taxCategory._id}
                              className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
                            >
                              {actionLoading === taxCategory._id ? '...' : 'Disable'}
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

      {/* Add/Edit Tax Category Modal */}
      <Modal
        isOpen={showAddModal || showEditModal}
        onClose={() => {
          setShowAddModal(false);
          setShowEditModal(false);
          setFormData({
            name: '',
            taxType: 'gst',
            taxRate: 0,
            applicableCategories: [],
            isGlobal: false,
            status: 'active',
          });
          setSelectedTaxCategory(null);
          setError(null);
        }}
        title={showEditModal ? 'Edit Tax Category' : 'Add Tax Category'}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Tax Category Name *"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., GST 18%"
            required
          />

          <div>
            <label className="block text-sm font-medium text-white mb-2">Tax Type *</label>
            <select
              value={formData.taxType}
              onChange={(e) => setFormData({ ...formData, taxType: e.target.value as 'gst' | 'vat' })}
              className="w-full px-4 py-3 rounded-lg bg-[#0B0B0B] border border-[#242424] text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
            >
              <option value="gst">GST (Goods and Services Tax)</option>
              <option value="vat">VAT (Value Added Tax)</option>
            </select>
          </div>

          <Input
            label="Tax Rate (%) *"
            type="number"
            value={formData.taxRate.toString()}
            onChange={(e) => setFormData({ ...formData, taxRate: parseFloat(e.target.value) || 0 })}
            placeholder="e.g., 18"
            min={0}
            max={100}
            step={0.01}
            required
          />

          <div>
            <label className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={formData.isGlobal}
                onChange={(e) => setFormData({ ...formData, isGlobal: e.target.checked, applicableCategories: e.target.checked ? [] : formData.applicableCategories })}
                className="w-4 h-4 rounded border-[#242424] bg-[#0B0B0B] text-primary focus:ring-2 focus:ring-[#D4AF37]"
              />
              <span className="text-sm font-medium text-white">Global Tax (Applies to all categories)</span>
            </label>
            <p className="text-xs text-text-muted ml-6">
              If checked, this tax will be used as a fallback when no category-specific tax is found
            </p>
          </div>

          {!formData.isGlobal && (
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Applicable Categories ({formData.applicableCategories?.length || 0} selected)
              </label>
              <div className="max-h-48 overflow-y-auto border border-[#242424] rounded-lg p-3 bg-[#0B0B0B]">
                {categories.length === 0 ? (
                  <p className="text-text-muted text-sm">No categories available</p>
                ) : (
                  <div className="space-y-2">
                    {categories.map((category) => (
                      <label key={category.id} className="flex items-center gap-2 cursor-pointer hover:bg-[#1A1A1A] p-2 rounded">
                        <input
                          type="checkbox"
                          checked={formData.applicableCategories?.includes(category.id) || false}
                          onChange={() => toggleCategorySelection(category.id)}
                          className="w-4 h-4 rounded border-[#242424] bg-[#0B0B0B] text-primary focus:ring-2 focus:ring-[#D4AF37]"
                        />
                        <span className="text-sm text-white">{category.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

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
              disabled={actionLoading === 'submit' || !formData.name.trim() || formData.taxRate < 0 || formData.taxRate > 100}
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
                  name: '',
                  taxType: 'gst',
                  taxRate: 0,
                  applicableCategories: [],
                  isGlobal: false,
                  status: 'active',
                });
                setSelectedTaxCategory(null);
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

