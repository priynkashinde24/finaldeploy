'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getProducts, toggleProductStatus, Product } from '@/lib/adminProducts';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

export default function AdminProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const currentUser = getCurrentUser();

  useEffect(() => {
    if (currentUser?.role !== 'admin') {
      router.push('/unauthorized');
      return;
    }
    loadProducts();
  }, [currentUser, router]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await getProducts();
      
      if (response.success && response.data) {
        setProducts(response.data.products);
      } else {
        setError(response.message || 'Failed to load products');
      }
    } catch (err: any) {
      console.error('[ADMIN PRODUCTS] Load error:', err);
      setError(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (product: Product) => {
    try {
      setActionLoading(product._id);
      setError(null);
      
      const newStatus = product.status === 'active' ? 'inactive' : 'active';
      const response = await toggleProductStatus(product._id, newStatus);
      
      if (response.success) {
        setSuccessMessage(`Product ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`);
        loadProducts(); // Refresh list
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(response.message || 'Failed to update product status');
      }
    } catch (err: any) {
      console.error('[ADMIN PRODUCTS] Toggle status error:', err);
      setError(err.message || 'Failed to update product status');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Global Products</h1>
          <p className="text-text-secondary">Manage global product catalog</p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => router.push('/admin/products/new')}
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
          <CardTitle>Products ({products.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-text-secondary">Loading products...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-text-secondary mb-4">No products found</p>
              <Button
                variant="primary"
                onClick={() => router.push('/admin/products/new')}
              >
                Create First Product
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#242424]">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Image</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Product Name</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Category</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Brand</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Base Price</th>
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
                          {product.images && product.images.length > 0 ? (
                            <img
                              src={product.images[0]}
                              alt={product.name}
                              className="w-12 h-12 object-cover rounded"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '/placeholder-product.png';
                              }}
                            />
                          ) : (
                            <div className="w-12 h-12 bg-[#242424] rounded flex items-center justify-center">
                              <svg className="w-6 h-6 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div>
                            <p className="text-white font-medium">{product.name}</p>
                            <p className="text-xs text-text-muted">{product.slug}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-text-secondary text-sm">
                          {product.category || '—'}
                        </td>
                        <td className="py-3 px-4 text-text-secondary text-sm">
                          {product.brand || '—'}
                        </td>
                        <td className="py-3 px-4 text-white font-medium">
                          ₹{product.basePrice.toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
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
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => router.push(`/admin/products/${product._id}/variants`)}
                              disabled={isLoading}
                            >
                              Variants
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/admin/products/${product._id}/edit`)}
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

