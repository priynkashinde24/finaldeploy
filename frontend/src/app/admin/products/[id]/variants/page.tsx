'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getProductById, Product } from '@/lib/adminProducts';
import { getVariants, toggleVariantStatus, ProductVariant } from '@/lib/adminVariants';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

export default function ProductVariantsPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [editFormData, setEditFormData] = useState({
    sku: '',
    basePrice: 0,
    status: 'active' as 'active' | 'inactive',
  });

  const currentUser = getCurrentUser();

  useEffect(() => {
    if (currentUser?.role !== 'admin') {
      router.push('/unauthorized');
      return;
    }
    loadData();
  }, [currentUser, router, productId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [productResponse, variantsResponse] = await Promise.all([
        getProductById(productId),
        getVariants(productId),
      ]);

      if (productResponse.success && productResponse.data) {
        setProduct(productResponse.data.product);
      } else {
        setError(productResponse.message || 'Failed to load product');
      }

      if (variantsResponse.success && variantsResponse.data) {
        setVariants(variantsResponse.data.variants);
      } else {
        setError(variantsResponse.message || 'Failed to load variants');
      }
    } catch (err: any) {
      console.error('[PRODUCT VARIANTS] Load error:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (variant: ProductVariant) => {
    setSelectedVariant(variant);
    setEditFormData({
      sku: variant.sku,
      basePrice: variant.basePrice,
      status: variant.status,
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedVariant) return;

    if (!editFormData.sku.trim()) {
      setError('SKU is required');
      return;
    }

    try {
      setActionLoading('edit');
      setError(null);

      const { updateVariant } = await import('@/lib/adminVariants');
      const response = await updateVariant(selectedVariant.id, editFormData);

      if (response.success) {
        setSuccessMessage('Variant updated successfully');
        setShowEditModal(false);
        setSelectedVariant(null);
        loadData();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(response.message || 'Failed to update variant');
      }
    } catch (err: any) {
      console.error('[PRODUCT VARIANTS] Edit error:', err);
      setError(err.message || 'Failed to update variant');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleStatus = async (variant: ProductVariant) => {
    try {
      setActionLoading(variant.id);
      setError(null);

      const newStatus = variant.status === 'active' ? 'inactive' : 'active';
      const response = await toggleVariantStatus(variant.id, newStatus);

      if (response.success) {
        setSuccessMessage(`Variant ${newStatus === 'active' ? 'enabled' : 'disabled'} successfully`);
        loadData();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(response.message || 'Failed to update variant status');
      }
    } catch (err: any) {
      console.error('[PRODUCT VARIANTS] Toggle status error:', err);
      setError(err.message || 'Failed to update variant status');
    } finally {
      setActionLoading(null);
    }
  };

  const formatAttributes = (variant: ProductVariant): string => {
    return variant.attributes
      .map((attr) => {
        const name = attr.attributeName || attr.attributeCode || 'Unknown';
        return `${name}: ${attr.value}`;
      })
      .join(', ');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => router.push('/admin/products')}>
            ← Back to Products
          </Button>
          <h1 className="text-3xl font-bold text-white mt-4 mb-2">Product Variants</h1>
          {product && (
            <div className="text-text-secondary">
              <p className="font-medium text-white">{product.name}</p>
              <p className="text-sm">Category: {product.category || '—'}</p>
            </div>
          )}
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => router.push(`/admin/products/${productId}/variants/new`)}
          disabled={actionLoading !== null}
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Generate Variants
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

      {/* Variants Table */}
      <Card className="bg-surface border-border">
        <CardHeader>
          <CardTitle>Variants ({variants.length} total)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-text-secondary">Loading variants...</p>
            </div>
          ) : variants.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-text-secondary mb-4">No variants found for this product.</p>
              <Button
                variant="primary"
                onClick={() => router.push(`/admin/products/${productId}/variants/new`)}
              >
                Generate Variants
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#242424]">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">SKU</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Attributes</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Base Price</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Status</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-white">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map((variant) => {
                    const isLoading = actionLoading === variant.id;

                    return (
                      <tr key={variant.id} className="border-b border-[#242424] hover:bg-[#1A1A1A] transition-colors">
                        <td className="py-3 px-4">
                          <code className="text-sm text-text-secondary bg-[#0B0B0B] px-2 py-1 rounded">
                            {variant.sku}
                          </code>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-white text-sm">{formatAttributes(variant)}</span>
                        </td>
                        <td className="py-3 px-4 text-white font-medium">
                          ₹{variant.basePrice.toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={cn(
                              'px-2 py-1 rounded text-xs font-semibold',
                              variant.status === 'active'
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-gray-500/20 text-gray-400'
                            )}
                          >
                            {variant.status === 'active' ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleEdit(variant)}
                              disabled={isLoading}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleStatus(variant)}
                              disabled={isLoading}
                              className={cn(
                                variant.status === 'active'
                                  ? 'border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10'
                                  : 'border-green-500/50 text-green-400 hover:bg-green-500/10'
                              )}
                            >
                              {isLoading ? '...' : variant.status === 'active' ? 'Disable' : 'Enable'}
                            </Button>
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

      {/* Edit Variant Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedVariant(null);
          setError(null);
        }}
        title="Edit Variant"
        size="md"
      >
        {selectedVariant && (
          <div className="space-y-4">
            <div className="p-3 bg-surfaceLight rounded-lg">
              <p className="text-sm text-text-muted mb-2">Attributes (immutable):</p>
              <p className="text-white font-medium">{formatAttributes(selectedVariant)}</p>
            </div>

            <Input
              label="SKU *"
              value={editFormData.sku}
              onChange={(e) => setEditFormData({ ...editFormData, sku: e.target.value })}
              required
            />

            <Input
              label="Base Price *"
              type="number"
              value={editFormData.basePrice}
              onChange={(e) => setEditFormData({ ...editFormData, basePrice: parseFloat(e.target.value) || 0 })}
              min="0"
              step="0.01"
              required
            />

            <div>
              <label className="block text-sm font-medium text-white mb-2">Status</label>
              <select
                value={editFormData.status}
                onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as 'active' | 'inactive' })}
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
                onClick={handleSaveEdit}
                disabled={actionLoading === 'edit' || !editFormData.sku.trim()}
                className="flex-1"
              >
                {actionLoading === 'edit' ? 'Saving...' : 'Update'}
              </Button>
              <Button
                variant="ghost"
                size="md"
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedVariant(null);
                  setError(null);
                }}
                disabled={actionLoading === 'edit'}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

