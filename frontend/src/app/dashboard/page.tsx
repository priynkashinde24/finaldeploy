
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { storeAPI } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function DashboardPage() {
  const router = useRouter();
  const user = getCurrentUser();
  const [storeCount, setStoreCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const displayName = useMemo(() => user?.name || user?.email || 'User', [user]);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    // Redirect non-resellers to their areas - use hard redirects
    if (user.role === 'admin') {
      console.log('[DASHBOARD PAGE] Admin detected, redirecting to /admin');
      if (typeof window !== 'undefined') {
        window.location.href = '/admin';
        return;
      } else {
        router.replace('/admin');
      }
      return;
    }
    if (user.role === 'supplier') {
      console.log('[DASHBOARD PAGE] Supplier detected, redirecting to /supplier');
      if (typeof window !== 'undefined') {
        window.location.href = '/supplier';
        return;
      } else {
        router.replace('/supplier');
      }
      return;
    }
    if (user.role === 'affiliate') {
      console.log('[DASHBOARD PAGE] Affiliate detected, redirecting to /affiliate');
      if (typeof window !== 'undefined') {
        window.location.href = '/affiliate';
        return;
      } else {
        router.replace('/affiliate');
      }
      return;
    }

    // Reseller/Customer/Delivery: load basic stats and determine user type
    (async () => {
      try {
        const resp = await storeAPI.getByOwner(user.id);
        const stores = resp?.data || [];
        const count = Array.isArray(stores) ? stores.length : 0;
        setStoreCount(count);
        
        // If user has no stores, they're likely a customer or delivery partner
        // Redirect to customer dashboard (delivery can be handled separately later)
        if (count === 0) {
          router.push('/customer');
          return;
        }
      } catch {
        setStoreCount(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [router, user]);

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-text-primary">Loading...</div>
      </div>
    );
  }

  // This page is only for resellers (users with stores)
  // Customers are redirected to /customer

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-text-primary">Reseller Dashboard</h1>
            <p className="text-text-secondary mt-1">Welcome, {displayName}</p>
          </div>
          <div className="flex gap-3">
            <Link href="/reseller/stores">
              <Button variant="secondary">My stores</Button>
            </Link>
            <Link href="/create-store">
              <Button variant="primary">Create store</Button>
            </Link>
          </div>
        </div>

        {/* Reseller Dashboard View */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-surface border-border">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-text-secondary">Stores</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-text-primary">
                  {loading ? '—' : storeCount ?? '—'}
                </div>
                <p className="text-xs text-text-muted">Total stores linked to your account</p>
              </CardContent>
            </Card>

            <Card className="bg-surface border-border">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-text-secondary">Role</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-text-primary">{user.role}</div>
                <p className="text-xs text-text-muted">Permissions: reseller panel</p>
              </CardContent>
            </Card>

            <Card className="bg-surface border-border">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-text-secondary">Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-text-secondary text-sm">
                  View comprehensive analytics and performance metrics.
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  <div className="flex gap-2 flex-wrap">
                    <Link href="/dashboard/sales-analytics">
                      <Button variant="primary" size="md">Sales Analytics</Button>
                    </Link>
                    <Link href="/dashboard/conversion-analytics">
                      <Button variant="primary" size="md">Conversion Analytics</Button>
                    </Link>
                    <Link href="/dashboard/aov-reports">
                      <Button variant="primary" size="md">AOV Reports</Button>
                    </Link>
                    <Link href="/dashboard/sku-heatmap">
                      <Button variant="primary" size="md">SKU Heatmap</Button>
                    </Link>
                    <Link href="/dashboard/dead-stock-alerts">
                      <Button variant="primary" size="md">Dead Stock Alerts</Button>
                    </Link>
                    <Link href="/dashboard/marketing-attribution">
                      <Button variant="primary" size="md">Marketing Attribution</Button>
                    </Link>
                    <Link href="/dashboard/tally-export">
                      <Button variant="primary" size="md">Tally Export</Button>
                    </Link>
                    <Link href="/dashboard/quickbooks-export">
                      <Button variant="primary" size="md">QuickBooks Export</Button>
                    </Link>
                    <Link href="/dashboard/xero-export">
                      <Button variant="primary" size="md">Xero Export</Button>
                    </Link>
                  </div>
                  <Link href="/reseller">
                    <Button variant="dark" size="md" className="w-full">Reseller Panel</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
      </div>
    </div>
  );
}

