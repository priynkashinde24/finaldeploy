'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function CustomerDashboardPage() {
  const router = useRouter();
  const user = getCurrentUser();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    // Redirect non-customers to their dashboards
    if (user.role === 'admin') {
      router.push('/admin');
      return;
    }
    if (user.role === 'supplier') {
      router.push('/supplier');
      return;
    }

    // Check if user has stores (if yes, they're a reseller, not a customer)
    // This will be checked in the dashboard page
    setLoading(false);
  }, [user, router]);

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  const displayName = user?.name || user?.email || 'Customer';

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-text-primary">Customer Dashboard</h1>
            <p className="text-text-secondary mt-1">Welcome, {displayName}</p>
          </div>
          <Link href="/storefront">
            <Button variant="primary">Browse Stores</Button>
          </Link>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="bg-surface border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-text-secondary">My Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-text-secondary text-sm mb-3">
                View and track your orders
              </div>
              <Link href="/orders">
                <Button variant="dark" size="md">View Orders</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="bg-surface border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-text-secondary">Browse Stores</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-text-secondary text-sm mb-3">
                Discover and shop from stores
              </div>
              <Link href="/storefront">
                <Button variant="dark" size="md">Browse Stores</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="bg-surface border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-text-secondary">Account Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-text-secondary text-sm mb-3">
                Manage your account settings
              </div>
              <Link href="/customer/settings">
                <Button variant="dark" size="md">Settings</Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="bg-surface border-border">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-white">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-text-secondary">
              No recent activity. Start shopping to see your orders here!
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

