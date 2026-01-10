'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import {
  getAttributes,
  getCategories,
  createAttribute,
  updateAttribute,
  toggleAttributeStatus,
  Attribute,
  Category,
  CreateAttributeData,
} from '@/lib/adminCatalog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';

export default function AdminAttributesPage() {
  const router = useRouter();
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAttribute, setSelectedAttribute] = useState<Attribute | null>(null);

  // Form state
  const [formData, setFormData] = useState<CreateAttributeData>({
    name: '',
    code: '',
    type: 'text',
    allowedValues: [],
    applicableCategories: [],
    status: 'active',
  });

  const [allowedValueInput, setAllowedValueInput] = useState('');

  const currentUser = getCurrentUser();

  useEffect(() => {
    if (currentUser?.role !== 'admin') {
      router.push('/unauthorized');
      return;
    }
    loadData();
  }, [currentUser, router]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [attributesResponse, categoriesResponse] = await Promise.all([
        getAttributes(),
        getCategories(),
      ]);

      if (attributesResponse.success && attributesResponse.data) {
        setAttributes(attributesResponse.data.attributes);
      } else {
        setError(attributesResponse.message || 'Failed to load attributes');
      }

      if (categoriesResponse.success && categoriesResponse.data) {
        setCategories(categoriesResponse.data.categories.filter((cat) => cat.status === 'active'));
      }
    } catch (err: any) {
      console.error('[ADMIN ATTRIBUTES] Load error:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Generate code from name
  const generateCode = (name: string): string => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, '_');
  };

  const handleNameChange = (name: string) => {
    setFormData({
      ...formData,
      name,
      code: generateCode(name),
    });
  };

  const handleAddAllowedValue = () => {
    if (allowedValueInput.trim() && !formData.allowedValues?.includes(allowedValueInput.trim())) {
      setFormData({
        ...formData,
        allowedValues: [...(formData.allowedValues || []), allowedValueInput.trim()],
      });
      setAllowedValueInput('');
    }
  };

  const handleRemoveAllowedValue = (value: string) => {
    setFormData({
      ...formData,
      allowedValues: formData.allowedValues?.filter((v) => v !== value) || [],
    });
  };

  const handleAdd = () => {
    setFormData({
      name: '',
      code: '',
      type: 'text',
      allowedValues: [],
      applicableCategories: [],
      status: 'active',
    });
    setAllowedValueInput('');
    setSelectedAttribute(null);
    setShowAddModal(true);
  };

  const handleEdit = (attribute: Attribute) => {
    setFormData({
      name: attribute.name,
      code: attribute.code,
      type: attribute.type,
      allowedValues: attribute.allowedValues || [],
      applicableCategories: attribute.applicableCategories,
      status: attribute.status,
    });
    setAllowedValueInput('');
    setSelectedAttribute(attribute);
    setShowEditModal(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError('Attribute name is required');
      return;
    }

    if (!formData.code.trim()) {
      setError('Attribute code is required');
      return;
    }

    if (formData.type === 'select' && (!formData.allowedValues || formData.allowedValues.length === 0)) {
      setError('Select-type attributes must have at least one allowed value');
      return;
    }

    if (formData.applicableCategories.length === 0) {
      setError('At least one applicable category must be selected');
      return;
    }

    try {
      setActionLoading('submit');
      setError(null);

      let response;
      if (showEditModal && selectedAttribute) {
        response = await updateAttribute(selectedAttribute.id, formData);
      } else {
        response = await createAttribute(formData);
      }

      if (response.success) {
        setSuccessMessage(
          showEditModal ? 'Attribute updated successfully' : 'Attribute created successfully'
        );
        setShowAddModal(false);
        setShowEditModal(false);
        setFormData({
          name: '',
          code: '',
          type: 'text',
          allowedValues: [],
          applicableCategories: [],
          status: 'active',
        });
        setSelectedAttribute(null);
        loadData();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(response.message || 'Failed to save attribute');
      }
    } catch (err: any) {
      console.error('[ADMIN ATTRIBUTES] Submit error:', err);
      setError(err.message || 'Failed to save attribute');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleStatus = async (attribute: Attribute) => {
    try {
      setActionLoading(attribute.id);
      setError(null);

      const newStatus = attribute.status === 'active' ? 'inactive' : 'active';
      const response = await toggleAttributeStatus(attribute.id, newStatus);

      if (response.success) {
        setSuccessMessage(`Attribute ${newStatus === 'active' ? 'enabled' : 'disabled'} successfully`);
        loadData();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(response.message || 'Failed to update attribute status');
      }
    } catch (err: any) {
      console.error('[ADMIN ATTRIBUTES] Toggle status error:', err);
      setError(err.message || 'Failed to update attribute status');
    } finally {
      setActionLoading(null);
    }
  };

  const getTypeLabel = (type: string): string => {
    switch (type) {
      case 'text':
        return 'Text';
      case 'number':
        return 'Number';
      case 'select':
        return 'Select';
      default:
        return type;
    }
  };

  const getTypeColor = (type: string): string => {
    switch (type) {
      case 'text':
        return 'bg-blue-500/20 text-blue-400';
      case 'number':
        return 'bg-purple-500/20 text-purple-400';
      case 'select':
        return 'bg-green-500/20 text-green-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getCategoryNames = (categoryIds: string[]): string => {
    return categoryIds
      .map((id) => {
        const category = categories.find((cat) => cat.id === id);
        return category?.name || 'Unknown';
      })
      .join(', ') || 'None';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Attributes</h1>
          <p className="text-text-secondary">Manage global product attributes</p>
        </div>
        <Button variant="primary" size="md" onClick={handleAdd} disabled={actionLoading !== null}>
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Attribute
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

      {/* Attributes Table */}
      <Card className="bg-surface border-border">
        <CardHeader>
          <CardTitle>All Attributes ({attributes.length} total)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-text-secondary">Loading attributes...</p>
            </div>
          ) : attributes.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-text-secondary">No attributes found. Create your first attribute to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#242424]">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Name</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Code</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Type</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Applicable Categories</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Status</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-white">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {attributes.map((attribute) => (
                    <tr key={attribute.id} className="border-b border-[#242424] hover:bg-[#1A1A1A] transition-colors">
                      <td className="py-3 px-4">
                        <span className="text-white">{attribute.name}</span>
                      </td>
                      <td className="py-3 px-4">
                        <code className="text-sm text-text-secondary bg-[#0B0B0B] px-2 py-1 rounded">
                          {attribute.code}
                        </code>
                      </td>
                      <td className="py-3 px-4">
                        <span className={cn('px-2 py-1 rounded text-xs font-semibold', getTypeColor(attribute.type))}>
                          {getTypeLabel(attribute.type)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-text-secondary">
                          {getCategoryNames(attribute.applicableCategories)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={cn(
                            'px-2 py-1 rounded text-xs font-semibold',
                            attribute.status === 'active'
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-gray-500/20 text-gray-400'
                          )}
                        >
                          {attribute.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleEdit(attribute)}
                            disabled={actionLoading !== null}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleStatus(attribute)}
                            disabled={actionLoading === attribute.id}
                            className={cn(
                              attribute.status === 'active'
                                ? 'border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10'
                                : 'border-green-500/50 text-green-400 hover:bg-green-500/10'
                            )}
                          >
                            {actionLoading === attribute.id
                              ? '...'
                              : attribute.status === 'active'
                                ? 'Disable'
                                : 'Enable'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Attribute Modal */}
      <Modal
        isOpen={showAddModal || showEditModal}
        onClose={() => {
          setShowAddModal(false);
          setShowEditModal(false);
          setFormData({
            name: '',
            code: '',
            type: 'text',
            allowedValues: [],
            applicableCategories: [],
            status: 'active',
          });
          setAllowedValueInput('');
          setSelectedAttribute(null);
          setError(null);
        }}
        title={showEditModal ? 'Edit Attribute' : 'Add Attribute'}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Attribute Name *"
            value={formData.name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g., Size, Color, Weight"
            required
          />

          <Input
            label="Code *"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
            placeholder="e.g., size, color, weight"
            required
          />

          <div>
            <label className="block text-sm font-medium text-white mb-2">Type *</label>
            <select
              value={formData.type}
              onChange={(e) => {
                const newType = e.target.value as 'text' | 'number' | 'select';
                setFormData({
                  ...formData,
                  type: newType,
                  allowedValues: newType === 'select' ? formData.allowedValues : [],
                });
              }}
              className="w-full px-4 py-3 rounded-lg bg-[#0B0B0B] border border-[#242424] text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="select">Select (Dropdown)</option>
            </select>
          </div>

          {formData.type === 'select' && (
            <div>
              <label className="block text-sm font-medium text-white mb-2">Allowed Values *</label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={allowedValueInput}
                    onChange={(e) => setAllowedValueInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddAllowedValue();
                      }
                    }}
                    placeholder="Enter value and press Enter"
                    className="flex-1"
                  />
                  <Button variant="secondary" size="md" onClick={handleAddAllowedValue} type="button">
                    Add
                  </Button>
                </div>
                {formData.allowedValues && formData.allowedValues.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.allowedValues.map((value) => (
                      <span
                        key={value}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-[#1A1A1A] border border-[#242424] rounded-lg text-sm text-white"
                      >
                        {value}
                        <button
                          type="button"
                          onClick={() => handleRemoveAllowedValue(value)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-text-muted">
                  {formData.allowedValues?.length || 0} value(s) added. Select type requires at least one value.
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-white mb-2">Applicable Categories *</label>
            <div className="max-h-48 overflow-y-auto border border-[#242424] rounded-lg p-3 bg-[#0B0B0B]">
              {categories.length === 0 ? (
                <p className="text-sm text-text-muted">No active categories available. Create categories first.</p>
              ) : (
                <div className="space-y-2">
                  {categories.map((category) => (
                    <label key={category.id} className="flex items-center gap-2 cursor-pointer hover:bg-[#1A1A1A] p-2 rounded">
                      <input
                        type="checkbox"
                        checked={formData.applicableCategories.includes(category.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              applicableCategories: [...formData.applicableCategories, category.id],
                            });
                          } else {
                            setFormData({
                              ...formData,
                              applicableCategories: formData.applicableCategories.filter((id) => id !== category.id),
                            });
                          }
                        }}
                        className="w-4 h-4 text-primary rounded focus:ring-primary"
                      />
                      <span className="text-sm text-white">{category.name}</span>
                      <span className="text-xs text-text-muted">(Level {category.level})</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-text-muted mt-1">
              {formData.applicableCategories.length} category(ies) selected
            </p>
          </div>

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
              disabled={
                actionLoading === 'submit' ||
                !formData.name.trim() ||
                !formData.code.trim() ||
                (formData.type === 'select' && (!formData.allowedValues || formData.allowedValues.length === 0)) ||
                formData.applicableCategories.length === 0
              }
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
                setFormData({
                  name: '',
                  code: '',
                  type: 'text',
                  allowedValues: [],
                  applicableCategories: [],
                  status: 'active',
                });
                setAllowedValueInput('');
                setSelectedAttribute(null);
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

