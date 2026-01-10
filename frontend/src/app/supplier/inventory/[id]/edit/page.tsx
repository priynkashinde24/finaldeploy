'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getSupplierVariants, updateSupplierVariant, SupplierVariant, UpdateSupplierVariantData } from '@/lib/supplierVariants';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

export default function EditInventoryPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const [product, setProduct] = useState<SupplierVariant | null>(null);
  const [formData, setFormData] = useState<UpdateSupplierVariantData>({
    supplierSku: '',
    costPrice: 0,
    stockQuantity: 0,
    minOrderQty: 1,
    status: 'active',
  });

  const currentUser = getCurrentUser();

  useEffect(() => {
    if (currentUser?.role !== 'supplier') {
      router.push('/unauthorized');
      return;
    }
    loadProduct();
  }, [currentUser, router, productId]);

  const loadProduct = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await getSupplierVariants();
      
      if (response.success && response.data) {
        const foundProduct = response.data.products.find((p) => p._id === productId && p.variantId);
        if (foundProduct) {
          setProduct(foundProduct);
          setFormData({
            supplierSku: foundProduct.supplierSku,
            costPrice: foundProduct.costPrice,
            stockQuantity: foundProduct.stockQuantity,
            minOrderQty: foundProduct.minOrderQty,
            status: foundProduct.status,
          });
        } else {
          setError('Variant inventory not found');
        }
      } else {
        setError(response.message || 'Failed to load product');
      }
    } catch (err: any) {
      console.error('[EDIT INVENTORY] Load error:', err);
      setError(err.message || 'Failed to load product');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // Validation
    if (!formData.supplierSku?.trim()) {
      setError('Supplier SKU is required');
      return;
    }

    if (formData.costPrice !== undefined && formData.costPrice <= 0) {
      setError('Cost price must be greater than 0');
      return;
    }

    if (formData.stockQuantity !== undefined && formData.stockQuantity < 0) {
      setError('Stock quantity cannot be negative');
      return;
    }

    if (formData.minOrderQty !== undefined && formData.minOrderQty < 1) {
      setError('Minimum order quantity must be at least 1');
      return;
    }

    try {
      setSaving(true);
      
      const response = await updateSupplierVariant(productId, formData);

      if (response.success) {
        setSuccessMessage('Inventory updated successfully');
        setTimeout(() => {
          router.push('/supplier/inventory');
        }, 1500);
      } else {
        setError(response.message || 'Failed to update inventory');
      }
    } catch (err: any) {
      console.error('[EDIT INVENTORY] Update error:', err);
      setError(err.message || 'Failed to update inventory');
    } finally {
      setSaving(false);
    }
  };

  const getProductName = (): string => {
    if (!product) return 'Unknown Product';
    if (typeof product.productId === 'object' && product.productId !== null) {
      return (product.productId as any).name || 'Unknown Product';
    }
    return 'Unknown Product';
  };

  const getVariantInfo = (): string => {
    if (!product) return '—';
    if (typeof product.variantId === 'object' && product.variantId !== null) {
      const variant = product.variantId as any;
      if (variant.attributes && Array.isArray(variant.attributes)) {
        return variant.attributes
          .map((attr: any) => {
            const name = attr.attributeName || attr.attributeCode || 'Unknown';
            return `${name}: ${attr.value}`;
          })
          .join(', ');
      }
      return variant.sku || '—';
    }
    return '—';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading product...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="space-y-6">
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          Product not found
        </div>
        <Button variant="outline" onClick={() => router.push('/supplier/inventory')}>
          Back to Inventory
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Edit Inventory</h1>
        <p className="text-text-secondary">Update inventory details for {getProductName()}</p>
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

      {/* Form */}
      <Card className="bg-surface border-border">
        <CardHeader>
          <CardTitle>Inventory Details</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Read-only Product & Variant Info */}
          <div className="mb-6 p-4 bg-[#1A1A1A] rounded-lg border border-[#242424]">
            <p className="text-sm text-text-secondary mb-1">Product</p>
            <p className="text-white font-medium">{getProductName()}</p>
            <p className="text-sm text-text-secondary mb-1 mt-3">Variant</p>
            <p className="text-white font-medium">{getVariantInfo()}</p>
            <p className="text-xs text-text-muted mt-1">Product and variant cannot be changed</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Supplier SKU */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Supplier SKU <span className="text-red-400">*</span>
              </label>
              <Input
                type="text"
                value={formData.supplierSku}
                onChange={(e) => setFormData((prev) => ({ ...prev, supplierSku: e.target.value.toUpperCase() }))}
                required
                placeholder="YOUR-SKU-001"
                className="w-full font-mono"
              />
            </div>

            {/* Cost Price */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Cost Price (₹) <span className="text-red-400">*</span>
              </label>
              <Input
                type="number"
                value={formData.costPrice || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, costPrice: parseFloat(e.target.value) || 0 }))}
                required
                min="0"
                step="0.01"
                placeholder="0.00"
                className="w-full"
              />
            </div>

            {/* Stock Quantity */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Stock Quantity <span className="text-red-400">*</span>
              </label>
              <Input
                type="number"
                value={formData.stockQuantity || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, stockQuantity: parseInt(e.target.value) || 0 }))}
                required
                min="0"
                placeholder="0"
                className="w-full"
              />
              {formData.stockQuantity === 0 && (
                <p className="text-xs text-yellow-400 mt-1">
                  Warning: Stock is 0. Product will not be available to resellers.
                </p>
              )}
            </div>

            {/* Min Order Quantity */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Minimum Order Quantity <span className="text-red-400">*</span>
              </label>
              <Input
                type="number"
                value={formData.minOrderQty || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, minOrderQty: parseInt(e.target.value) || 1 }))}
                required
                min="1"
                placeholder="1"
                className="w-full"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as 'active' | 'inactive' }))}
                className="w-full px-4 py-2 bg-[#121212] border border-[#242424] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={saving}
                className="flex-1"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={() => router.push('/supplier/inventory')}
                disabled={saving}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

