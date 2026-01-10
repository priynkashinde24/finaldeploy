'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getProducts, StorefrontProduct, getUniqueProducts, getMinPrice } from '@/lib/storefront';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export default function ProductsPage() {
  const [products, setProducts] = useState<StorefrontProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

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
      console.error('[PRODUCTS] Load error:', err);
      setError(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  // Group products by productId and get unique products with min price
  const uniqueProductsMap = getUniqueProducts(products);
  const uniqueProducts = Array.from(uniqueProductsMap.values());

  const formatAttributes = (product: StorefrontProduct): string => {
    if (!product.attributes || product.attributes.length === 0) return '';
    return product.attributes
      .map((attr) => {
        const name = attr.attributeName || attr.attributeCode || 'Unknown';
        return `${name}: ${attr.value}`;
      })
      .join(', ');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-surface border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-4xl font-bold text-white mb-2">Our Products</h1>
          <p className="text-text-secondary">Browse our collection of quality products</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-text-secondary">Loading products...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 max-w-md mx-auto">
              {error}
            </div>
            <Button variant="primary" onClick={loadProducts} className="mt-4">
              Try Again
            </Button>
          </div>
        ) : uniqueProducts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-text-secondary text-lg mb-4">No products available at the moment</p>
            <p className="text-text-muted">Check back soon for new products!</p>
          </div>
        ) : (
          <>
            {/* Products Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {uniqueProducts.map((product) => {
                // Get all variants for this product to calculate min price
                const productVariants = products.filter((p) => p.productId === product.productId);
                const minPrice = getMinPrice(productVariants);
                const hasMultipleVariants = productVariants.length > 1;

                return (
                  <Link key={`${product.productId}-${product.variantId}`} href={`/products/${product.slug}`}>
                    <Card className="bg-surface border-border hover:border-primary/50 transition-all duration-300 cursor-pointer h-full flex flex-col">
                      <div className="relative aspect-square overflow-hidden rounded-t-lg">
                        {product.images && product.images.length > 0 ? (
                          <img
                            src={product.images[0]}
                            alt={product.productName}
                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/placeholder-product.png';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full bg-[#1A1A1A] flex items-center justify-center">
                            <svg className="w-16 h-16 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                        {product.stockAvailable === 0 && (
                          <div className="absolute top-2 right-2">
                            <span className="px-2 py-1 bg-red-500/90 text-white text-xs font-semibold rounded">
                              Out of Stock
                            </span>
                          </div>
                        )}
                      </div>
                      <CardContent className="p-4 flex-1 flex flex-col">
                        <div className="flex-1">
                          <h3 className="text-white font-semibold text-lg mb-2 line-clamp-2">{product.productName}</h3>
                          {formatAttributes(product) && (
                            <p className="text-text-secondary text-sm mb-2">{formatAttributes(product)}</p>
                          )}
                          {product.brand && (
                            <p className="text-text-muted text-xs mb-2">Brand: {product.brand}</p>
                          )}
                          {product.category && (
                            <p className="text-text-muted text-xs mb-3">Category: {product.category}</p>
                          )}
                        </div>
                        <div className="mt-auto pt-4 border-t border-[#242424]">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="text-2xl font-bold text-white">₹{minPrice.toLocaleString()}</p>
                              {hasMultipleVariants && (
                                <p className="text-xs text-text-muted">Starting from</p>
                              )}
                            </div>
                          </div>
                          <Button variant="primary" size="md" className="w-full" disabled={product.stockAvailable === 0}>
                            {product.stockAvailable === 0 ? 'Out of Stock' : 'View Product'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>

            {/* Results count */}
            <div className="mt-8 text-center text-text-secondary">
              <p>Showing {uniqueProducts.length} product{uniqueProducts.length !== 1 ? 's' : ''}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

