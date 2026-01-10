'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { SupplierSidebar } from '@/components/supplier/SupplierSidebar';
import { SupplierHeader } from '@/components/supplier/SupplierHeader';

/**
 * Supplier Shell Layout
 * 
 * Persistent layout that wraps all supplier pages.
 * - Sidebar (left)
 * - Header (top)
 * - Main content area (children)
 * 
 * Role protection is handled by middleware.ts and client-side check
 */
export default function SupplierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const user = getCurrentUser();

  useEffect(() => {
    if (!user) {
      router.replace('/login?redirect=/supplier');
      return;
    }

    console.log('[SUPPLIER LAYOUT] User role check:', user.role);
    
    // Redirect non-suppliers to appropriate pages - use hard redirect for admins
    if (user.role !== 'supplier') {
      console.log('[SUPPLIER LAYOUT] Non-supplier detected, redirecting');
      if (user.role === 'admin') {
        console.log('[SUPPLIER LAYOUT] Admin detected in supplier route, redirecting to /admin');
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

  // Don't render if user is not a supplier (will redirect)
  if (!user || user.role !== 'supplier') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-text-primary">Redirecting...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar - Fixed left */}
      <SupplierSidebar />

      {/* Main Content Area - Offset for sidebar */}
      <div className="lg:ml-64">
        {/* Header - Fixed top */}
        <SupplierHeader />

        {/* Page Content - Offset for header */}
        <main className="pt-16 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

