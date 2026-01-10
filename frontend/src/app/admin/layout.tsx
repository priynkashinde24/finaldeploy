'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminHeader } from '@/components/admin/AdminHeader';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    // Verify user is admin
    const user = getCurrentUser();
    
    if (!user) {
      console.log('[ADMIN LAYOUT] No user found, redirecting to login');
      router.replace('/login?redirect=/admin');
      return;
    }

    console.log('[ADMIN LAYOUT] User role check:', user.role);
    
    if (user.role !== 'admin') {
      console.log('[ADMIN LAYOUT] Non-admin detected, redirecting');
      // Redirect non-admins to their appropriate dashboards
      if (user.role === 'supplier') {
        router.replace('/supplier');
      } else if (user.role === 'reseller') {
        router.replace('/reseller');
      } else if (user.role === 'affiliate') {
        router.replace('/affiliate');
      } else {
        router.replace('/unauthorized');
      }
      return;
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <AdminSidebar />

      {/* Main Content Area */}
      <div className="lg:ml-64">
        {/* Header */}
        <AdminHeader />

        {/* Page Content */}
        <main className="pt-16 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

