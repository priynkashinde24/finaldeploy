'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { ResellerSidebar } from '@/components/reseller/ResellerSidebar';
import { ResellerHeader } from '@/components/reseller/ResellerHeader';

/**
 * Reseller Shell Layout
 * 
 * Persistent layout that wraps all reseller pages.
 * - Sidebar (left)
 * - Header (top)
 * - Main content area (children)
 * 
 * Role protection is handled by middleware.ts and client-side check
 */
export default function ResellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const user = getCurrentUser();

  useEffect(() => {
    if (!user) return;

    console.log('[RESELLER LAYOUT] User role check:', user.role);
    
    // Redirect affiliates to their own dashboard - use hard redirect
    if (user.role === 'affiliate') {
      console.log('[RESELLER LAYOUT] Affiliate detected, redirecting to /affiliate');
      if (typeof window !== 'undefined') {
        window.location.href = '/affiliate';
      } else {
        router.replace('/affiliate');
      }
      return;
    }

    // Redirect non-resellers to appropriate pages - use hard redirect for admins
    if (user.role !== 'reseller') {
      console.log('[RESELLER LAYOUT] Non-reseller detected, redirecting');
      if (user.role === 'admin') {
        console.log('[RESELLER LAYOUT] Admin detected in reseller route, redirecting to /admin');
        if (typeof window !== 'undefined') {
          window.location.href = '/admin';
          return;
        } else {
          router.replace('/admin');
        }
      } else if (user.role === 'supplier') {
        router.replace('/supplier');
      } else if (user.role === 'affiliate') {
        console.log('[RESELLER LAYOUT] Affiliate detected in reseller route, redirecting to /affiliate');
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

  // Don't render if user is not a reseller (will redirect)
  if (!user || user.role !== 'reseller') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-text-primary">Redirecting...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar - Fixed left */}
      <ResellerSidebar />

      {/* Main Content Area - Offset for sidebar */}
      <div className="lg:ml-64">
        {/* Header - Fixed top */}
        <ResellerHeader />

        {/* Page Content - Offset for header */}
        <main className="pt-16 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

