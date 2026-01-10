'use client';

import React from 'react';
import { CollectionBlockSettings } from '@/types/blockTypes';
import { useBranding } from '@/context/BrandingContext';

interface CollectionBlockProps {
  settings: CollectionBlockSettings;
}

export function CollectionBlock({ settings }: CollectionBlockProps) {
  const branding = useBranding();
  const { title, layout, itemsLimit = 12 } = settings;

  // Lazy-load products (in real implementation, fetch from API)
  const [products, setProducts] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // Simulate API call - in production, fetch based on collectionType
    const loadProducts = async () => {
      setLoading(true);
      // Simulate delay
      await new Promise(resolve => setTimeout(resolve, 100));
      const mockProducts = Array.from({ length: Math.min(itemsLimit, 12) }, (_, i) => ({
        id: `product-${i}`,
        name: `Product ${i + 1}`,
        price: '$99.99',
        image: 'https://via.placeholder.com/300x300',
      }));
      setProducts(mockProducts);
      setLoading(false);
    };
    loadProducts();
  }, [itemsLimit, settings.collectionType, settings.categoryId]);

  return (
    <section className="py-16 px-4" style={{ backgroundColor: branding.colors?.background || '#FFFFFF' }}>
      <div className="max-w-7xl mx-auto">
        <h2
          className="text-3xl font-bold mb-8 text-center"
          style={{
            color: branding.colors?.text || '#000000',
            fontFamily: branding.fonts?.primaryFont || 'system-ui',
          }}
        >
          {title}
        </h2>
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-gray-500">Loading products...</p>
          </div>
        ) : (
          <div
            className={
              layout === 'carousel'
                ? 'flex gap-4 overflow-x-auto pb-4'
                : 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6'
            }
          >
            {products.map((product) => (
            <div
              key={product.id}
              className="bg-white rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow"
              style={{
                backgroundColor: branding.colors?.background || '#FFFFFF',
              }}
            >
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-48 object-cover"
              />
              <div className="p-4">
                <h3
                  className="font-semibold mb-2"
                  style={{
                    color: branding.colors?.text || '#000000',
                    fontFamily: branding.fonts?.primaryFont || 'system-ui',
                  }}
                >
                  {product.name}
                </h3>
                <p
                  className="text-lg font-bold"
                  style={{
                    color: branding.colors?.primary || '#AA0000',
                  }}
                >
                  {product.price}
                </p>
              </div>
            </div>
          ))}
          </div>
        )}
      </div>
    </section>
  );
}

