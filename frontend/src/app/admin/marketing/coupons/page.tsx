'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Footer } from '@/components/marketing';
import { couponAPI } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Coupon {
  _id: string;
  couponId: string;
  code: string;
  type: 'percent' | 'fixed' | 'bogo' | 'tiered';
  value: number;
  conditions: {
    minOrder?: number;
    productSkus?: string[];
    usageLimitPerUser?: number;
    maxRedemptions?: number;
  };
  storeId: string;
  startsAt?: string;
  endsAt?: string;
  active: boolean;
  redemptionCount?: number;
  createdAt: string;
  updatedAt: string;
}

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    type: 'percent' as 'percent' | 'fixed' | 'bogo' | 'tiered',
    value: 0,
    storeId: '',
    minOrder: '',
    productSkus: '',
    usageLimitPerUser: '',
    maxRedemptions: '',
    startsAt: '',
    endsAt: '',
    active: true,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await couponAPI.getAll();
      if (response.success) {
        setCoupons(response.data || []);
      } else {
        setError(response.message || 'Failed to fetch coupons');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching coupons');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);

      const conditions: any = {};
      if (formData.minOrder) conditions.minOrder = parseFloat(formData.minOrder);
      if (formData.productSkus)
        conditions.productSkus = formData.productSkus.split(',').map((s) => s.trim()).filter(Boolean);
      if (formData.usageLimitPerUser) conditions.usageLimitPerUser = parseInt(formData.usageLimitPerUser);
      if (formData.maxRedemptions) conditions.maxRedemptions = parseInt(formData.maxRedemptions);

      const response = await couponAPI.create({
        code: formData.code,
        type: formData.type,
        value: formData.value,
        storeId: formData.storeId,
        conditions: Object.keys(conditions).length > 0 ? conditions : undefined,
        startsAt: formData.startsAt || undefined,
        endsAt: formData.endsAt || undefined,
        active: formData.active,
      });

      if (response.success) {
        setShowCreateForm(false);
        setFormData({
          code: '',
          type: 'percent',
          value: 0,
          storeId: '',
          minOrder: '',
          productSkus: '',
          usageLimitPerUser: '',
          maxRedemptions: '',
          startsAt: '',
          endsAt: '',
          active: true,
        });
        await fetchCoupons();
      } else {
        setError(response.message || 'Failed to create coupon');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while creating the coupon');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (couponId: string, currentActive: boolean) => {
    try {
      const response = await couponAPI.update(couponId, { active: !currentActive });
      if (response.success) {
        await fetchCoupons();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update coupon');
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <SectionTitle>Coupon Management</SectionTitle>
            <p className="text-gray-600 mt-2">Create and manage discount coupons</p>
          </div>
          <Button onClick={() => setShowCreateForm(!showCreateForm)}>
            {showCreateForm ? 'Cancel' : 'Create Coupon'}
          </Button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {showCreateForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Create New Coupon</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Coupon Code *
                    </label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                    <select
                      value={formData.type}
                      onChange={(e) =>
                        setFormData({ ...formData, type: e.target.value as typeof formData.type })
                      }
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="percent">Percent</option>
                      <option value="fixed">Fixed Amount</option>
                      <option value="bogo">Buy One Get One</option>
                      <option value="tiered">Tiered</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Value *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.value}
                      onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={formData.type === 'percent' ? 'e.g., 10 for 10%' : 'e.g., 5 for $5'}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Store ID *</label>
                    <input
                      type="text"
                      value={formData.storeId}
                      onChange={(e) => setFormData({ ...formData, storeId: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Min Order ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.minOrder}
                      onChange={(e) => setFormData({ ...formData, minOrder: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Product SKUs (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={formData.productSkus}
                      onChange={(e) => setFormData({ ...formData, productSkus: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="SKU001, SKU002"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Usage Limit Per User
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.usageLimitPerUser}
                      onChange={(e) => setFormData({ ...formData, usageLimitPerUser: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Redemptions</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.maxRedemptions}
                      onChange={(e) => setFormData({ ...formData, maxRedemptions: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input
                      type="datetime-local"
                      value={formData.startsAt}
                      onChange={(e) => setFormData({ ...formData, startsAt: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <input
                      type="datetime-local"
                      value={formData.endsAt}
                      onChange={(e) => setFormData({ ...formData, endsAt: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="active"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    className="mr-2"
                  />
                  <label htmlFor="active" className="text-sm font-medium text-gray-700">
                    Active
                  </label>
                </div>

                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Coupon'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>All Coupons</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Loading coupons...</p>
              </div>
            ) : coupons.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No coupons found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Code
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Value
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Redemptions
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Expires
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {coupons.map((coupon) => (
                      <tr key={coupon._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-mono font-semibold text-gray-900">{coupon.code}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900 capitalize">{coupon.type}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900">
                            {coupon.type === 'percent' ? `${coupon.value}%` : `$${coupon.value}`}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900">{coupon.redemptionCount || 0}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={cn(
                              'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold',
                              coupon.active
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            )}
                          >
                            {coupon.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(coupon.endsAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleToggleActive(coupon.couponId, coupon.active)}
                            className={cn(
                              'text-sm px-3 py-1 rounded-md',
                              coupon.active
                                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                            )}
                          >
                            {coupon.active ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}

