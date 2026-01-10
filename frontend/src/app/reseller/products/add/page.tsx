'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getAvailableSupplierVariants, createResellerProduct, SupplierVariant, CreateResellerProductData } from '@/lib/resellerProducts';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

interface SupplierWithVariants {
  _id: string;
  name: string;
  email: string;
  variants: SupplierVariant[];
}

export default function AddResellerProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [suppliers, setSuppliers] = useState<SupplierWithVariants[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');

  const [formData, setFormData] = useState<CreateResellerProductData>({
    productId: '',
    variantId: '',
    supplierId: '',
    sellingPrice: 0,
    margin: 0,
    status: 'active',
  });

  const [marginType, setMarginType] = useState<'percent' | 'fixed'>('percent');
  const [marginValue, setMarginValue] = useState<number>(0);

  const currentUser = getCurrentUser();

  useEffect(() => {
    if (currentUser?.role !== 'reseller') {
      router.push('/unauthorized');
      return;
    }
    loadSuppliers();
  }, [currentUser, router]);

  useEffect(() => {
    if (selectedSupplierId) {
      setFormData((prev) => ({ ...prev, supplierId: selectedSupplierId }));
      setSelectedProductId('');
      setSelectedVariantId('');
    }
  }, [selectedSupplierId]);

  useEffect(() => {
    if (selectedVariantId) {
      setFormData((prev) => ({ ...prev, variantId: selectedVariantId }));
      // Find the selected variant to get cost price
      const supplier = suppliers.find((s) => s._id === selectedSupplierId);
      const variant = supplier?.variants.find((v) => v._id === selectedVariantId);
      if (variant) {
        const costPrice = variant.costPrice;
        calculateSellingPrice(costPrice, marginValue, marginType);
      }
    }
  }, [selectedVariantId, marginValue, marginType, selectedSupplierId, suppliers]);

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await getAvailableSupplierVariants();

      if (response.success && response.data) {
        setSuppliers(response.data.suppliers || []);
      } else {
        // If endpoint doesn't exist, show message
        setError(response.message || 'Failed to load available variants. Please contact support.');
      }
    } catch (err: any) {
      console.error('[ADD RESELLER PRODUCT] Load error:', err);
      setError(err.message || 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  const calculateSellingPrice = (costPrice: number, margin: number, type: 'percent' | 'fixed') => {
    let sellingPrice = 0;
    if (type === 'percent') {
      sellingPrice = costPrice * (1 + margin / 100);
    } else {
      sellingPrice = costPrice + margin;
    }
    setFormData((prev) => ({ ...prev, sellingPrice: Math.round(sellingPrice * 100) / 100 }));
  };

  const handleMarginChange = (value: number) => {
    setMarginValue(value);
    const supplier = suppliers.find((s) => s._id === selectedSupplierId);
    const variant = supplier?.variants.find((v) => v._id === selectedVariantId);
    if (variant) {
      calculateSellingPrice(variant.costPrice, value, marginType);
    }
  };

  const handleSellingPriceChange = (value: number) => {
    setFormData((prev) => ({ ...prev, sellingPrice: value }));
    // Recalculate margin when selling price is manually changed
    const supplier = suppliers.find((s) => s._id === selectedSupplierId);
    const variant = supplier?.variants.find((v) => v._id === selectedVariantId);
    if (variant && value > 0) {
      if (marginType === 'percent') {
        const newMargin = ((value - variant.costPrice) / variant.costPrice) * 100;
        setMarginValue(Math.round(newMargin * 100) / 100);
      } else {
        const newMargin = value - variant.costPrice;
        setMarginValue(Math.round(newMargin * 100) / 100);
      }
    }
  };

  const formatVariantAttributes = (variant: SupplierVariant): string => {
    if (typeof variant.variantId === 'object' && variant.variantId !== null) {
      const variantData = variant.variantId as any;
      if (variantData.attributes && Array.isArray(variantData.attributes)) {
        return variantData.attributes
          .map((attr: any) => {
            const name = attr.attributeName || attr.attributeCode || 'Unknown';
            return `${name}: ${attr.value}`;
          })
          .join(', ');
      }
      return variantData.sku || '—';
    }
    return '—';
  };

  const getProductName = (variant: SupplierVariant): string => {
    if (typeof variant.productId === 'object' && variant.productId !== null) {
      return (variant.productId as any).name || 'Unknown Product';
    }
    return 'Unknown Product';
  };

  const selectedSupplier = suppliers.find((s) => s._id === selectedSupplierId);
  const selectedVariant = selectedSupplier?.variants.find((v) => v._id === selectedVariantId);

  // Group variants by product
  const productsMap = new Map<string, SupplierVariant[]>();
  selectedSupplier?.variants.forEach((variant) => {
    const productId = typeof variant.productId === 'object' ? (variant.productId as any)._id : variant.productId;
    if (!productsMap.has(productId)) {
      productsMap.set(productId, []);
    }
    productsMap.get(productId)!.push(variant);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.supplierId) {
      setError('Please select a supplier');
      return;
    }

    if (!formData.variantId) {
      setError('Please select a variant');
      return;
    }

    if (marginValue < 0) {
      setError('Margin must be non-negative');
      return;
    }

    if (formData.sellingPrice <= 0) {
      setError('Selling price must be greater than 0');
      return;
    }

    if (selectedVariant && formData.sellingPrice <= selectedVariant.costPrice) {
      setError('Selling price must be greater than cost price');
      return;
    }

    // Set margin based on type
    const finalMargin = marginType === 'percent' ? marginValue : (marginValue / (selectedVariant?.costPrice || 1)) * 100;
    const submitData = {
      ...formData,
      margin: Math.round(finalMargin * 100) / 100,
    };

    try {
      setSaving(true);

      const response = await createResellerProduct(submitData);

      if (response.success) {
        router.push('/reseller/products');
      } else {
        setError(response.message || 'Failed to add product');
      }
    } catch (err: any) {
      console.error('[ADD RESELLER PRODUCT] Create error:', err);
      setError(err.message || 'Failed to add product');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading available variants...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Add Product to Catalog</h1>
        <p className="text-text-secondary">Select a supplier variant and set your margin</p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Form */}
      <Card className="bg-surface border-border">
        <CardHeader>
          <CardTitle>Select Supplier & Variant</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Supplier Selection */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Select Supplier <span className="text-red-400">*</span>
              </label>
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg bg-[#0B0B0B] border border-[#242424] text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              >
                <option value="">-- Select a supplier --</option>
                {suppliers.map((supplier) => (
                  <option key={supplier._id} value={supplier._id}>
                    {supplier.name} ({supplier.variants.length} variant(s) available)
                  </option>
                ))}
              </select>
            </div>

            {/* Product Selection */}
            {selectedSupplier && productsMap.size > 0 && (
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Select Product <span className="text-red-400">*</span>
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => {
                    setSelectedProductId(e.target.value);
                    setSelectedVariantId('');
                    setFormData((prev) => ({ ...prev, productId: e.target.value, variantId: '' }));
                  }}
                  required
                  className="w-full px-4 py-3 rounded-lg bg-[#0B0B0B] border border-[#242424] text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                >
                  <option value="">-- Select a product --</option>
                  {Array.from(productsMap.entries()).map(([productId, variants]) => {
                    const firstVariant = variants[0];
                    const productName = getProductName(firstVariant);
                    return (
                      <option key={productId} value={productId}>
                        {productName} ({variants.length} variant(s))
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* Variant Selection */}
            {selectedProductId && selectedSupplier && (
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Select Variant <span className="text-red-400">*</span>
                </label>
                <select
                  value={selectedVariantId}
                  onChange={(e) => setSelectedVariantId(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg bg-[#0B0B0B] border border-[#242424] text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                >
                  <option value="">-- Select a variant --</option>
                  {productsMap.get(selectedProductId)?.map((variant) => {
                    const isOutOfStock = variant.stockQuantity === 0;
                    const isInactive = variant.status !== 'active';
                    return (
                      <option
                        key={variant._id}
                        value={variant._id}
                        disabled={isOutOfStock || isInactive}
                      >
                        {formatVariantAttributes(variant)} - Cost: ₹{variant.costPrice} - Stock: {variant.stockQuantity}
                        {isOutOfStock && ' (Out of Stock)'}
                        {isInactive && ' (Inactive)'}
                      </option>
                    );
                  })}
                </select>
                {selectedVariant && selectedVariant.stockQuantity === 0 && (
                  <p className="text-xs text-red-400 mt-1">
                    ⚠️ Warning: Supplier stock is 0. This variant cannot be added.
                  </p>
                )}
              </div>
            )}

            {/* Cost Price (Read-only) */}
            {selectedVariant && (
              <div>
                <label className="block text-sm font-medium text-white mb-2">Cost Price (from supplier)</label>
                <Input
                  type="number"
                  value={selectedVariant.costPrice}
                  disabled
                  className="w-full bg-[#1A1A1A]"
                />
                <p className="text-xs text-text-muted mt-1">This is the supplier's cost price</p>
              </div>
            )}

            {/* Margin */}
            {selectedVariant && (
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
            )}

            {/* Selling Price */}
            {selectedVariant && (
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
            )}

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
                disabled={saving || !formData.supplierId || !formData.variantId || (selectedVariant?.stockQuantity === 0)}
                className="flex-1"
              >
                {saving ? 'Adding...' : 'Add to Catalog'}
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

