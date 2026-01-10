'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import {
  getCategories,
  createCategory,
  updateCategory,
  toggleCategoryStatus,
  Category,
  CreateCategoryData,
} from '@/lib/adminCatalog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';

export default function AdminCategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [isRootCategory, setIsRootCategory] = useState(true);

  // Form state
  const [formData, setFormData] = useState<CreateCategoryData>({
    name: '',
    slug: '',
    parentId: null,
    status: 'active',
  });

  const currentUser = getCurrentUser();

  useEffect(() => {
    if (currentUser?.role !== 'admin') {
      router.push('/unauthorized');
      return;
    }
    loadCategories();
  }, [currentUser, router]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await getCategories();

      if (response.success && response.data) {
        setCategories(response.data.categories);
      } else {
        setError(response.message || 'Failed to load categories');
      }
    } catch (err: any) {
      console.error('[ADMIN CATEGORIES] Load error:', err);
      setError(err.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  // Generate slug from name
  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleNameChange = (name: string) => {
    setFormData({
      ...formData,
      name,
      slug: generateSlug(name),
    });
  };

  const handleAddRootCategory = () => {
    setIsRootCategory(true);
    setFormData({
      name: '',
      slug: '',
      parentId: null,
      status: 'active',
    });
    setSelectedCategory(null);
    setShowAddModal(true);
  };

  const handleAddSubcategory = (parentCategory: Category) => {
    setIsRootCategory(false);
    setFormData({
      name: '',
      slug: '',
      parentId: parentCategory.id,
      status: 'active',
    });
    setSelectedCategory(parentCategory);
    setShowAddModal(true);
  };

  const handleEdit = (category: Category) => {
    setFormData({
      name: category.name,
      slug: category.slug,
      parentId: category.parentId,
      status: category.status,
    });
    setSelectedCategory(category);
    setShowEditModal(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError('Category name is required');
      return;
    }

    if (!formData.slug.trim()) {
      setError('Slug is required');
      return;
    }

    try {
      setActionLoading('submit');
      setError(null);

      let response;
      if (showEditModal && selectedCategory) {
        response = await updateCategory(selectedCategory.id, formData);
      } else {
        response = await createCategory(formData);
      }

      if (response.success) {
        setSuccessMessage(
          showEditModal ? 'Category updated successfully' : 'Category created successfully'
        );
        setShowAddModal(false);
        setShowEditModal(false);
        setFormData({ name: '', slug: '', parentId: null, status: 'active' });
        setSelectedCategory(null);
        loadCategories();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(response.message || 'Failed to save category');
      }
    } catch (err: any) {
      console.error('[ADMIN CATEGORIES] Submit error:', err);
      setError(err.message || 'Failed to save category');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleStatus = async (category: Category) => {
    try {
      setActionLoading(category.id);
      setError(null);

      const newStatus = category.status === 'active' ? 'inactive' : 'active';
      const response = await toggleCategoryStatus(category.id, newStatus);

      if (response.success) {
        setSuccessMessage(`Category ${newStatus === 'active' ? 'enabled' : 'disabled'} successfully`);
        loadCategories();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(response.message || 'Failed to update category status');
      }
    } catch (err: any) {
      console.error('[ADMIN CATEGORIES] Toggle status error:', err);
      setError(err.message || 'Failed to update category status');
    } finally {
      setActionLoading(null);
    }
  };

  // Build tree structure
  const buildTree = (categories: Category[]): Category[] => {
    const categoryMap = new Map<string, Category & { children: Category[] }>();
    const rootCategories: (Category & { children: Category[] })[] = [];

    // Create map with children array
    categories.forEach((cat) => {
      categoryMap.set(cat.id, { ...cat, children: [] });
    });

    // Build tree
    categories.forEach((cat) => {
      const categoryWithChildren = categoryMap.get(cat.id)!;
      if (cat.parentId) {
        const parent = categoryMap.get(cat.parentId);
        if (parent) {
          parent.children.push(categoryWithChildren);
        }
      } else {
        rootCategories.push(categoryWithChildren);
      }
    });

    return rootCategories;
  };

  // Render tree recursively
  const renderTree = (categories: (Category & { children?: Category[] })[], level: number = 0) => {
    return categories.map((category) => (
      <React.Fragment key={category.id}>
        <tr className="border-b border-[#242424] hover:bg-[#1A1A1A] transition-colors">
          <td className="py-3 px-4">
            <div className="flex items-center gap-2" style={{ paddingLeft: `${level * 24}px` }}>
              {level > 0 && (
                <svg className="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
              <span className="text-white">{category.name}</span>
            </div>
          </td>
          <td className="py-3 px-4 text-text-secondary text-sm">{category.level}</td>
          <td className="py-3 px-4">
            <span
              className={cn(
                'px-2 py-1 rounded text-xs font-semibold',
                category.status === 'active'
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-gray-500/20 text-gray-400'
              )}
            >
              {category.status === 'active' ? 'Active' : 'Inactive'}
            </span>
          </td>
          <td className="py-3 px-4">
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleAddSubcategory(category)}
                disabled={actionLoading !== null}
              >
                Add Subcategory
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleEdit(category)}
                disabled={actionLoading !== null}
              >
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleToggleStatus(category)}
                disabled={actionLoading === category.id}
                className={cn(
                  category.status === 'active'
                    ? 'border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10'
                    : 'border-green-500/50 text-green-400 hover:bg-green-500/10'
                )}
              >
                {actionLoading === category.id
                  ? '...'
                  : category.status === 'active'
                    ? 'Disable'
                    : 'Enable'}
              </Button>
            </div>
          </td>
        </tr>
        {category.children && category.children.length > 0 && renderTree(category.children, level + 1)}
      </React.Fragment>
    ));
  };

  const treeCategories = buildTree(categories);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Categories</h1>
          <p className="text-text-secondary">Manage product categories and hierarchy</p>
        </div>
        <Button variant="primary" size="md" onClick={handleAddRootCategory} disabled={actionLoading !== null}>
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Root Category
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

      {/* Categories Table */}
      <Card className="bg-surface border-border">
        <CardHeader>
          <CardTitle>Category Tree ({categories.length} total)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-text-secondary">Loading categories...</p>
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-text-secondary">No categories found. Create your first category to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#242424]">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Name</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Level</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Status</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-white">Actions</th>
                  </tr>
                </thead>
                <tbody>{renderTree(treeCategories)}</tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Category Modal */}
      <Modal
        isOpen={showAddModal || showEditModal}
        onClose={() => {
          setShowAddModal(false);
          setShowEditModal(false);
          setFormData({ name: '', slug: '', parentId: null, status: 'active' });
          setSelectedCategory(null);
          setError(null);
        }}
        title={showEditModal ? 'Edit Category' : isRootCategory ? 'Add Root Category' : 'Add Subcategory'}
        size="md"
      >
        <div className="space-y-4">
          {selectedCategory && !isRootCategory && (
            <div className="p-3 bg-surfaceLight rounded-lg">
              <p className="text-sm text-text-muted mb-1">Parent Category:</p>
              <p className="text-white font-medium">{selectedCategory.name}</p>
            </div>
          )}

          <Input
            label="Category Name *"
            value={formData.name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g., Electronics"
            required
          />

          <Input
            label="Slug *"
            value={formData.slug}
            onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
            placeholder="e.g., electronics"
            required
          />

          {!isRootCategory && (
            <div>
              <label className="block text-sm font-medium text-white mb-2">Parent Category</label>
              <select
                value={formData.parentId || ''}
                onChange={(e) => setFormData({ ...formData, parentId: e.target.value || null })}
                className="w-full px-4 py-3 rounded-lg bg-[#0B0B0B] border border-[#242424] text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              >
                <option value="">Select parent category</option>
                {categories
                  .filter((cat) => cat.status === 'active' && cat.id !== selectedCategory?.id)
                  .map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} (Level {cat.level})
                    </option>
                  ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-white mb-2">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
              className="w-full px-4 py-3 rounded-lg bg-[#0B0B0B] border border-[#242424] text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="primary"
              size="md"
              onClick={handleSubmit}
              disabled={actionLoading === 'submit' || !formData.name.trim() || !formData.slug.trim()}
              className="flex-1"
            >
              {actionLoading === 'submit' ? 'Saving...' : showEditModal ? 'Update' : 'Create'}
            </Button>
            <Button
              variant="ghost"
              size="md"
              onClick={() => {
                setShowAddModal(false);
                setShowEditModal(false);
                setFormData({ name: '', slug: '', parentId: null, status: 'active' });
                setSelectedCategory(null);
                setError(null);
              }}
              disabled={actionLoading === 'submit'}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

