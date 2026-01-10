'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export default function ResellerDashboardPage() {
  const router = useRouter();
  const user = getCurrentUser();

  useEffect(() => {
    if (!user) return;

    console.log('[RESELLER PAGE] User role check:', user.role);
    
    // Redirect affiliates to their own dashboard - use hard redirect
    if (user.role === 'affiliate') {
      console.log('[RESELLER PAGE] Affiliate detected, redirecting to /affiliate');
      if (typeof window !== 'undefined') {
        window.location.href = '/affiliate';
      } else {
        router.replace('/affiliate');
      }
      return;
    }

    // Redirect non-resellers - use hard redirect for admins
    if (user.role !== 'reseller') {
      console.log('[RESELLER PAGE] Non-reseller detected, redirecting');
      if (user.role === 'admin') {
        console.log('[RESELLER PAGE] Admin detected in reseller route, redirecting to /admin');
        if (typeof window !== 'undefined') {
          window.location.href = '/admin';
          return;
        } else {
          router.replace('/admin');
        }
      } else if (user.role === 'supplier') {
        router.replace('/supplier');
      } else if (user.role === 'affiliate') {
        console.log('[RESELLER PAGE] Affiliate detected in reseller route, redirecting to /affiliate');
        if (typeof window !== 'undefined') {
          window.location.href = '/affiliate';
          return;
        } else {
          router.replace('/affiliate');
        }
      } else {
        router.replace('/unauthorized');
      }
      return;
    }
  }, [user, router]);

  // Don't render if user is not a reseller
  if (!user || (user.role !== 'reseller' && user.role !== 'affiliate')) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-text-primary">Redirecting...</div>
      </div>
    );
  }
  // Placeholder stat cards (empty content slots)
  const statCards = [
    {
      title: 'Total Stores',
      value: '—',
      description: 'Active stores',
    },
    {
      title: 'Total Products',
      value: '—',
      description: 'Products in stores',
    },
    {
      title: 'Total Orders',
      value: '—',
      description: 'All time orders',
    },
    {
      title: 'Total Earnings',
      value: '—',
      description: 'All time revenue',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Reseller Dashboard</h1>
        <p className="text-text-secondary">Welcome to Reseller Panel</p>
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

