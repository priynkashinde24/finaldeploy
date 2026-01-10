'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export default function SupplierDashboardPage() {
  const router = useRouter();
  const user = getCurrentUser();

  useEffect(() => {
    if (!user) {
      router.replace('/login?redirect=/supplier');
      return;
    }

    console.log('[SUPPLIER PAGE] User role check:', user.role);
    
    // Redirect non-suppliers to appropriate pages
    if (user.role !== 'supplier') {
      console.log('[SUPPLIER PAGE] Non-supplier detected, redirecting');
      if (user.role === 'admin') {
        console.log('[SUPPLIER PAGE] Admin detected, redirecting to /admin');
        if (typeof window !== 'undefined') {
          window.location.href = '/admin';
          return;
        } else {
          router.replace('/admin');
        }
      } else if (user.role === 'reseller') {
        router.replace('/reseller');
      } else if (user.role === 'affiliate') {
        router.replace('/affiliate');
      } else {
        router.replace('/unauthorized');
      }
      return;
    }
  }, [user, router]);

  // Don't render if user is not a supplier
  if (!user || user.role !== 'supplier') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-text-primary">Redirecting...</div>
      </div>
    );
  }
  // Placeholder stat cards (empty content slots)
  const statCards = [
    {
      title: 'Total Products',
      value: '—',
      description: 'Products in catalog',
    },
    {
      title: 'Total Orders',
      value: '—',
      description: 'All time orders',
    },
    {
      title: 'Pending Orders',
      value: '—',
      description: 'Orders awaiting fulfillment',
    },
    {
      title: 'Available Balance',
      value: '—',
      description: 'Ready for payout',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Supplier Dashboard</h1>
        <p className="text-text-secondary">Welcome to Supplier Panel</p>
      </div>

      {/* Empty Stat Cards (Placeholders) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, index) => (
          <Card key={index} className="bg-surface border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-text-secondary">
                {card.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white mb-1">{card.value}</div>
              <p className="text-xs text-text-muted">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

