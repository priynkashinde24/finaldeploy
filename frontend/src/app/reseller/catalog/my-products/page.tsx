'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout';
import { Button, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Footer } from '@/components/marketing';
import { resellerAPI, pricingAPI } from '@/lib/api';
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
}

interface CatalogItem {
  _id: string;
  supplierProductId: string;
  resellerPrice: number;
  status: string;
  product: Product | null;
}

export default function MyProductsPage() {
  const router = useRouter();
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({});
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [calculatedPrices, setCalculatedPrices] = useState<Record<string, number>>({});
  const storeId = 'default-store'; // In production, get from context/params

  useEffect(() => {
    fetchCatalog();
  }, []);

  const fetchCatalog = async () => {
    try {
      setLoading(true);
      const response = await resellerAPI.getCatalog();
      
      if (response.success) {
        setCatalogItems(response.data || []);
        // Initialize price inputs
        const prices: Record<string, string> = {};
        response.data.forEach((item: CatalogItem) => {
          prices[item._id] = item.resellerPrice.toString();
        });
        setPriceInputs(prices);

        // Calculate final prices with pricing rules
        const finalPrices: Record<string, number> = {};
        await Promise.all(
          response.data.map(async (item: CatalogItem) => {
            if (item.product) {
              try {
                const priceResponse = await pricingAPI.calculatePrice(
                  storeId,
                  item.product.sku,
                  item.product.price
                );
                if (priceResponse.success) {
                  finalPrices[item._id] = priceResponse.data.finalPrice;
                } else {
                  finalPrices[item._id] = item.resellerPrice; // Fallback
                }
              } catch {
                finalPrices[item._id] = item.resellerPrice; // Fallback
              }
            }
          })
        );
        setCalculatedPrices(finalPrices);
      } else {
        setError(response.message || 'Failed to load catalog');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load catalog');
    } finally {
      setLoading(false);
    }
  };

  const handlePriceChange = (itemId: string, value: string) => {
    setPriceInputs((prev) => ({ ...prev, [itemId]: value }));
  };

  const handleSavePrice = async (item: CatalogItem) => {
    try {
      const newPrice = parseFloat(priceInputs[item._id]);
      
      if (isNaN(newPrice) || newPrice < 0) {
        setError('Please enter a valid price');
        return;
      }

      setEditingId(item._id);
      setError(null);

      const response = await resellerAPI.updatePrice(item._id, newPrice, 'default-reseller');

      if (response.success) {
        setSuccessMessage(`Price updated for "${item.product?.name || 'product'}"`);
        // Update local state
        setCatalogItems((prev) =>
          prev.map((i) =>
            i._id === item._id ? { ...i, resellerPrice: newPrice } : i
          )
        );
        setEditingId(null);
        
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(response.message || 'Failed to update price');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update price');
    } finally {
      setEditingId(null);
    }
  };

  const handleRemove = async (item: CatalogItem) => {
    if (!confirm(`Are you sure you want to remove "${item.product?.name || 'this product'}" from your catalog?`)) {
      return;
    }

    try {
      setRemovingIds((prev) => new Set(prev).add(item._id));
      setError(null);

      const response = await resellerAPI.removeFromCatalog(item._id, 'default-reseller');

      if (response.success) {
        setSuccessMessage(`"${item.product?.name || 'Product'}" removed from catalog`);
        // Remove from local state
        setCatalogItems((prev) => prev.filter((i) => i._id !== item._id));
        delete priceInputs[item._id];
        setPriceInputs({ ...priceInputs });
        
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(response.message || 'Failed to remove product');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to remove product');
    } finally {
      setRemovingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(item._id);
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
            <p className="text-neutral-600 dark:text-dark-text-secondary">Loading your products...</p>
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
              My Products
            </SectionTitle>
            <p className="text-lg text-neutral-600 dark:text-dark-text-secondary">
              Manage your reseller catalog
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

          {/* Products List */}
          {catalogItems.length === 0 ? (
            <Card variant="elevated">
              <CardContent className="text-center py-12">
                <p className="text-neutral-600 dark:text-dark-text-secondary mb-4">
                  No products in your catalog yet
                </p>
                <Button
                  variant="primary"
                  onClick={() => router.push('/reseller/catalog/browse')}
                >
                  Browse Products
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4 mb-8">
              {catalogItems.map((item) => {
                const isEditing = editingId === item._id;
                const isRemoving = removingIds.has(item._id);

                if (!item.product) {
                  return null; // Skip items without product data
                }

                return (
                  <Card key={item._id} variant="elevated">
                    <CardContent className="p-6">
                      <div className="flex flex-col sm:flex-row gap-6">
                        {/* Product Image */}
                        <div className="flex-shrink-0">
                          {item.product.images && item.product.images.length > 0 ? (
                            <div className="w-32 h-32 rounded-lg overflow-hidden bg-secondary-gray dark:bg-dark-border">
                              <img
                                src={item.product.images[0]}
                                alt={item.product.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            </div>
                          ) : (
                            <div className="w-32 h-32 rounded-lg bg-secondary-gray dark:bg-dark-border flex items-center justify-center">
                              <span className="text-3xl text-neutral-400">📦</span>
                            </div>
                          )}
                        </div>

                        {/* Product Info */}
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold text-neutral-900 dark:text-dark-text mb-2">
                            {item.product.name}
                          </h3>
                          {item.product.description && (
                            <p className="text-sm text-neutral-600 dark:text-dark-text-secondary mb-3">
                              {item.product.description}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-4 text-sm mb-4">
                            <span className="text-neutral-500 dark:text-dark-text-secondary">
                              SKU: {item.product.sku}
                            </span>
                            <span className="text-neutral-500 dark:text-dark-text-secondary">
                              Category: {item.product.category}
                            </span>
                            <div className="flex flex-col">
                              <span className="text-neutral-500 dark:text-dark-text-secondary">
                                Supplier Price: ${item.product.price.toFixed(2)}
                              </span>
                              {calculatedPrices[item._id] && calculatedPrices[item._id] !== item.product.price && (
                                <span className="text-xs text-primary-muted-gold">
                                  Calculated: ${calculatedPrices[item._id].toFixed(2)}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Price Editor */}
                          <div className="flex items-center gap-4">
                            <div className="flex-1 max-w-xs">
                              <label className="block text-sm font-medium text-neutral-900 dark:text-dark-text mb-1">
                                Your Price
                              </label>
                              <div className="flex gap-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={priceInputs[item._id] || ''}
                                  onChange={(e) => handlePriceChange(item._id, e.target.value)}
                                  className={cn(
                                    'flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-deep-red',
                                    'bg-white dark:bg-dark-surface text-neutral-900 dark:text-dark-text',
                                    'border-secondary-gray dark:border-dark-border'
                                  )}
                                  placeholder="0.00"
                                />
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => handleSavePrice(item)}
                                  disabled={isEditing}
                                >
                                  {isEditing ? 'Saving...' : 'Save'}
                                </Button>
                              </div>
                            </div>
                            <div className="pt-6">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRemove(item)}
                                disabled={isRemoving}
                                className="text-error border-error hover:bg-error hover:text-white"
                              >
                                {isRemoving ? 'Removing...' : 'Remove'}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-center gap-4">
            <Button
              variant="primary"
              size="lg"
              onClick={() => router.push('/reseller/catalog/browse')}
              className="px-8"
            >
              Browse More Products
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

