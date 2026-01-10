'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

interface Product {
  productId: string;
  productName: string;
  slug: string;
  category: string | null;
  categorySlug: string | null;
  subCategory: string | null;
  brand: string | null;
  images: string[];
  variantId: string;
  variantSku: string;
  attributes: Array<{
    attributeId: string;
    attributeName: string;
    attributeCode: string;
    value: string | number;
  }>;
  sellingPrice: number;
  basePrice: number;
  resellerId: string;
  supplierId: string;
  stockAvailable: number;
}

interface Store {
  id: string;
  name: string;
  description: string;
  logoUrl: string | null;
  subdomain: string;
  customDomain: string | null;
  status: string;
}

export default function StoreViewPage() {
  const params = useParams();
  const router = useRouter();
  const subdomain = params.subdomain as string;

  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (subdomain) {
      loadStore();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subdomain]);

  const loadStore = async () => {
    setLoading(true);
    setError(null);
    try {
      // First, find the store by subdomain
      const storesResponse = await api.get(`/storefront/stores?search=${subdomain}&limit=1`);
      if (storesResponse.data.success && storesResponse.data.data?.stores.length > 0) {
        const foundStore = storesResponse.data.data.stores[0];
        
        // Verify it's the exact subdomain match
        if (foundStore.subdomain.toLowerCase() !== subdomain.toLowerCase()) {
          setError('Store not found');
          setLoading(false);
          return;
        }
        
        setStore(foundStore);

        // Set store ID in localStorage for API calls
        localStorage.setItem('storeId', foundStore.id);

        // Now fetch products for this store
        await loadProducts(foundStore.id);
      } else {
        setError('Store not found');
      }
    } catch (err: any) {
      console.error('[STORE VIEW] Load error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load store');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async (storeId: string) => {
    try {
      // Set store ID in localStorage so the API interceptor can add it to headers
      localStorage.setItem('storeId', storeId);

      // Fetch products - the API interceptor will add x-store-id header
      const productsResponse = await api.get(`/storefront/products`);
      if (productsResponse.data.success && productsResponse.data.data?.products) {
        setProducts(productsResponse.data.data.products);
      }
    } catch (err: any) {
      console.error('[STORE VIEW] Products load error:', err);
      // Don't set error here, just log it - store might not have products yet
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading store...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-6 md:p-10">
        <div className="max-w-6xl mx-auto">
          <Card className="bg-surface border-border">
            <CardContent className="p-12">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-4">Store Not Found</h2>
                <p className="text-text-secondary mb-6">{error}</p>
                <Link href="/storefront">
                  <Button variant="primary">Back to Stores</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!store) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Store Header */}
      <div className="bg-surface border-b border-border">
        <div className="max-w-6xl mx-auto p-6">
          <div className="flex items-center gap-4 mb-4">
            {store.logoUrl ? (
              <img
                src={store.logoUrl}
                alt={store.name}
                className="w-20 h-20 rounded-lg object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-lg bg-primary/20 flex items-center justify-center">
                <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold text-white">{store.name}</h1>
              {store.description && (
                <p className="text-text-secondary mt-1">{store.description}</p>
              )}
            </div>
          </div>
          <Link href="/storefront">
            <Button variant="outline" size="sm">← Back to Stores</Button>
          </Link>
        </div>
      </div>

      {/* Products Section */}
      <div className="max-w-6xl mx-auto p-6">
        <h2 className="text-2xl font-bold text-white mb-6">Products</h2>

        {products.length === 0 ? (
          <Card className="bg-surface border-border">
            <CardContent className="p-12">
              <div className="text-center text-text-secondary">
                <p className="text-lg mb-2">No products available</p>
                <p className="text-sm">This store doesn't have any products yet.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product, index) => (
              <Card key={`${product.productId}-${product.variantId}-${index}`} className="bg-surface border-border hover:border-primary/50 transition-colors">
                <CardHeader>
                  {product.images && product.images.length > 0 ? (
                    <img
                      src={product.images[0]}
                      alt={product.productName}
                      className="w-full h-48 object-cover rounded-lg mb-4"
                    />
                  ) : (
                    <div className="w-full h-48 bg-muted rounded-lg mb-4 flex items-center justify-center">
                      <svg className="w-16 h-16 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  <CardTitle className="text-white text-lg line-clamp-2">{product.productName}</CardTitle>
                  {product.brand && (
                    <p className="text-text-muted text-sm mt-1">{product.brand}</p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-2xl font-bold text-white">{formatCurrency(product.sellingPrice)}</span>
                    {product.stockAvailable > 0 ? (
                      <span className="text-xs text-green-400">In Stock</span>
                    ) : (
                      <span className="text-xs text-red-400">Out of Stock</span>
                    )}
                  </div>
                  {product.attributes && product.attributes.length > 0 && (
                    <div className="mb-4">
                      <div className="flex flex-wrap gap-2">
                        {product.attributes.map((attr, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-muted rounded text-xs text-text-secondary"
                          >
                            {attr.attributeName}: {attr.value}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <Link href={`/products/${product.slug}`}>
                    <Button variant="primary" className="w-full">
                      View Product
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

