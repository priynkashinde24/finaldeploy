'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import {
  getStores,
  createStore,
  updateStore,
  disableStore,
  Store,
  CreateStoreData,
} from '@/lib/adminStores';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';

export default function AdminStoresPage() {
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'draft' | 'active' | 'inactive' | ''>('');
  const [ownerTypeFilter, setOwnerTypeFilter] = useState<'admin' | 'reseller' | ''>('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);

  // Form state
  const [formData, setFormData] = useState<CreateStoreData>({
    name: '',
    code: '',
    ownerType: 'admin',
    status: 'active',
    description: '',
  });

  const currentUser = getCurrentUser();

  useEffect(() => {
    if (currentUser?.role !== 'admin') {
      router.push('/unauthorized');
      return;
    }
    loadStores();
  }, [currentUser, router, statusFilter, ownerTypeFilter]);

  const loadStores = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await getStores({
        status: statusFilter || undefined,
        ownerType: ownerTypeFilter || undefined,
      });

      if (response.success && response.data) {
        setStores(response.data.stores);
      } else {
        setError(response.message || 'Failed to load stores');
      }
    } catch (err: any) {
      console.error('[ADMIN STORES] Load error:', err);
      setError(err.message || 'Failed to load stores');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setFormData({
      name: '',
      code: '',
      ownerType: 'admin',
      status: 'active',
      description: '',
    });
    setSelectedStore(null);
    setShowAddModal(true);
  };

  const handleEdit = (store: Store) => {
    setFormData({
      name: store.name,
      code: store.code,
      ownerType: store.ownerType,
      status: store.status,
      description: store.description || '',
    });
    setSelectedStore(store);
    setShowEditModal(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError('Store name is required');
      return;
    }

    if (!formData.code.trim()) {
      setError('Store code is required');
      return;
    }

    try {
      setActionLoading('submit');
      setError(null);

      let response;
      if (showEditModal && selectedStore) {
        response = await updateStore(selectedStore._id, formData);
      } else {
        response = await createStore(formData);
      }

      if (response.success) {
        setSuccessMessage(showEditModal ? 'Store updated successfully' : 'Store created successfully');
        setShowAddModal(false);
        setShowEditModal(false);
        setFormData({
          name: '',
          code: '',
          ownerType: 'admin',
          status: 'active',
          description: '',
        });
        setSelectedStore(null);
        setTimeout(() => setSuccessMessage(null), 3000);
        loadStores();
      } else {
        setError(response.message || 'Failed to save store');
      }
    } catch (err: any) {
      console.error('[ADMIN STORES] Submit error:', err);
      setError(err.message || 'Failed to save store');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisable = async (store: Store) => {
    if (!confirm(`Are you sure you want to disable "${store.name}"?`)) {
      return;
    }

    try {
      setActionLoading(store._id);
      setError(null);

      const response = await disableStore(store._id);

      if (response.success) {
        setSuccessMessage('Store disabled successfully');
        setTimeout(() => setSuccessMessage(null), 3000);
        loadStores();
      } else {
        setError(response.message || 'Failed to disable store');
      }
    } catch (err: any) {
      console.error('[ADMIN STORES] Disable error:', err);
      setError(err.message || 'Failed to disable store');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Stores</h1>
          <p className="text-text-secondary">Manage stores and their price overrides</p>
        </div>
        <Button variant="primary" size="md" onClick={handleAdd} disabled={actionLoading !== null}>
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Store
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

      {/* Filters */}
      <Card className="bg-surface border-border">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-white mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'draft' | 'active' | 'inactive' | '')}
                className="w-full px-4 py-2 rounded-lg bg-[#0B0B0B] border border-[#242424] text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="draft">Draft</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-white mb-2">Owner Type</label>
              <select
                value={ownerTypeFilter}
                onChange={(e) => setOwnerTypeFilter(e.target.value as 'admin' | 'reseller' | '')}
                className="w-full px-4 py-2 rounded-lg bg-[#0B0B0B] border border-[#242424] text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              >
                <option value="">All Types</option>
                <option value="admin">Admin</option>
                <option value="reseller">Reseller</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stores Table */}
      <Card className="bg-surface border-border">
        <CardHeader>
          <CardTitle>Stores ({stores.length} total)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-text-secondary">Loading stores...</p>
            </div>
          ) : stores.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-text-secondary">
                No stores found. Create your first store to get started.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#242424]">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Name</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Code</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Owner Type</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Status</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-white">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {stores.map((store) => (
                    <tr
                      key={store._id}
                      className="border-b border-[#242424] hover:bg-[#1A1A1A] transition-colors"
                    >
                      <td className="py-3 px-4 text-white">{store.name}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-500/20 text-blue-400 uppercase">
                          {store.code}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-text-secondary text-sm capitalize">{store.ownerType}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={cn(
                            'px-2 py-1 rounded text-xs font-semibold',
                            store.status === 'active'
                              ? 'bg-green-500/20 text-green-400'
                              : store.status === 'inactive'
                                ? 'bg-gray-500/20 text-gray-400'
                                : 'bg-yellow-500/20 text-yellow-400'
                          )}
                        >
                          {store.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2 justify-end">
                          <Link href={`/admin/stores/${store._id}/pricing`}>
                            <Button variant="secondary" size="sm" disabled={actionLoading !== null}>
                              Pricing
                            </Button>
                          </Link>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleEdit(store)}
                            disabled={actionLoading !== null}
                          >
                            Edit
                          </Button>
                          {store.status === 'active' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDisable(store)}
                              disabled={actionLoading === store._id}
                              className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
                            >
                              {actionLoading === store._id ? '...' : 'Disable'}
                            </Button>
                          )}
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

      {/* Add/Edit Store Modal */}
      <Modal
        isOpen={showAddModal || showEditModal}
        onClose={() => {
          setShowAddModal(false);
          setShowEditModal(false);
          setFormData({
            name: '',
            code: '',
            ownerType: 'admin',
            status: 'active',
            description: '',
          });
          setSelectedStore(null);
          setError(null);
        }}
        title={showEditModal ? 'Edit Store' : 'Add Store'}
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Store Name *"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Web Store"
            required
          />

          <Input
            label="Store Code *"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
            placeholder="e.g., WEB, APP, STORE_01"
            required
            disabled={showEditModal} // Code cannot be changed after creation
          />

          <div>
            <label className="block text-sm font-medium text-white mb-2">Owner Type</label>
            <select
              value={formData.ownerType}
              onChange={(e) => setFormData({ ...formData, ownerType: e.target.value as 'admin' | 'reseller' })}
              className="w-full px-4 py-3 rounded-lg bg-[#0B0B0B] border border-[#242424] text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              disabled={showEditModal}
            >
              <option value="admin">Admin</option>
              <option value="reseller">Reseller</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Status</label>
            <select
              value={formData.status}
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value as 'draft' | 'active' | 'inactive' })
              }
              className="w-full px-4 py-3 rounded-lg bg-[#0B0B0B] border border-[#242424] text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="draft">Draft</option>
            </select>
          </div>

          <Input
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Optional description"
          />

          <div className="flex gap-3 pt-4">
            <Button
              variant="primary"
              size="md"
              onClick={handleSubmit}
              disabled={actionLoading === 'submit' || !formData.name.trim() || !formData.code.trim()}
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
                  ownerType: 'admin',
                  status: 'active',
                  description: '',
                });
                setSelectedStore(null);
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
