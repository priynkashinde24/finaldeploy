'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getResellerProducts, toggleResellerProductStatus, ResellerProduct } from '@/lib/resellerProducts';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

export default function ResellerProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<ResellerProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const currentUser = getCurrentUser();

  useEffect(() => {
    if (currentUser?.role !== 'reseller') {
      router.push('/unauthorized');
      return;
    }
    loadProducts();
  }, [currentUser, router]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await getResellerProducts();

      if (response.success && response.data) {
        // Filter only active products
        const activeProducts = response.data.products.filter((p) => p.status === 'active');
        setProducts(activeProducts);
      } else {
        setError(response.message || 'Failed to load products');
      }
    } catch (err: any) {
      console.error('[RESELLER PRODUCTS] Load error:', err);
      setError(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (product: ResellerProduct) => {
    try {
      setActionLoading(product._id);
      setError(null);

      const newStatus = product.status === 'active' ? 'inactive' : 'active';
      const response = await toggleResellerProductStatus(product._id, newStatus);

      if (response.success) {
        setSuccessMessage(`Product ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`);
        loadProducts();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(response.message || 'Failed to update product status');
      }
    } catch (err: any) {
      console.error('[RESELLER PRODUCTS] Toggle status error:', err);
      setError(err.message || 'Failed to update product status');
    } finally {
      setActionLoading(null);
    }
  };

  const getProductName = (product: ResellerProduct): string => {
    if (typeof product.productId === 'object' && product.productId !== null) {
      return (product.productId as any).name || 'Unknown Product';
    }
    return 'Unknown Product';
  };

  const getVariantInfo = (product: ResellerProduct): string => {
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

  const getSupplierName = (product: ResellerProduct): string => {
    if (typeof product.supplierId === 'object' && product.supplierId !== null) {
      return (product.supplierId as any).name || 'Unknown Supplier';
    }
    return 'Unknown Supplier';
  };

  const getSupplierStock = (product: ResellerProduct): number | null => {
    // Stock info would come from supplier product
    // For now, we'll need to get this from the backend response
    // This is a placeholder - backend should include stock info
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Product Catalog</h1>
          <p className="text-text-secondary">Manage products in your catalog</p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => router.push('/reseller/products/add')}
          disabled={actionLoading !== null}
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Product
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

      {/* Products Table */}
      <Card className="bg-surface border-border">
        <CardHeader>
          <CardTitle>My Products ({products.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-text-secondary">Loading products...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-text-secondary mb-4">No products in your catalog yet</p>
              <Button
                variant="primary"
                onClick={() => router.push('/reseller/products/add')}
              >
                Add First Product
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#242424]">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Product Name</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Variant</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Supplier</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Cost Price</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Margin</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Selling Price</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Status</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-white">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const isLoading = actionLoading === product._id;

                    return (
                      <tr key={product._id} className="border-b border-[#242424] hover:bg-[#1A1A1A] transition-colors">
                        <td className="py-3 px-4">
                          <p className="text-white font-medium">{getProductName(product)}</p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-white text-sm">{getVariantInfo(product)}</p>
                        </td>
                        <td className="py-3 px-4 text-text-secondary text-sm">
                          {getSupplierName(product)}
                        </td>
                        <td className="py-3 px-4 text-text-secondary text-sm">
                          {/* Cost price would come from supplier product - placeholder */}
                          ₹—
                        </td>
                        <td className="py-3 px-4 text-white font-medium">
                          {product.margin}%
                        </td>
                        <td className="py-3 px-4 text-white font-medium">
                          ₹{product.sellingPrice.toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={cn(
                              'px-2 py-1 rounded text-xs font-semibold',
                              product.status === 'active'
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-gray-500/20 text-gray-400'
                            )}
                          >
                            {product.status === 'active' ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => router.push(`/reseller/products/${product._id}/edit`)}
                              disabled={isLoading}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleStatus(product)}
                              disabled={isLoading}
                              className={cn(
                                product.status === 'active'
                                  ? 'border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10'
                                  : 'border-green-500/50 text-green-400 hover:bg-green-500/10'
                              )}
                            >
                              {isLoading ? '...' : product.status === 'active' ? 'Disable' : 'Enable'}
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
    </div>
  );
}
