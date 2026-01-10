'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import {
  getProductsWithVariants,
  createSupplierVariant,
  ProductWithVariants,
  ProductVariant,
  CreateSupplierVariantData,
} from '@/lib/supplierVariants';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

export default function AddVariantInventoryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');

  const [formData, setFormData] = useState<CreateSupplierVariantData>({
    productId: '',
    variantId: '',
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
    loadProducts();
  }, [currentUser, router]);

  useEffect(() => {
    if (selectedProductId) {
      setFormData((prev) => ({ ...prev, productId: selectedProductId }));
      // Reset variant selection when product changes
      setSelectedVariantId('');
      setFormData((prev) => ({ ...prev, variantId: '' }));
    }
  }, [selectedProductId]);

  useEffect(() => {
    if (selectedVariantId) {
      setFormData((prev) => ({ ...prev, variantId: selectedVariantId }));
    }
  }, [selectedVariantId]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await getProductsWithVariants();

      if (response.success && response.data) {
        setProducts(response.data.products);
      } else {
        setError(response.message || 'Failed to load products');
      }
    } catch (err: any) {
      console.error('[ADD VARIANT INVENTORY] Load error:', err);
      setError(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.brand?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedProduct = products.find((p) => p._id === selectedProductId);
  const selectedVariant = selectedProduct?.variants?.find((v) => v.id === selectedVariantId);

  const formatVariantAttributes = (variant: ProductVariant): string => {
    if (!variant.attributes || variant.attributes.length === 0) return variant.sku;
    return variant.attributes
      .map((attr) => {
        const name = attr.attributeName || attr.attributeCode || 'Unknown';
        return `${name}: ${attr.value}`;
      })
      .join(', ');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.productId) {
      setError('Please select a product');
      return;
    }

    if (!formData.variantId) {
      setError('Please select a variant');
      return;
    }

    if (formData.costPrice <= 0) {
      setError('Cost price must be greater than 0');
      return;
    }

    if (formData.stockQuantity < 0) {
      setError('Stock quantity cannot be negative');
      return;
    }

    if (formData.minOrderQty < 1) {
      setError('Minimum order quantity must be at least 1');
      return;
    }

    try {
      setSaving(true);

      const response = await createSupplierVariant(formData);

      if (response.success) {
        router.push('/supplier/inventory');
      } else {
        setError(response.message || 'Failed to create inventory mapping');
      }
    } catch (err: any) {
      console.error('[ADD VARIANT INVENTORY] Create error:', err);
      setError(err.message || 'Failed to create inventory mapping');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading products with variants...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Add Variant Inventory</h1>
        <p className="text-text-secondary">Select a product variant and add your inventory details</p>
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
          <CardTitle>Select Product & Variant</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Product Selection */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Select Product <span className="text-red-400">*</span>
              </label>
              <Input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search products by name, category, or brand..."
                className="w-full mb-2"
              />
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg bg-[#0B0B0B] border border-[#242424] text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              >
                <option value="">-- Select a product --</option>
                {filteredProducts.map((product) => (
                  <option key={product._id} value={product._id}>
                    {product.name} {product.brand && `(${product.brand})`} - {product.variants?.length || 0} variant(s)
                  </option>
                ))}
              </select>
              {selectedProduct && (
                <div className="mt-2 p-3 bg-[#1A1A1A] rounded-lg">
                  <p className="text-sm text-text-secondary">
                    <strong className="text-white">Selected:</strong> {selectedProduct.name}
                    {selectedProduct.category && ` • ${selectedProduct.category}`}
                    {selectedProduct.brand && ` • ${selectedProduct.brand}`}
                  </p>
                </div>
              )}
            </div>

            {/* Variant Selection */}
            {selectedProduct && selectedProduct.variants && selectedProduct.variants.length > 0 && (
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
                  {selectedProduct.variants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {formatVariantAttributes(variant)} - SKU: {variant.sku} - ₹{variant.basePrice}
                    </option>
                  ))}
                </select>
                {selectedVariant && (
                  <div className="mt-2 p-3 bg-[#1A1A1A] rounded-lg">
                    <p className="text-sm text-white font-medium mb-1">
                      {formatVariantAttributes(selectedVariant)}
                    </p>
                    <p className="text-xs text-text-muted">
                      SKU: {selectedVariant.sku} • Base Price: ₹{selectedVariant.basePrice}
                    </p>
                  </div>
                )}
              </div>
            )}

            {selectedProduct && (!selectedProduct.variants || selectedProduct.variants.length === 0) && (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-sm text-yellow-400">
                  This product has no active variants. Please select a different product or contact admin to create variants.
                </p>
              </div>
            )}

            {/* Supplier SKU (Optional) */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Supplier SKU (Optional)
              </label>
              <Input
                type="text"
                value={formData.supplierSku}
                onChange={(e) => setFormData((prev) => ({ ...prev, supplierSku: e.target.value.toUpperCase() }))}
                placeholder="YOUR-SKU-001"
                className="w-full font-mono"
              />
              <p className="text-xs text-text-muted mt-1">
                Your internal SKU for this variant (optional)
              </p>
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
              <p className="text-xs text-text-muted mt-1">
                Your cost price (what you charge resellers)
              </p>
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
                  ⚠️ Warning: Stock is 0. Variant will not be available to resellers.
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
                disabled={saving || !formData.productId || !formData.variantId}
                className="flex-1"
              >
                {saving ? 'Creating...' : 'Add to Inventory'}
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
