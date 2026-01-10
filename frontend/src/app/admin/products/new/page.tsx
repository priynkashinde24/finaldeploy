'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createProduct, CreateProductData } from '@/lib/adminProducts';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

export default function CreateProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<CreateProductData>({
    name: '',
    slug: '',
    description: '',
    category: '',
    brand: '',
    images: [],
    basePrice: 0,
    status: 'active',
  });

  const [imageUrl, setImageUrl] = useState('');

  const currentUser = getCurrentUser();

  useEffect(() => {
    if (currentUser?.role !== 'admin') {
      router.push('/unauthorized');
      return;
    }
  }, [currentUser, router]);

  // Auto-generate slug from name
  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setFormData((prev) => ({
      ...prev,
      name,
      slug: prev.slug || generateSlug(name), // Auto-generate if slug is empty
    }));
  };

  const handleAddImage = () => {
    if (imageUrl.trim()) {
      setFormData((prev) => ({
        ...prev,
        images: [...(prev.images || []), imageUrl.trim()],
      }));
      setImageUrl('');
    }
  };

  const handleRemoveImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images?.filter((_, i) => i !== index) || [],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.name.trim()) {
      setError('Product name is required');
      return;
    }

    if (!formData.slug?.trim()) {
      setError('Product slug is required');
      return;
    }

    if (formData.basePrice <= 0) {
      setError('Base price must be greater than 0');
      return;
    }

    try {
      setLoading(true);
      
      const response = await createProduct({
        ...formData,
        slug: formData.slug || generateSlug(formData.name),
      });

      if (response.success) {
        router.push('/admin/products');
      } else {
        setError(response.message || 'Failed to create product');
      }
    } catch (err: any) {
      console.error('[CREATE PRODUCT] Error:', err);
      setError(err.message || 'Failed to create product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Create Product</h1>
        <p className="text-text-secondary">Add a new global product to the catalog</p>
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
          <CardTitle>Product Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Product Name */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Product Name <span className="text-red-400">*</span>
              </label>
              <Input
                type="text"
                value={formData.name}
                onChange={handleNameChange}
                required
                placeholder="Enter product name"
                className="w-full"
              />
            </div>

            {/* Slug */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Slug <span className="text-red-400">*</span>
              </label>
              <Input
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                required
                placeholder="product-slug"
                className="w-full"
              />
              <p className="text-xs text-text-muted mt-1">
                URL-friendly identifier (auto-generated from name)
              </p>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Category
              </label>
              <Input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                placeholder="Enter category"
                className="w-full"
              />
            </div>

            {/* Brand */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Brand
              </label>
              <Input
                type="text"
                value={formData.brand}
                onChange={(e) => setFormData((prev) => ({ ...prev, brand: e.target.value }))}
                placeholder="Enter brand name"
                className="w-full"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                rows={4}
                placeholder="Enter product description"
                className="w-full px-4 py-2 bg-[#121212] border border-[#242424] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>

            {/* Base Price */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Base Price (₹) <span className="text-red-400">*</span>
              </label>
              <Input
                type="number"
                value={formData.basePrice || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, basePrice: parseFloat(e.target.value) || 0 }))}
                required
                min="0"
                step="0.01"
                placeholder="0.00"
                className="w-full"
              />
              <p className="text-xs text-text-muted mt-1">
                Admin-defined reference price (not actual selling price)
              </p>
            </div>

            {/* Images */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Images
              </label>
              <div className="flex gap-2 mb-2">
                <Input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="Enter image URL"
                  className="flex-1"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddImage();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddImage}
                  disabled={!imageUrl.trim()}
                >
                  Add
                </Button>
              </div>
              {formData.images && formData.images.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.images.map((url, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={url}
                        alt={`Product image ${index + 1}`}
                        className="w-20 h-20 object-cover rounded border border-[#242424]"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as 'active' | 'inactive' }))}
                className="w-full px-4 py-2 bg-[#121212] border border-[#242424] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
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
                disabled={loading}
                className="flex-1"
              >
                {loading ? 'Creating...' : 'Create Product'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={() => router.push('/admin/products')}
                disabled={loading}
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

