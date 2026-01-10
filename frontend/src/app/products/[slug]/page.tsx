'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getProductBySlug, ProductDetails, ProductVariantGroup } from '@/lib/storefront';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { trackFunnelEvent } from '@/lib/funnelTracker';

export default function ProductDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [productData, setProductData] = useState<ProductDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string | number>>({});

  useEffect(() => {
    if (slug) {
      loadProduct();
    }
  }, [slug]);

  useEffect(() => {
    // Auto-select first available variant when product loads
    if (productData && productData.variants.length > 0 && !selectedVariant) {
      const firstVariant = productData.variants[0];
      if (firstVariant.variants.length > 0) {
        setSelectedVariant(firstVariant.variants[0].variantId);
        // Set initial attribute selections
        const initialAttrs: Record<string, string | number> = {};
        firstVariant.attributes.forEach((attr) => {
          initialAttrs[attr.attributeId] = attr.value;
        });
        setSelectedAttributes(initialAttrs);
      }
    }
  }, [productData]);

  useEffect(() => {
    // When attributes change, find matching variant
    if (productData && Object.keys(selectedAttributes).length > 0) {
      const matchingVariant = productData.variants.find((variantGroup) => {
        return variantGroup.attributes.every((attr) => selectedAttributes[attr.attributeId] === attr.value);
      });

      if (matchingVariant && matchingVariant.variants.length > 0) {
        // Select the variant with lowest price (or first available)
        const bestVariant = matchingVariant.variants.reduce((prev, curr) =>
          curr.sellingPrice < prev.sellingPrice ? curr : prev
        );
        setSelectedVariant(bestVariant.variantId);
      }
    }
  }, [selectedAttributes, productData]);

  const loadProduct = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await getProductBySlug(slug);

      if (response.success && response.data) {
        setProductData(response.data);
        // Funnel tracking: product view (session-based)
        trackFunnelEvent('PRODUCT_VIEW', {
          entityId: response.data.product.id,
          metadata: {
            slug,
            variantId: selectedVariant || undefined,
          },
        }).catch(() => {});
      } else {
        setError(response.message || 'Product not found');
      }
    } catch (err: any) {
      console.error('[PRODUCT DETAILS] Load error:', err);
      setError(err.message || 'Failed to load product');
    } finally {
      setLoading(false);
    }
  };

  const getCurrentVariant = () => {
    if (!productData || !selectedVariant) return null;

    for (const variantGroup of productData.variants) {
      const variant = variantGroup.variants.find((v) => v.variantId === selectedVariant);
      if (variant) {
        return { ...variant, attributes: variantGroup.attributes };
      }
    }
    return null;
  };

  const currentVariant = getCurrentVariant();
  const currentPrice = currentVariant?.sellingPrice || 0;
  const currentStock = currentVariant?.stockAvailable || 0;

  // Get unique attribute values for each attribute type
  const getAttributeOptions = (attributeId: string): Array<{ value: string | number; inStock: boolean; name: string }> => {
    if (!productData) return [];

    const values = new Map<string | number, { inStock: boolean; name: string }>();
    productData.variants.forEach((variantGroup) => {
      const attr = variantGroup.attributes.find((a) => a.attributeId === attributeId);
      if (attr) {
        const hasStock = variantGroup.variants.some((v) => v.stockAvailable > 0);
        const attrName = attr.attributeName || attr.attributeCode || 'Unknown';
        if (!values.has(attr.value) || (hasStock && !values.get(attr.value)?.inStock)) {
          values.set(attr.value, { inStock: hasStock, name: attrName });
        }
      }
    });

    return Array.from(values.entries()).map(([value, data]) => ({ value, inStock: data.inStock, name: data.name }));
  };

  // Get all unique attribute IDs with names
  const attributeMap = productData
    ? productData.variants.reduce((acc, variantGroup) => {
        variantGroup.attributes.forEach((attr) => {
          if (!acc.has(attr.attributeId)) {
            acc.set(attr.attributeId, attr.attributeName || attr.attributeCode || 'Unknown');
          }
        });
        return acc;
      }, new Map<string, string>())
    : new Map<string, string>();
  
  const attributeIds = Array.from(attributeMap.keys());

  const handleAddToCart = () => {
    // Placeholder - implement cart functionality later
    if (productData) {
      const variant = getCurrentVariant();
      trackFunnelEvent('ADD_TO_CART', {
        entityId: productData.product.id,
        metadata: {
          slug,
          variantId: variant?.variantId || selectedVariant || undefined,
          sku: variant?.variantSku,
          price: variant?.sellingPrice,
        },
      }).catch(() => {});
    }
    alert(`Added to cart: ${productData?.product.name} - Variant: ${selectedVariant}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading product...</p>
        </div>
      </div>
    );
  }

  if (error || !productData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold text-white mb-4">Product Not Found</h2>
          <p className="text-text-secondary mb-6">{error || 'The product you are looking for does not exist.'}</p>
          <Button variant="primary" onClick={() => router.push('/products')}>
            Browse Products
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Breadcrumb */}
      <div className="bg-surface border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <nav className="flex items-center gap-2 text-sm text-text-secondary">
            <Link href="/" className="hover:text-white transition-colors">
              Home
            </Link>
            <span>/</span>
            <Link href="/products" className="hover:text-white transition-colors">
              Products
            </Link>
            {productData.product.category && (
              <>
                <span>/</span>
                <span>{productData.product.category}</span>
              </>
            )}
            <span>/</span>
            <span className="text-white">{productData.product.name}</span>
          </nav>
        </div>
      </div>

      {/* Product Details */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Images */}
          <div>
            <div className="aspect-square rounded-lg overflow-hidden bg-[#1A1A1A] mb-4">
              {productData.product.images && productData.product.images.length > 0 ? (
                <img
                  src={productData.product.images[0]}
                  alt={productData.product.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/placeholder-product.png';
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg className="w-32 h-32 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>
            {/* Thumbnail gallery (if multiple images) */}
            {productData.product.images && productData.product.images.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {productData.product.images.slice(1, 5).map((image, index) => (
                  <div key={index} className="aspect-square rounded overflow-hidden bg-[#1A1A1A]">
                    <img src={image} alt={`${productData.product.name} ${index + 2}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div>
            <h1 className="text-4xl font-bold text-white mb-4">{productData.product.name}</h1>

            {productData.product.brand && (
              <p className="text-text-secondary mb-2">Brand: {productData.product.brand}</p>
            )}

            {productData.product.category && (
              <p className="text-text-secondary mb-4">Category: {productData.product.category}</p>
            )}

            {/* Price */}
            <div className="mb-6">
              <p className="text-4xl font-bold text-white">₹{currentPrice.toLocaleString()}</p>
              {productData.variants.length > 1 && (
                <p className="text-sm text-text-muted mt-1">Price varies by variant</p>
              )}
            </div>

            {/* Variant Selectors */}
            {attributeIds.length > 0 && (
              <div className="space-y-4 mb-6">
                {attributeIds.map((attrId) => {
                  const options = getAttributeOptions(attrId);
                  const currentValue = selectedAttributes[attrId];
                  const attributeName = attributeMap.get(attrId) || attrId;

                  return (
                    <div key={attrId}>
                      <label className="block text-sm font-medium text-white mb-2">
                        {attributeName}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {options.map((option) => {
                          const isSelected = currentValue === option.value;
                          const isDisabled = !option.inStock;

                          return (
                            <button
                              key={String(option.value)}
                              type="button"
                              onClick={() => {
                                if (!isDisabled) {
                                  setSelectedAttributes((prev) => ({
                                    ...prev,
                                    [attrId]: option.value,
                                  }));
                                }
                              }}
                              disabled={isDisabled}
                              className={cn(
                                'px-4 py-2 rounded-lg border-2 transition-all',
                                isSelected
                                  ? 'border-primary bg-primary/20 text-white'
                                  : 'border-[#242424] bg-[#0B0B0B] text-text-secondary hover:border-primary/50',
                                isDisabled && 'opacity-50 cursor-not-allowed'
                              )}
                            >
                              {option.value}
                              {isDisabled && (
                                <span className="ml-2 text-xs text-red-400">(Out of Stock)</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Stock Status */}
            {currentStock > 0 ? (
              <p className="text-green-400 text-sm mb-4">✓ In Stock ({currentStock} available)</p>
            ) : (
              <p className="text-red-400 text-sm mb-4">✗ Out of Stock</p>
            )}

            {/* Add to Cart */}
            <div className="mb-6">
              <Button
                variant="primary"
                size="lg"
                onClick={handleAddToCart}
                disabled={!selectedVariant || currentStock === 0}
                className="w-full"
              >
                {!selectedVariant ? 'Select Variant' : currentStock === 0 ? 'Out of Stock' : 'Add to Cart'}
              </Button>
            </div>

            {/* Description */}
            {productData.product.description && (
              <Card className="bg-surface border-border mb-6">
                <CardContent className="p-6">
                  <h2 className="text-xl font-semibold text-white mb-3">Description</h2>
                  <p className="text-text-secondary whitespace-pre-line">{productData.product.description}</p>
                </CardContent>
              </Card>
            )}

            {/* Product Info */}
            <Card className="bg-surface border-border">
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold text-white mb-3">Product Information</h2>
                <div className="space-y-2 text-sm">
                  {productData.product.category && (
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Category:</span>
                      <span className="text-white">{productData.product.category}</span>
                    </div>
                  )}
                  {productData.product.brand && (
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Brand:</span>
                      <span className="text-white">{productData.product.brand}</span>
                    </div>
                  )}
                  {currentVariant && (
                    <div className="flex justify-between">
                      <span className="text-text-secondary">SKU:</span>
                      <span className="text-white font-mono">{currentVariant.variantSku}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

