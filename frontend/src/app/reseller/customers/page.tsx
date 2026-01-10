'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface Customer {
  id: string;
  customerId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  orderCount: number;
  totalSpent: number;
  averageOrderValue: number;
  lastOrderDate: string;
  firstOrderDate: string;
  isGuest: boolean;
}

interface CustomersResponse {
  success: boolean;
  data?: {
    customers: Customer[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  message?: string;
}

export default function ResellerCustomersPage() {
  const router = useRouter();
  const user = getCurrentUser();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user || user.role !== 'reseller') {
      router.push('/unauthorized');
      return;
    }
    fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, search]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append('page', pagination.page.toString());
      params.append('limit', pagination.limit.toString());
      if (search) params.append('q', search);

      const response = await api.get(`/reseller/customers?${params.toString()}`);
      const data: CustomersResponse = response.data;

      if (data.success && data.data) {
        setCustomers(data.data.customers);
        setPagination(data.data.pagination);
      } else {
        setError(data.message || 'Failed to load customers');
      }
    } catch (err: any) {
      console.error('[RESELLER CUSTOMERS] Load error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPagination((prev) => ({ ...prev, page: 1 })); // Reset to first page
  };

  if (loading && customers.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Customers</h1>
          <p className="text-text-secondary">Manage your customer base</p>
        </div>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading customers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Customers</h1>
        <p className="text-text-secondary">Manage your customer base</p>
      </div>

      {/* Search and Filters */}
      <Card className="bg-surface border-border">
        <CardHeader>
          <CardTitle className="text-white">Search Customers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by name or email..."
              className="flex-1 px-4 py-2 rounded-lg bg-[#0B0B0B] border border-[#242424] text-white focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Button variant="secondary" onClick={fetchCustomers}>
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Customers Table */}
      <Card className="bg-surface border-border">
        <CardHeader>
          <CardTitle className="text-white">
            Customers ({pagination.total})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-text-secondary mb-4">No customers found</p>
              {search && (
                <Button variant="secondary" onClick={() => handleSearchChange('')}>
                  Clear Search
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#242424]">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-white">Customer</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-white">Contact</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-white">Orders</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-white">Total Spent</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-white">Avg Order</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-white">Last Order</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-white">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((customer) => (
                      <tr key={customer.id} className="border-b border-[#242424] hover:bg-[#1A1A1A] transition-colors">
                        <td className="py-3 px-4">
                          <div className="text-white font-medium">{customer.name}</div>
                          {customer.isGuest && (
                            <span className="text-xs text-text-muted">(Guest)</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {customer.email && (
                            <div className="text-white text-sm">{customer.email}</div>
                          )}
                          {customer.phone && (
                            <div className="text-text-secondary text-sm">{customer.phone}</div>
                          )}
                          {!customer.email && !customer.phone && (
                            <span className="text-text-muted text-sm">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-white">{customer.orderCount}</td>
                        <td className="py-3 px-4 text-white font-medium">{formatCurrency(customer.totalSpent)}</td>
                        <td className="py-3 px-4 text-text-secondary">{formatCurrency(customer.averageOrderValue)}</td>
                        <td className="py-3 px-4 text-text-secondary text-sm">{formatDate(customer.lastOrderDate)}</td>
                        <td className="py-3 px-4">
                          <div className="flex justify-end">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => router.push(`/reseller/customers/${customer.id}/orders`)}
                            >
                              View Orders
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <div className="text-text-secondary text-sm">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} customers
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                      disabled={pagination.page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                      disabled={pagination.page >= pagination.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
