'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getSupplierVariants, toggleSupplierVariantStatus, SupplierVariant } from '@/lib/supplierVariants';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

export default function SupplierInventoryPage() {
  const router = useRouter();
  const [products, setProducts] = useState<SupplierVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const currentUser = getCurrentUser();

  useEffect(() => {
    if (currentUser?.role !== 'supplier') {
      router.push('/unauthorized');
      return;
    }
    loadInventory();
  }, [currentUser, router]);

  const loadInventory = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await getSupplierVariants();
      
      if (response.success && response.data) {
        // Filter only variant-level inventory (has variantId)
        const variantInventory = response.data.products.filter((p) => p.variantId);
        setProducts(variantInventory);
      } else {
        setError(response.message || 'Failed to load inventory');
      }
    } catch (err: any) {
      console.error('[SUPPLIER INVENTORY] Load error:', err);
      setError(err.message || 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (product: SupplierVariant) => {
    try {
      setActionLoading(product._id);
      setError(null);
      
      const newStatus = product.status === 'active' ? 'inactive' : 'active';
      const response = await toggleSupplierVariantStatus(product._id, newStatus);
      
      if (response.success) {
        setSuccessMessage(`Product ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`);
        loadInventory(); // Refresh list
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(response.message || 'Failed to update product status');
      }
    } catch (err: any) {
      console.error('[SUPPLIER INVENTORY] Toggle status error:', err);
      setError(err.message || 'Failed to update product status');
    } finally {
      setActionLoading(null);
    }
  };

  const getProductName = (product: SupplierVariant): string => {
    if (typeof product.productId === 'object' && product.productId !== null) {
      return (product.productId as any).name || 'Unknown Product';
    }
    return 'Unknown Product';
  };

  const getVariantInfo = (product: SupplierVariant): string => {
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

  const getVariantSku = (product: SupplierVariant): string => {
    if (typeof product.variantId === 'object' && product.variantId !== null) {
      return (product.variantId as any).sku || '—';
    }
    return '—';
  };

  const isAvailable = (product: SupplierVariant): boolean => {
    const globalProduct = typeof product.productId === 'object' ? product.productId : null;
    const variant = typeof product.variantId === 'object' ? product.variantId : null;
    return (
      globalProduct?.status === 'active' &&
      variant?.status === 'active' &&
      product.status === 'active' &&
      product.stockQuantity > 0
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Variant Inventory</h1>
          <p className="text-text-secondary">Manage inventory at variant level</p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => router.push('/supplier/inventory/add')}
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Variant Inventory
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

      {/* Inventory Table */}
      <Card className="bg-surface border-border">
        <CardHeader>
          <CardTitle>Variant Inventory ({products.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-text-secondary">Loading inventory...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-text-secondary mb-4">No variant inventory mapped yet</p>
              <Button
                variant="primary"
                onClick={() => router.push('/supplier/inventory/add')}
              >
                Add First Variant
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#242424]">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Product Name</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Variant</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">SKU</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Cost Price</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Stock</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Status</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-white">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const isLoading = actionLoading === product._id;
                    const available = isAvailable(product);
                    
                    return (
                      <tr key={product._id} className="border-b border-[#242424] hover:bg-[#1A1A1A] transition-colors">
                        <td className="py-3 px-4">
                          <p className="text-white font-medium">{getProductName(product)}</p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-white text-sm">{getVariantInfo(product)}</p>
                          {product.supplierSku && (
                            <p className="text-text-muted text-xs font-mono mt-1">
                              Supplier SKU: {product.supplierSku}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-text-secondary text-sm font-mono">
                          {getVariantSku(product)}
                        </td>
                        <td className="py-3 px-4 text-white font-medium">
                          ₹{product.costPrice.toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              'font-medium',
                              product.stockQuantity === 0 ? 'text-red-400' : 'text-white'
                            )}>
                              {product.stockQuantity}
                            </span>
                            {product.stockQuantity === 0 && (
                              <span className="px-2 py-1 rounded text-xs font-semibold bg-red-500/20 text-red-400 ml-2">
                                Out of Stock
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-1">
                            <span
                              className={cn(
                                'px-2 py-1 rounded text-xs font-semibold',
                                product.status === 'active'
                                  ? 'bg-green-500/20 text-green-400'
                                  : 'bg-red-500/20 text-red-400'
                              )}
                            >
                              {product.status === 'active' ? 'Active' : 'Inactive'}
                            </span>
                            {!available && product.status === 'active' && (
                              <span className="text-xs text-yellow-400">Not available</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/supplier/inventory/${product._id}/edit`)}
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
                                  ? 'border-red-500/50 text-red-400 hover:bg-red-500/10'
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
