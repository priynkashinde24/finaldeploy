'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function DeliveryDashboardPage() {
  const router = useRouter();
  const user = getCurrentUser();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    // Redirect non-delivery users to their dashboards
    if (user.role === 'admin') {
      router.push('/admin');
      return;
    }
    if (user.role === 'supplier') {
      router.push('/supplier');
      return;
    }

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

  const displayName = user?.name || user?.email || 'Delivery Partner';

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Delivery Dashboard</h1>
          <p className="text-text-secondary mt-1">Welcome, {displayName}</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-surface border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-text-secondary">Pending Deliveries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white mb-1">—</div>
              <p className="text-xs text-text-muted">Awaiting pickup</p>
            </CardContent>
          </Card>

          <Card className="bg-surface border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-text-secondary">In Transit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-400 mb-1">—</div>
              <p className="text-xs text-text-muted">Currently delivering</p>
            </CardContent>
          </Card>

          <Card className="bg-surface border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-text-secondary">Completed Today</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-400 mb-1">—</div>
              <p className="text-xs text-text-muted">Delivered today</p>
            </CardContent>
          </Card>

          <Card className="bg-surface border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-text-secondary">Total Earnings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gold mb-1">₹—</div>
              <p className="text-xs text-text-muted">This month</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-surface border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-text-secondary">Available Deliveries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-text-secondary text-sm mb-3">
                View and accept new delivery assignments
              </div>
              <Button variant="dark" size="md" disabled>
                View Deliveries (Coming Soon)
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-surface border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-text-secondary">My Deliveries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-text-secondary text-sm mb-3">
                Track your active and completed deliveries
              </div>
              <Button variant="dark" size="md" disabled>
                View My Deliveries (Coming Soon)
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Recent Deliveries */}
        <Card className="bg-surface border-border">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-white">Recent Deliveries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-text-secondary">
              No deliveries yet. Start accepting delivery assignments to see them here!
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

