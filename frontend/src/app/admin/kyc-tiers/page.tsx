'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { supplierKycTierAPI } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type KYCTier = 'tier1' | 'tier2' | 'tier3';

interface SupplierTier {
  id: string;
  supplierId: any;
  supplierName: string;
  supplierEmail: string;
  currentTier: KYCTier;
  status: string;
  assignedAt: string;
  assignedBy: any;
  benefits: any;
  tierHistory: any[];
}

export default function AdminKYCTiersPage() {
  const router = useRouter();
  const user = getCurrentUser();

  const [tiers, setTiers] = useState<SupplierTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ tier: '', status: '', supplierId: '' });
  const [assigning, setAssigning] = useState<string | null>(null);
  const [assignForm, setAssignForm] = useState({ supplierId: '', tier: 'tier1' as KYCTier, reason: '' });

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.role !== 'admin') {
      router.push('/dashboard');
      return;
    }
    loadTiers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, router, filters]);

  const loadTiers = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await supplierKycTierAPI.listTiers({
        tier: filters.tier || undefined,
        status: filters.status || undefined,
        supplierId: filters.supplierId || undefined,
      });

      if (response.success) {
        setTiers(response.data.tiers || []);
      } else {
        setError(response.message || 'Failed to load tiers');
      }
    } catch (err: any) {
      console.error('[ADMIN KYC TIERS] Load error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load tiers');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignTier = async () => {
    if (!assignForm.supplierId || !assignForm.tier) {
      setError('Please fill all required fields');
      return;
    }

    try {
      setAssigning(assignForm.supplierId);
      setError(null);

      const response = await supplierKycTierAPI.assignTier({
        supplierId: assignForm.supplierId,
        tier: assignForm.tier,
        reason: assignForm.reason || undefined,
      });

      if (response.success) {
        alert('Tier assigned successfully');
        setAssignForm({ supplierId: '', tier: 'tier1', reason: '' });
        loadTiers();
      } else {
        setError(response.message || 'Failed to assign tier');
      }
    } catch (err: any) {
      console.error('[ADMIN KYC TIERS] Assign error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to assign tier');
    } finally {
      setAssigning(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatTierName = (tier: KYCTier) => {
    const names: Record<KYCTier, string> = {
      tier1: 'Tier 1 - Basic',
      tier2: 'Tier 2 - Business',
      tier3: 'Tier 3 - Enhanced',
    };
    return names[tier];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading supplier tiers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Supplier KYC Tiers</h1>
          <p className="text-text-secondary">Manage supplier tier assignments and view tier status</p>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <div className="font-semibold text-red-400">Error</div>
                <div className="text-sm text-red-300">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Assign Tier Form */}
        <Card className="bg-surface border-border">
          <CardHeader>
            <CardTitle className="text-white">Assign Tier</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="supplier-id" className="text-text-secondary mb-2 block text-sm font-medium">
                  Supplier ID
                </label>
                <Input
                  id="supplier-id"
                  value={assignForm.supplierId}
                  onChange={(e) => setAssignForm({ ...assignForm, supplierId: e.target.value })}
                  placeholder="Enter supplier user ID"
                />
              </div>
              <div>
                <label htmlFor="tier-select" className="text-text-secondary mb-2 block text-sm font-medium">
                  Tier
                </label>
                <select
                  id="tier-select"
                  value={assignForm.tier}
                  onChange={(e) => setAssignForm({ ...assignForm, tier: e.target.value as KYCTier })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="tier1">Tier 1 - Basic</option>
                  <option value="tier2">Tier 2 - Business</option>
                  <option value="tier3">Tier 3 - Enhanced</option>
                </select>
              </div>
              <div>
                <label htmlFor="reason" className="text-text-secondary mb-2 block text-sm font-medium">
                  Reason (Optional)
                </label>
                <Input
                  id="reason"
                  value={assignForm.reason}
                  onChange={(e) => setAssignForm({ ...assignForm, reason: e.target.value })}
                  placeholder="Reason for assignment"
                />
              </div>
            </div>
            <Button
              onClick={handleAssignTier}
              disabled={assigning !== null || !assignForm.supplierId}
              variant="primary"
            >
              {assigning ? 'Assigning...' : 'Assign Tier'}
            </Button>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card className="bg-surface border-border">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="filter-tier" className="text-text-secondary mb-2 block text-sm font-medium">
                  Filter by Tier
                </label>
                <select
                  id="filter-tier"
                  value={filters.tier}
                  onChange={(e) => setFilters({ ...filters, tier: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">All Tiers</option>
                  <option value="tier1">Tier 1</option>
                  <option value="tier2">Tier 2</option>
                  <option value="tier3">Tier 3</option>
                </select>
              </div>
              <div>
                <label htmlFor="filter-status" className="text-text-secondary mb-2 block text-sm font-medium">
                  Filter by Status
                </label>
                <select
                  id="filter-status"
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="downgraded">Downgraded</option>
                </select>
              </div>
              <div>
                <label htmlFor="filter-supplier" className="text-text-secondary mb-2 block text-sm font-medium">
                  Filter by Supplier ID
                </label>
                <Input
                  id="filter-supplier"
                  value={filters.supplierId}
                  onChange={(e) => setFilters({ ...filters, supplierId: e.target.value })}
                  placeholder="Enter supplier ID"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tiers List */}
        <Card className="bg-surface border-border">
          <CardHeader>
            <CardTitle className="text-white">Supplier Tiers ({tiers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {tiers.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-text-secondary">No supplier tiers found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary">Supplier</th>
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary">Tier</th>
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary">Status</th>
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary">Max Order Value</th>
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary">Commission</th>
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary">Assigned At</th>
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tiers.map((tier) => (
                      <tr key={tier.id} className="border-b border-border hover:bg-muted/20">
                        <td className="py-3 px-4">
                          <div>
                            <p className="text-white font-medium">{tier.supplierName}</p>
                            <p className="text-sm text-text-secondary">{tier.supplierEmail}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 bg-primary/20 text-primary rounded text-xs font-medium">
                            {formatTierName(tier.currentTier)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${
                            tier.status === 'active' ? 'bg-green-500/20 text-green-400' :
                            tier.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                            tier.status === 'suspended' ? 'bg-red-500/20 text-red-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {tier.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-text-secondary">
                          {formatCurrency(tier.benefits.maxOrderValue)}
                        </td>
                        <td className="py-3 px-4 text-text-secondary">
                          {tier.benefits.commissionRate}%
                        </td>
                        <td className="py-3 px-4 text-text-secondary text-sm">
                          {new Date(tier.assignedAt).toLocaleDateString('en-IN')}
                        </td>
                        <td className="py-3 px-4">
                          <Button
                            onClick={() => {
                              setAssignForm({
                                supplierId: tier.supplierId._id || tier.supplierId,
                                tier: tier.currentTier,
                                reason: '',
                              });
                              document.getElementById('supplier-id')?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            variant="secondary"
                            size="sm"
                          >
                            View/Edit
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

