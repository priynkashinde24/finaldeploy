'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import {
  getCoupons,
  createCoupon,
  updateCoupon,
  disableCoupon,
  Coupon,
  CreateCouponData,
  UpdateCouponData,
} from '@/lib/adminCoupons';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

export default function AdminCouponsPage() {
  const router = useRouter();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const currentUser = getCurrentUser();

  useEffect(() => {
    if (currentUser?.role !== 'admin') {
      router.push('/unauthorized');
      return;
    }
    loadCoupons();
  }, [currentUser, router, statusFilter]);

  const loadCoupons = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {};
      if (statusFilter) params.status = statusFilter;

      const response = await getCoupons(params);

      if (response.success && response.data) {
        setCoupons(response.data.coupons);
      } else {
        setError(response.message || 'Failed to load coupons');
      }
    } catch (err: any) {
      console.error('[ADMIN COUPONS] Load error:', err);
      setError(err.message || 'Failed to load coupons');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async (id: string) => {
    if (!confirm('Are you sure you want to disable this coupon?')) {
      return;
    }

    try {
      setActionLoading(id);
      setError(null);

      const response = await disableCoupon(id);

      if (response.success) {
        setSuccessMessage('Coupon disabled successfully');
        loadCoupons();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(response.message || 'Failed to disable coupon');
      }
    } catch (err: any) {
      console.error('[ADMIN COUPONS] Disable error:', err);
      setError(err.message || 'Failed to disable coupon');
    } finally {
      setActionLoading(null);
    }
  };

  const openEditModal = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setShowModal(true);
  };

  const openCreateModal = () => {
    setEditingCoupon(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCoupon(null);
  };

  const handleModalSuccess = () => {
    closeModal();
    loadCoupons();
  };

  const formatDiscount = (type: string, value: number, max?: number | null) => {
    if (type === 'percentage') {
      return `${value}%${max ? ` (max ₹${max})` : ''}`;
    }
    return `₹${value.toFixed(2)}`;
  };

  const isExpired = (validTo: string) => {
    return new Date(validTo) < new Date();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Coupons</h1>
          <p className="text-text-secondary">Manage discount coupons</p>
        </div>
        <Button variant="primary" size="md" onClick={openCreateModal}>
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Coupon
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
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-text-secondary mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Coupons Table */}
      <Card className="bg-surface border-border">
        <CardHeader>
          <CardTitle className="text-white">Coupons</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-text-secondary">Loading...</div>
          ) : coupons.length === 0 ? (
            <div className="p-8 text-center text-text-secondary">No coupons found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-background border-b border-border">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Scope
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Discount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Validity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Usage
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {coupons.map((coupon) => (
                    <tr key={coupon._id} className="hover:bg-background/50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                        {coupon.code}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                        {coupon.applicableScope}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        {formatDiscount(coupon.discountType, coupon.discountValue, coupon.maxDiscountAmount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                        <div>
                          <div>{new Date(coupon.validFrom).toLocaleDateString()}</div>
                          <div className="text-xs">
                            {isExpired(coupon.validTo) ? (
                              <span className="text-red-400">Expired</span>
                            ) : (
                              <span>Until {new Date(coupon.validTo).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                        {coupon.usedCount} / {coupon.usageLimit || '∞'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={cn(
                            'px-2 py-1 text-xs font-medium rounded-full',
                            coupon.status === 'active'
                              ? 'bg-green-500/10 text-green-400'
                              : 'bg-gray-500/10 text-gray-400'
                          )}
                        >
                          {coupon.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openEditModal(coupon)}
                            disabled={actionLoading === coupon._id}
                          >
                            Edit
                          </Button>
                          {coupon.status === 'active' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDisable(coupon._id)}
                              disabled={actionLoading === coupon._id}
                              className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                            >
                              {actionLoading === coupon._id ? 'Disabling...' : 'Disable'}
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

      {/* Add/Edit Modal */}
      {showModal && (
        <CouponModal
          coupon={editingCoupon}
          onClose={closeModal}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  );
}

// Coupon Modal Component (simplified - full implementation would include all fields)
interface CouponModalProps {
  coupon: Coupon | null;
  onClose: () => void;
  onSuccess: () => void;
}

function CouponModal({ coupon, onClose, onSuccess }: CouponModalProps) {
  const [formData, setFormData] = useState<CreateCouponData>({
    code: '',
    description: '',
    discountType: 'percentage',
    discountValue: 0,
    maxDiscountAmount: null,
    minOrderValue: null,
    applicableScope: 'global',
    scopeId: null,
    usageLimit: null,
    usagePerUser: null,
    validFrom: new Date().toISOString(),
    validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (coupon) {
      setFormData({
        code: coupon.code,
        description: coupon.description || '',
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        maxDiscountAmount: coupon.maxDiscountAmount || null,
        minOrderValue: coupon.minOrderValue || null,
        applicableScope: coupon.applicableScope,
        scopeId: coupon.scopeId || null,
        usageLimit: coupon.usageLimit || null,
        usagePerUser: coupon.usagePerUser || null,
        validFrom: coupon.validFrom,
        validTo: coupon.validTo,
        status: coupon.status,
      });
    }
  }, [coupon]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      setLoading(true);

      let response;
      if (coupon) {
        const updateData: UpdateCouponData = {
          description: formData.description,
          discountType: formData.discountType,
          discountValue: formData.discountValue,
          maxDiscountAmount: formData.maxDiscountAmount,
          minOrderValue: formData.minOrderValue,
          usageLimit: formData.usageLimit,
          usagePerUser: formData.usagePerUser,
          validFrom: formData.validFrom,
          validTo: formData.validTo,
          status: formData.status,
        };
        response = await updateCoupon(coupon._id, updateData);
      } else {
        response = await createCoupon(formData);
      }

      if (response.success) {
        onSuccess();
      } else {
        setError(response.message || 'Failed to save coupon');
      }
    } catch (err: any) {
      console.error('[COUPON MODAL] Submit error:', err);
      setError(err.message || 'Failed to save coupon');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface border border-border rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">{coupon ? 'Edit Coupon' : 'Add Coupon'}</h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Code (only for new coupons) */}
          {!coupon && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Code</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white"
                placeholder="SAVE20"
                required
              />
            </div>
          )}

          {/* Discount Type and Value */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Discount Type</label>
              <select
                value={formData.discountType}
                onChange={(e) => setFormData({ ...formData, discountType: e.target.value as any })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white"
                required
              >
                <option value="percentage">Percentage</option>
                <option value="amount">Fixed Amount</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Discount Value</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max={formData.discountType === 'percentage' ? 100 : undefined}
                value={formData.discountValue}
                onChange={(e) =>
                  setFormData({ ...formData, discountValue: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white"
                required
              />
            </div>
          </div>

          {/* Validity Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Valid From</label>
              <input
                type="datetime-local"
                value={formData.validFrom.substring(0, 16)}
                onChange={(e) => setFormData({ ...formData, validFrom: new Date(e.target.value).toISOString() })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Valid To</label>
              <input
                type="datetime-local"
                value={formData.validTo.substring(0, 16)}
                onChange={(e) => setFormData({ ...formData, validTo: new Date(e.target.value).toISOString() })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white"
                required
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-4 pt-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Saving...' : coupon ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

