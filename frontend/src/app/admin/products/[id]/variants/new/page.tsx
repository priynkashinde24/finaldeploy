'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getProductById, Product } from '@/lib/adminProducts';
import { getCategories, Category } from '@/lib/adminCatalog';
import { getAttributes, Attribute } from '@/lib/adminCatalog';
import { generateVariants, getVariants, GenerateVariantData } from '@/lib/adminVariants';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

interface SelectedAttributeValues {
  [attributeId: string]: string[];
}

interface GeneratedVariant {
  attributes: Array<{ attributeId: string; value: string | number }>;
  sku: string;
  basePrice: number;
  status: 'active' | 'inactive';
}

export default function GenerateVariantsPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [existingVariants, setExistingVariants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [selectedValues, setSelectedValues] = useState<SelectedAttributeValues>({});
  const [generatedVariants, setGeneratedVariants] = useState<GeneratedVariant[]>([]);
  const [basePrice, setBasePrice] = useState(0);

  const loadAttributesForCategory = async (categoryId: string) => {
    try {
      // Get applicable attributes
      const attributesResponse = await getAttributes();
      if (attributesResponse.success && attributesResponse.data) {
        // Filter attributes applicable to this product's category
        const applicableAttributes = attributesResponse.data.attributes.filter((attr) => {
          if (attr.status !== 'active') return false;
          return attr.applicableCategories.includes(categoryId);
        });
        setAttributes(applicableAttributes);

        // Initialize selected values
        const initialValues: SelectedAttributeValues = {};
        applicableAttributes.forEach((attr) => {
          initialValues[attr.id] = [];
        });
        setSelectedValues(initialValues);
      }
    } catch (err: any) {
      console.error('[GENERATE VARIANTS] Load attributes error:', err);
      setError(err.message || 'Failed to load attributes');
    }
  };

  const currentUser = getCurrentUser();

  useEffect(() => {
    if (currentUser?.role !== 'admin') {
      router.push('/unauthorized');
      return;
    }
    loadData();
  }, [currentUser, router, productId]);

  useEffect(() => {
    generateCombinations();
  }, [selectedValues, basePrice, product]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const productResponse = await getProductById(productId);
      if (!productResponse.success || !productResponse.data) {
        setError(productResponse.message || 'Failed to load product');
        return;
      }

      const productData = productResponse.data.product;
      setProduct(productData);
      setBasePrice(productData.basePrice);

      // Get category - handle both categoryId (ObjectId) and category (string/object)
      let categoryId: string | null = null;
      if ((productData as any).categoryId) {
        categoryId = (productData as any).categoryId.toString();
      } else if (productData.category) {
        // Legacy support: category might be a string or object
        categoryId = typeof productData.category === 'string' ? productData.category : (productData.category as any).id || (productData.category as any)._id;
      }

      if (categoryId) {
        const categoriesResponse = await getCategories();
        if (categoriesResponse.success && categoriesResponse.data) {
          const foundCategory = categoriesResponse.data.categories.find(
            (cat) => cat.id === categoryId || cat.id === categoryId
          );
          if (foundCategory) {
            setCategory(foundCategory);
            // Load attributes after category is set
            loadAttributesForCategory(foundCategory.id);
          } else {
            setError('Category not found. Please assign a valid category to this product.');
          }
        }
      } else {
        setError('Product does not have a category assigned. Please assign a category first.');
      }

      // Get existing variants to check for duplicates
      const variantsResponse = await getVariants(productId);
      if (variantsResponse.success && variantsResponse.data) {
        setExistingVariants(variantsResponse.data.variants);
      }
    } catch (err: any) {
      console.error('[GENERATE VARIANTS] Load error:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAttributeValueToggle = (attributeId: string, value: string) => {
    setSelectedValues((prev) => {
      const current = prev[attributeId] || [];
      if (current.includes(value)) {
        return {
          ...prev,
          [attributeId]: current.filter((v) => v !== value),
        };
      } else {
        return {
          ...prev,
          [attributeId]: [...current, value],
        };
      }
    });
  };

  const generateCombinations = () => {
    if (!product) return;

    const attributeIds = Object.keys(selectedValues).filter((id) => selectedValues[id].length > 0);
    if (attributeIds.length === 0) {
      setGeneratedVariants([]);
      return;
    }

    // Build arrays of values for each attribute
    const valueArrays: string[][] = attributeIds.map((id) => selectedValues[id]);

    // Generate cartesian product
    const combinations: string[][] = [];
    const generate = (current: string[], index: number) => {
      if (index === valueArrays.length) {
        combinations.push([...current]);
        return;
      }
      for (const value of valueArrays[index]) {
        generate([...current, value], index + 1);
      }
    };
    generate([], 0);

    // Create variant objects
    const variants: GeneratedVariant[] = combinations.map((combination) => {
      const variantAttributes = attributeIds.map((attrId, idx) => {
        const attr = attributes.find((a) => a.id === attrId);
        return {
          attributeId: attrId,
          value: attr?.type === 'number' ? parseFloat(combination[idx]) : combination[idx],
        };
      });

      // Generate SKU: product-slug-attr1-attr2-...
      const skuParts = [product.slug];
      variantAttributes.forEach((attr) => {
        const attrObj = attributes.find((a) => a.id === attr.attributeId);
        if (attrObj) {
          const valueStr = String(attr.value).toLowerCase().replace(/\s+/g, '-');
          skuParts.push(valueStr);
        }
      });
      const autoSku = skuParts.join('-');

      return {
        attributes: variantAttributes,
        sku: autoSku,
        basePrice: basePrice,
        status: 'active' as const,
      };
    });

    setGeneratedVariants(variants);
  };

  const handleSkuChange = (index: number, newSku: string) => {
    setGeneratedVariants((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], sku: newSku };
      return updated;
    });
  };

  const handleBasePriceChange = (index: number, newPrice: number) => {
    setGeneratedVariants((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], basePrice: newPrice };
      return updated;
    });
  };

  const checkDuplicateSkus = (): string[] => {
    const skus = generatedVariants.map((v) => v.sku);
    const duplicates: string[] = [];
    const seen = new Set<string>();

    skus.forEach((sku, index) => {
      if (seen.has(sku)) {
        duplicates.push(`Row ${index + 1}`);
      } else {
        seen.add(sku);
      }
    });

    // Check against existing variants
    const existingSkus = new Set(existingVariants.map((v) => v.sku));
    generatedVariants.forEach((variant, index) => {
      if (existingSkus.has(variant.sku)) {
        duplicates.push(`Row ${index + 1} (existing)`);
      }
    });

    return duplicates;
  };

  const handleSubmit = async () => {
    if (generatedVariants.length === 0) {
      setError('No variants to generate. Please select attribute values.');
      return;
    }

    const duplicates = checkDuplicateSkus();
    if (duplicates.length > 0) {
      setError(`Duplicate SKUs found: ${duplicates.join(', ')}. Please fix before saving.`);
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const variantData: GenerateVariantData[] = generatedVariants.map((v) => ({
        sku: v.sku,
        attributes: v.attributes,
        basePrice: v.basePrice,
        status: v.status,
      }));

      const response = await generateVariants(productId, variantData);

      if (response.success) {
        setSuccessMessage(
          `Successfully created ${response.data?.created || 0} variant(s). ${response.data?.skipped || 0} skipped.`
        );
        setTimeout(() => {
          router.push(`/admin/products/${productId}/variants`);
        }, 2000);
      } else {
        setError(response.message || 'Failed to generate variants');
      }
    } catch (err: any) {
      console.error('[GENERATE VARIANTS] Submit error:', err);
      setError(err.message || 'Failed to generate variants');
    } finally {
      setSaving(false);
    }
  };

  const totalCombinations = generatedVariants.length;
  const hasLargeCombination = totalCombinations > 50;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.push(`/admin/products/${productId}/variants`)}>
          ← Back to Variants
        </Button>
        <h1 className="text-3xl font-bold text-white mt-4 mb-2">Generate Variants</h1>
        {product && (
          <div className="text-text-secondary">
            <p className="font-medium text-white">{product.name}</p>
            <p className="text-sm">Category: {category?.name || product.category || '—'}</p>
          </div>
        )}
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

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading product and attributes...</p>
        </div>
      ) : !category || attributes.length === 0 ? (
        <Card className="bg-surface border-border">
          <CardContent className="py-12 text-center">
            <p className="text-text-secondary mb-4">
              {!category
                ? 'Product does not have a category assigned. Please assign a category first.'
                : 'No applicable attributes found for this category. Create attributes and link them to this category.'}
            </p>
            <Button variant="primary" onClick={() => router.push(`/admin/products/${productId}/edit`)}>
              {!category ? 'Assign Category' : 'Go to Attributes'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Attribute Selection */}
          <Card className="bg-surface border-border">
            <CardHeader>
              <CardTitle>Select Attribute Values</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {attributes.map((attribute) => {
                  const selected = selectedValues[attribute.id] || [];
                  const isSelectType = attribute.type === 'select';

                  return (
                    <div key={attribute.id} className="border-b border-[#242424] pb-4 last:border-0">
                      <div className="mb-3">
                        <h3 className="text-white font-semibold">{attribute.name}</h3>
                        <p className="text-sm text-text-muted">
                          {attribute.code} ({attribute.type})
                        </p>
                      </div>

                      {isSelectType && attribute.allowedValues ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {attribute.allowedValues.map((value) => {
                            const isSelected = selected.includes(value);
                            return (
                              <label
                                key={value}
                                className={cn(
                                  'flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all',
                                  isSelected
                                    ? 'bg-primary/20 border-primary text-white'
                                    : 'bg-[#0B0B0B] border-[#242424] text-text-secondary hover:border-primary/50'
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleAttributeValueToggle(attribute.id, value)}
                                  className="w-4 h-4 text-primary rounded focus:ring-primary"
                                />
                                <span className="text-sm">{value}</span>
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                          <p className="text-sm text-yellow-400">
                            {attribute.type === 'text'
                              ? 'Text and number attributes are not supported for variant generation. Use select-type attributes only.'
                              : 'Number attributes are not supported for variant generation. Use select-type attributes only.'}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          {totalCombinations > 0 && (
            <Card className="bg-surface border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Preview: {totalCombinations} Variant(s)</CardTitle>
                  <div className="flex items-center gap-4">
                    <div>
                      <label className="text-sm text-text-muted mr-2">Default Base Price:</label>
                      <Input
                        type="number"
                        value={basePrice}
                        onChange={(e) => setBasePrice(parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                        className="w-32 inline-block"
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {hasLargeCombination && (
                  <div className="mb-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <p className="text-sm text-yellow-400">
                      ⚠️ Warning: You are about to create {totalCombinations} variants. This may take a moment.
                    </p>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#242424]">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-white">#</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-white">Attributes</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-white">SKU</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-white">Base Price</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-white">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {generatedVariants.map((variant, index) => {
                        const attributesStr = variant.attributes
                          .map((attr) => {
                            const attrObj = attributes.find((a) => a.id === attr.attributeId);
                            return `${attrObj?.name || 'Unknown'}: ${attr.value}`;
                          })
                          .join(', ');

                        return (
                          <tr key={index} className="border-b border-[#242424] hover:bg-[#1A1A1A] transition-colors">
                            <td className="py-3 px-4 text-text-secondary text-sm">{index + 1}</td>
                            <td className="py-3 px-4 text-white text-sm">{attributesStr}</td>
                            <td className="py-3 px-4">
                              <Input
                                value={variant.sku}
                                onChange={(e) => handleSkuChange(index, e.target.value)}
                                className="w-full"
                                error={checkDuplicateSkus().some((d) => d.includes(`Row ${index + 1}`))}
                              />
                            </td>
                            <td className="py-3 px-4">
                              <Input
                                type="number"
                                value={variant.basePrice}
                                onChange={(e) => handleBasePriceChange(index, parseFloat(e.target.value) || 0)}
                                min="0"
                                step="0.01"
                                className="w-full"
                              />
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-1 rounded text-xs font-semibold bg-green-500/20 text-green-400">
                                Active
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex gap-3 mt-6">
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={handleSubmit}
                    disabled={saving || totalCombinations === 0 || checkDuplicateSkus().length > 0}
                    className="flex-1"
                  >
                    {saving ? 'Creating Variants...' : `Create ${totalCombinations} Variant(s)`}
                  </Button>
                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={() => router.push(`/admin/products/${productId}/variants`)}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {totalCombinations === 0 && (
            <Card className="bg-surface border-border">
              <CardContent className="py-12 text-center">
                <p className="text-text-secondary">
                  Select attribute values above to generate variant combinations.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

