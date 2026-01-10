'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getResellerProducts, updateResellerProduct, ResellerProduct, UpdateResellerProductData } from '@/lib/resellerProducts';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

export default function EditResellerProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [product, setProduct] = useState<ResellerProduct | null>(null);
  const [formData, setFormData] = useState<UpdateResellerProductData>({
    sellingPrice: 0,
    margin: 0,
    status: 'active',
  });

  const [marginType, setMarginType] = useState<'percent' | 'fixed'>('percent');
  const [marginValue, setMarginValue] = useState<number>(0);
  const [costPrice, setCostPrice] = useState<number>(0);

  const currentUser = getCurrentUser();

  useEffect(() => {
    if (currentUser?.role !== 'reseller') {
      router.push('/unauthorized');
      return;
    }
    loadProduct();
  }, [currentUser, router, productId]);

  useEffect(() => {
    if (product) {
      setFormData({
        sellingPrice: product.sellingPrice,
        margin: product.margin,
        status: product.status,
      });
      setMarginValue(product.margin);
      // Determine margin type based on margin value
      // If margin > 100, it's likely a percentage, otherwise could be either
      // For simplicity, we'll assume percentage by default
      setMarginType('percent');
      // Cost price would come from supplier product - placeholder
      // In real implementation, this should be fetched from supplier product
      setCostPrice(0);
    }
  }, [product]);

  const loadProduct = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await getResellerProducts();

      if (response.success && response.data) {
        const foundProduct = response.data.products.find((p) => p._id === productId);
        if (foundProduct) {
          setProduct(foundProduct);
        } else {
          setError('Product not found');
        }
      } else {
        setError(response.message || 'Failed to load product');
      }
    } catch (err: any) {
      console.error('[EDIT RESELLER PRODUCT] Load error:', err);
      setError(err.message || 'Failed to load product');
    } finally {
      setLoading(false);
    }
  };

  const calculateSellingPrice = (cost: number, margin: number, type: 'percent' | 'fixed') => {
    let sellingPrice = 0;
    if (type === 'percent') {
      sellingPrice = cost * (1 + margin / 100);
    } else {
      sellingPrice = cost + margin;
    }
    setFormData((prev) => ({ ...prev, sellingPrice: Math.round(sellingPrice * 100) / 100 }));
  };

  const handleMarginChange = (value: number) => {
    setMarginValue(value);
    if (costPrice > 0) {
      calculateSellingPrice(costPrice, value, marginType);
    }
  };

  const handleSellingPriceChange = (value: number) => {
    setFormData((prev) => ({ ...prev, sellingPrice: value }));
    // Recalculate margin when selling price is manually changed
    if (costPrice > 0 && value > 0) {
      if (marginType === 'percent') {
        const newMargin = ((value - costPrice) / costPrice) * 100;
        setMarginValue(Math.round(newMargin * 100) / 100);
      } else {
        const newMargin = value - costPrice;
        setMarginValue(Math.round(newMargin * 100) / 100);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // Validation
    if (formData.sellingPrice !== undefined && formData.sellingPrice <= 0) {
      setError('Selling price must be greater than 0');
      return;
    }

    if (marginValue < 0) {
      setError('Margin must be non-negative');
      return;
    }

    if (costPrice > 0 && formData.sellingPrice !== undefined && formData.sellingPrice <= costPrice) {
      setError('Selling price must be greater than cost price');
      return;
    }

    // Set margin based on type
    const finalMargin = marginType === 'percent' ? marginValue : (marginValue / (costPrice || 1)) * 100;
    const submitData = {
      ...formData,
      margin: Math.round(finalMargin * 100) / 100,
    };

    try {
      setSaving(true);

      const response = await updateResellerProduct(productId, submitData);

      if (response.success) {
        setSuccessMessage('Product updated successfully');
        setTimeout(() => {
          router.push('/reseller/products');
        }, 1500);
      } else {
        setError(response.message || 'Failed to update product');
      }
    } catch (err: any) {
      console.error('[EDIT RESELLER PRODUCT] Update error:', err);
      setError(err.message || 'Failed to update product');
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

  const getSupplierName = (): string => {
    if (!product) return 'Unknown Supplier';
    if (typeof product.supplierId === 'object' && product.supplierId !== null) {
      return (product.supplierId as any).name || 'Unknown Supplier';
    }
    return 'Unknown Supplier';
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
        <Button variant="outline" onClick={() => router.push('/reseller/products')}>
          Back to Products
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Edit Product</h1>
        <p className="text-text-secondary">Update margin and selling price for {getProductName()}</p>
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
          <CardTitle>Product Details</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Read-only Info */}
          <div className="mb-6 space-y-3 p-4 bg-[#1A1A1A] rounded-lg border border-[#242424]">
            <div>
              <p className="text-sm text-text-secondary mb-1">Product</p>
              <p className="text-white font-medium">{getProductName()}</p>
            </div>
            <div>
              <p className="text-sm text-text-secondary mb-1">Variant</p>
              <p className="text-white font-medium">{getVariantInfo()}</p>
            </div>
            <div>
              <p className="text-sm text-text-secondary mb-1">Supplier</p>
              <p className="text-white font-medium">{getSupplierName()}</p>
            </div>
            <div>
              <p className="text-sm text-text-secondary mb-1">Cost Price</p>
              <p className="text-white font-medium">₹{costPrice > 0 ? costPrice.toLocaleString() : '—'}</p>
            </div>
            <p className="text-xs text-text-muted mt-2">Product, variant, supplier, and cost price cannot be changed</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Margin */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Margin <span className="text-red-400">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={marginType}
                  onChange={(e) => {
                    setMarginType(e.target.value as 'percent' | 'fixed');
                    handleMarginChange(marginValue);
                  }}
                  className="px-4 py-3 rounded-lg bg-[#0B0B0B] border border-[#242424] text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                >
                  <option value="percent">%</option>
                  <option value="fixed">₹</option>
                </select>
                <Input
                  type="number"
                  value={marginValue || ''}
                  onChange={(e) => handleMarginChange(parseFloat(e.target.value) || 0)}
                  required
                  min="0"
                  step="0.01"
                  placeholder={marginType === 'percent' ? '20' : '100'}
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-text-muted mt-1">
                {marginType === 'percent'
                  ? 'Percentage markup (e.g., 20 = 20% markup)'
                  : 'Fixed amount markup (e.g., 100 = ₹100 markup)'}
              </p>
            </div>

            {/* Selling Price */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Selling Price <span className="text-red-400">*</span>
              </label>
              <Input
                type="number"
                value={formData.sellingPrice || ''}
                onChange={(e) => handleSellingPriceChange(parseFloat(e.target.value) || 0)}
                required
                min="0"
                step="0.01"
                placeholder="0.00"
                className="w-full"
              />
              <p className="text-xs text-text-muted mt-1">
                Auto-calculated from cost + margin. You can override manually.
              </p>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as 'active' | 'inactive' }))}
                className="w-full px-4 py-3 rounded-lg bg-[#0B0B0B] border border-[#242424] text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
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
                onClick={() => router.push('/reseller/products')}
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

