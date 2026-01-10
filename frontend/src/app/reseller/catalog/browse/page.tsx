'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout';
import { Button, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Footer } from '@/components/marketing';
import { productAPI, resellerAPI, pricingAPI } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Product {
  _id: string;
  name: string;
  description?: string;
  sku: string;
  price: number;
  cost: number;
  quantity: number;
  category: string;
  images: string[];
  status: string;
}

interface CatalogItem {
  _id: string;
  supplierProductId: string;
  resellerPrice: number;
  product: Product;
}

export default function BrowseProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [productPrices, setProductPrices] = useState<Record<string, number>>({});
  const supplierId = 'default-supplier'; // In production, get from context/params
  const storeId = 'default-store'; // In production, get from context/params

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch supplier products
        const productsResponse = await productAPI.getProducts({
          supplierId,
          status: 'active',
          limit: 100,
        });

        if (productsResponse.success) {
          setProducts(productsResponse.data.products || []);
        }

        // Fetch reseller catalog to check which products are already added
        const catalogResponse = await resellerAPI.getCatalog();
        if (catalogResponse.success) {
          setCatalogItems(catalogResponse.data || []);
        }

        // Calculate final prices for all products
        if (productsResponse.success && productsResponse.data.products) {
          const prices: Record<string, number> = {};
          await Promise.all(
            productsResponse.data.products.map(async (product: Product) => {
              try {
                const priceResponse = await pricingAPI.calculatePrice(
                  storeId,
                  product.sku,
                  product.price
                );
                if (priceResponse.success) {
                  prices[product._id] = priceResponse.data.finalPrice;
                } else {
                  prices[product._id] = product.price; // Fallback to base price
                }
              } catch {
                prices[product._id] = product.price; // Fallback to base price
              }
            })
          );
          setProductPrices(prices);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load products');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const isProductAdded = (productId: string): boolean => {
    return catalogItems.some((item) => item.supplierProductId === productId);
  };

  const handleAddToStore = async (product: Product) => {
    try {
      setAddingIds((prev) => new Set(prev).add(product._id));
      setError(null);
      setSuccessMessage(null);

      // Use supplier price as default reseller price (can be adjusted later)
      const response = await resellerAPI.addToCatalog({
        supplierProductId: product._id,
        resellerPrice: product.price,
      });

      if (response.success) {
        setSuccessMessage(`"${product.name}" added to your store!`);
        // Add to catalog items
        setCatalogItems((prev) => [...prev, response.data]);
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(response.message || 'Failed to add product');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to add product to store');
    } finally {
      setAddingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(product._id);
        return newSet;
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-secondary-off-white dark:bg-dark-background">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-deep-red mx-auto mb-4"></div>
            <p className="text-neutral-600 dark:text-dark-text-secondary">Loading products...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-secondary-off-white dark:bg-dark-background">
      <Navbar />
      <main className="flex-1 py-12 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8 text-center">
            <SectionTitle size="xl" variant="default" className="mb-4">
              Browse Supplier Products
            </SectionTitle>
            <p className="text-lg text-neutral-600 dark:text-dark-text-secondary">
              Select products to add to your reseller store
            </p>
          </div>

          {/* Success Toast */}
          {successMessage && (
            <div className="mb-6 p-4 rounded-lg bg-success/10 border border-success">
              <p className="text-sm text-success font-medium">{successMessage}</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 rounded-lg bg-error/10 border border-error">
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          {/* Products Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {products.map((product) => {
              const isAdded = isProductAdded(product._id);
              const isAdding = addingIds.has(product._id);

              return (
                <Card key={product._id} variant="elevated">
                  <CardContent className="p-6">
                    {/* Product Image */}
                    {product.images && product.images.length > 0 ? (
                      <div className="w-full h-48 mb-4 rounded-lg overflow-hidden bg-secondary-gray dark:bg-dark-border">
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    ) : (
                      <div className="w-full h-48 mb-4 rounded-lg bg-secondary-gray dark:bg-dark-border flex items-center justify-center">
                        <span className="text-4xl text-neutral-400">📦</span>
                      </div>
                    )}

                    {/* Product Info */}
                    <div className="space-y-2 mb-4">
                      <h3 className="text-lg font-semibold text-neutral-900 dark:text-dark-text">
                        {product.name}
                      </h3>
                      {product.description && (
                        <p className="text-sm text-neutral-600 dark:text-dark-text-secondary line-clamp-2">
                          {product.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-neutral-500 dark:text-dark-text-secondary">
                          SKU: {product.sku}
                        </span>
                        <div className="text-right">
                          <span className="font-medium text-primary-deep-red">
                            ${(productPrices[product._id] || product.price).toFixed(2)}
                          </span>
                          {productPrices[product._id] && productPrices[product._id] !== product.price && (
                            <span className="block text-xs text-neutral-400 line-through">
                              ${product.price.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-neutral-500 dark:text-dark-text-secondary">
                        Category: {product.category} | Stock: {product.quantity}
                      </div>
                    </div>

                    {/* Add Button */}
                    <Button
                      variant={isAdded ? 'outline' : 'primary'}
                      size="sm"
                      className="w-full"
                      onClick={() => !isAdded && handleAddToStore(product)}
                      disabled={isAdded || isAdding}
                    >
                      {isAdding
                        ? 'Adding...'
                        : isAdded
                        ? '✓ Added to Store'
                        : 'Add to My Store'}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {products.length === 0 && (
            <Card variant="elevated">
              <CardContent className="text-center py-12">
                <p className="text-neutral-600 dark:text-dark-text-secondary">
                  No products available
                </p>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="lg"
              onClick={() => router.push('/reseller/catalog/my-products')}
              className="px-8"
            >
              View My Products
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

