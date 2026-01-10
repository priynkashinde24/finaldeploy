'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { AffiliateSidebar } from '@/components/affiliate/AffiliateSidebar';
import { AffiliateHeader } from '@/components/affiliate/AffiliateHeader';

/**
 * Affiliate Shell Layout
 * 
 * Persistent layout that wraps all affiliate pages.
 * - Sidebar (left)
 * - Header (top)
 * - Main content area (children)
 * 
 * Role protection is handled by middleware.ts and client-side check
 */
export default function AffiliateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const user = getCurrentUser();

  useEffect(() => {
    if (!user) {
      router.replace('/login');
      return;
    }

    console.log('[AFFILIATE LAYOUT] User role check:', user.role);
    
    // Redirect non-affiliates to appropriate pages
    if (user.role !== 'affiliate') {
      console.log('[AFFILIATE LAYOUT] Non-affiliate detected, redirecting');
      if (user.role === 'admin') {
        router.replace('/admin');
      } else if (user.role === 'supplier') {
        router.replace('/supplier');
      } else if (user.role === 'reseller') {
        router.replace('/reseller');
      } else {
        router.replace('/unauthorized');
      }
      return;
    }
  }, [user, router]);

  // Don't render if user is not an affiliate (will redirect)
  if (!user || user.role !== 'affiliate') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-text-primary">Redirecting...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar - Fixed left */}
      <AffiliateSidebar />

      {/* Main Content Area - Offset for sidebar */}
      <div className="lg:ml-64">
        {/* Header - Fixed top */}
        <AffiliateHeader />

        {/* Page Content - Offset for header */}
        <main className="pt-16 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

