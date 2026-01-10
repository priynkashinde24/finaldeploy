'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { supplierKycTierAPI } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

type KYCTier = 'tier1' | 'tier2' | 'tier3';

interface TierInfo {
  currentTier: KYCTier | null;
  status: string;
  assignedAt: string;
  benefits: {
    maxOrderValue: number;
    maxMonthlyOrders: number;
    payoutFrequency: string;
    payoutDelayDays: number;
    commissionRate: number;
    features: string[];
  };
  requirements: any;
}

interface TierDefinition {
  name: string;
  description: string;
  requirements: any;
  benefits: {
    maxOrderValue: number;
    maxMonthlyOrders: number;
    payoutFrequency: string;
    payoutDelayDays: number;
    commissionRate: number;
    features: string[];
  };
}

export default function SupplierKYCTierPage() {
  const router = useRouter();
  const user = getCurrentUser();

  const [tierInfo, setTierInfo] = useState<TierInfo | null>(null);
  const [eligibleTiers, setEligibleTiers] = useState<Record<KYCTier, boolean>>({
    tier1: false,
    tier2: false,
    tier3: false,
  });
  const [canUpgrade, setCanUpgrade] = useState<{ tier2: boolean; tier3: boolean }>({
    tier2: false,
    tier3: false,
  });
  const [missingRequirements, setMissingRequirements] = useState<Record<KYCTier, string[]>>({
    tier1: [],
    tier2: [],
    tier3: [],
  });
  const [tierDefinitions, setTierDefinitions] = useState<Record<KYCTier, TierDefinition>>({} as any);
  const [kycStatus, setKycStatus] = useState<string>('not_submitted');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.role !== 'supplier') {
      router.push('/dashboard');
      return;
    }
    loadTierInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, router]);

  const loadTierInfo = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await supplierKycTierAPI.getMyTier();
      if (response.success) {
        setTierInfo(response.data.tier);
        setEligibleTiers(response.data.eligibleTiers);
        setCanUpgrade(response.data.canUpgrade);
        setMissingRequirements(response.data.missingRequirements || { tier1: [], tier2: [], tier3: [] });
        setTierDefinitions(response.data.tierDefinitions);
        setKycStatus(response.data.kycStatus);
      } else {
        setError(response.message || 'Failed to load tier information');
      }
    } catch (err: any) {
      console.error('[KYC TIER] Load error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load tier information');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestUpgrade = async (tier: 'tier2' | 'tier3') => {
    try {
      setUpgrading(true);
      setError(null);

      const response = await supplierKycTierAPI.requestUpgrade(tier);
      if (response.success) {
        alert(`Tier upgrade request submitted. Admin approval required.`);
        loadTierInfo();
      } else {
        setError(response.message || 'Failed to request upgrade');
      }
    } catch (err: any) {
      console.error('[KYC TIER] Upgrade error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to request upgrade');
    } finally {
      setUpgrading(false);
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
    return tierDefinitions[tier]?.name || tier.toUpperCase();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading tier information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">KYC Tier Status</h1>
          <p className="text-text-secondary">View your current tier and eligibility for upgrades</p>
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

        {/* Current Tier Card */}
        {tierInfo ? (
          <Card className="bg-surface border-border">
            <CardHeader>
              <CardTitle className="text-white">Current Tier: {formatTierName(tierInfo.currentTier as KYCTier)}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-text-secondary text-sm mb-1">Status</p>
                  <p className="text-white font-semibold capitalize">{tierInfo.status}</p>
                </div>
                <div>
                  <p className="text-text-secondary text-sm mb-1">Assigned At</p>
                  <p className="text-white">
                    {new Date(tierInfo.assignedAt).toLocaleDateString('en-IN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <h3 className="text-white font-semibold mb-3">Current Benefits</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-text-secondary text-sm mb-1">Max Order Value</p>
                    <p className="text-white font-semibold">{formatCurrency(tierInfo.benefits.maxOrderValue)}</p>
                  </div>
                  <div>
                    <p className="text-text-secondary text-sm mb-1">Max Monthly Orders</p>
                    <p className="text-white font-semibold">{tierInfo.benefits.maxMonthlyOrders}</p>
                  </div>
                  <div>
                    <p className="text-text-secondary text-sm mb-1">Payout Frequency</p>
                    <p className="text-white font-semibold capitalize">{tierInfo.benefits.payoutFrequency}</p>
                  </div>
                  <div>
                    <p className="text-text-secondary text-sm mb-1">Payout Delay</p>
                    <p className="text-white font-semibold">{tierInfo.benefits.payoutDelayDays} days</p>
                  </div>
                  <div>
                    <p className="text-text-secondary text-sm mb-1">Platform Commission</p>
                    <p className="text-white font-semibold">{tierInfo.benefits.commissionRate}%</p>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-text-secondary text-sm mb-2">Features</p>
                  <div className="flex flex-wrap gap-2">
                    {tierInfo.benefits.features.map((feature, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-primary/20 text-primary rounded-full text-xs font-medium"
                      >
                        {feature.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-surface border-border">
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-text-secondary mb-4">No tier assigned yet</p>
                <p className="text-sm text-text-muted">
                  {kycStatus === 'not_submitted'
                    ? 'Please submit your KYC first to get tier assignment.'
                    : kycStatus === 'pending'
                      ? 'Your KYC is pending approval. Once approved, you will be assigned a tier.'
                      : 'Please contact admin for tier assignment.'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tier Comparison */}
        <Card className="bg-surface border-border">
          <CardHeader>
            <CardTitle className="text-white">Tier Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-3 px-4 text-sm font-semibold text-text-secondary">Feature</th>
                    <th className="py-3 px-4 text-sm font-semibold text-text-secondary">Tier 1</th>
                    <th className="py-3 px-4 text-sm font-semibold text-text-secondary">Tier 2</th>
                    <th className="py-3 px-4 text-sm font-semibold text-text-secondary">Tier 3</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border">
                    <td className="py-3 px-4 text-text-primary">Max Order Value</td>
                    <td className="py-3 px-4 text-text-secondary">
                      {tierDefinitions.tier1 ? formatCurrency(tierDefinitions.tier1.benefits.maxOrderValue) : '—'}
                    </td>
                    <td className="py-3 px-4 text-text-secondary">
                      {tierDefinitions.tier2 ? formatCurrency(tierDefinitions.tier2.benefits.maxOrderValue) : '—'}
                    </td>
                    <td className="py-3 px-4 text-text-secondary">
                      {tierDefinitions.tier3 ? formatCurrency(tierDefinitions.tier3.benefits.maxOrderValue) : '—'}
                    </td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-3 px-4 text-text-primary">Max Monthly Orders</td>
                    <td className="py-3 px-4 text-text-secondary">
                      {tierDefinitions.tier1?.benefits.maxMonthlyOrders || '—'}
                    </td>
                    <td className="py-3 px-4 text-text-secondary">
                      {tierDefinitions.tier2?.benefits.maxMonthlyOrders || '—'}
                    </td>
                    <td className="py-3 px-4 text-text-secondary">
                      {tierDefinitions.tier3?.benefits.maxMonthlyOrders || '—'}
                    </td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-3 px-4 text-text-primary">Payout Frequency</td>
                    <td className="py-3 px-4 text-text-secondary capitalize">
                      {tierDefinitions.tier1?.benefits.payoutFrequency || '—'}
                    </td>
                    <td className="py-3 px-4 text-text-secondary capitalize">
                      {tierDefinitions.tier2?.benefits.payoutFrequency || '—'}
                    </td>
                    <td className="py-3 px-4 text-text-secondary capitalize">
                      {tierDefinitions.tier3?.benefits.payoutFrequency || '—'}
                    </td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-3 px-4 text-text-primary">Payout Delay</td>
                    <td className="py-3 px-4 text-text-secondary">
                      {tierDefinitions.tier1?.benefits.payoutDelayDays || '—'} days
                    </td>
                    <td className="py-3 px-4 text-text-secondary">
                      {tierDefinitions.tier2?.benefits.payoutDelayDays || '—'} days
                    </td>
                    <td className="py-3 px-4 text-text-secondary">
                      {tierDefinitions.tier3?.benefits.payoutDelayDays || '—'} days
                    </td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-3 px-4 text-text-primary">Commission Rate</td>
                    <td className="py-3 px-4 text-text-secondary">
                      {tierDefinitions.tier1?.benefits.commissionRate || '—'}%
                    </td>
                    <td className="py-3 px-4 text-text-secondary">
                      {tierDefinitions.tier2?.benefits.commissionRate || '—'}%
                    </td>
                    <td className="py-3 px-4 text-text-secondary">
                      {tierDefinitions.tier3?.benefits.commissionRate || '—'}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Upgrade Options */}
        {(canUpgrade.tier2 || canUpgrade.tier3) && (
          <Card className="bg-surface border-border">
            <CardHeader>
              <CardTitle className="text-white">Upgrade Available</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {canUpgrade.tier2 && (
                <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-semibold mb-1">{formatTierName('tier2')}</h3>
                      <p className="text-sm text-text-secondary">{tierDefinitions.tier2?.description}</p>
                      <div className="mt-2 text-sm text-text-muted">
                        <p>• Max Order: {formatCurrency(tierDefinitions.tier2?.benefits.maxOrderValue || 0)}</p>
                        <p>• Commission: {tierDefinitions.tier2?.benefits.commissionRate || 0}%</p>
                        <p>• Payout: {tierDefinitions.tier2?.benefits.payoutFrequency || ''} ({tierDefinitions.tier2?.benefits.payoutDelayDays || 0} days delay)</p>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleRequestUpgrade('tier2')}
                      disabled={upgrading}
                      variant="primary"
                    >
                      {upgrading ? 'Requesting...' : 'Request Upgrade'}
                    </Button>
                  </div>
                </div>
              )}

              {canUpgrade.tier3 && (
                <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-semibold mb-1">{formatTierName('tier3')}</h3>
                      <p className="text-sm text-text-secondary">{tierDefinitions.tier3?.description}</p>
                      <div className="mt-2 text-sm text-text-muted">
                        <p>• Max Order: {formatCurrency(tierDefinitions.tier3?.benefits.maxOrderValue || 0)}</p>
                        <p>• Commission: {tierDefinitions.tier3?.benefits.commissionRate || 0}%</p>
                        <p>• Payout: {tierDefinitions.tier3?.benefits.payoutFrequency || ''} ({tierDefinitions.tier3?.benefits.payoutDelayDays || 0} days delay)</p>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleRequestUpgrade('tier3')}
                      disabled={upgrading}
                      variant="primary"
                    >
                      {upgrading ? 'Requesting...' : 'Request Upgrade'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Missing Requirements */}
        {(!eligibleTiers.tier2 || !eligibleTiers.tier3) && (
          <Card className="bg-surface border-border">
            <CardHeader>
              <CardTitle className="text-white">Requirements for Higher Tiers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!eligibleTiers.tier2 && missingRequirements.tier2.length > 0 && (
                <div>
                  <h3 className="text-white font-semibold mb-2">Tier 2 Requirements</h3>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-text-secondary">
                    {missingRequirements.tier2.map((req, idx) => (
                      <li key={idx}>{req}</li>
                    ))}
                  </ul>
                </div>
              )}
              {!eligibleTiers.tier3 && missingRequirements.tier3.length > 0 && (
                <div>
                  <h3 className="text-white font-semibold mb-2">Tier 3 Requirements</h3>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-text-secondary">
                    {missingRequirements.tier3.map((req, idx) => (
                      <li key={idx}>{req}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

