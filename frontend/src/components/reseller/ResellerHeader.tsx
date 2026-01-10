'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, logout } from '@/lib/auth';
import { Button } from '@/components/ui/Button';

export const ResellerHeader: React.FC = () => {
  const router = useRouter();
  const user = getCurrentUser();

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('[RESELLER HEADER] Logout error:', error);
      // Force redirect even if logout fails
      router.push('/login');
    }
  };

  return (
    <header className="fixed top-0 right-0 left-0 lg:left-64 h-16 bg-surface border-b border-border z-30 flex items-center justify-between px-4 lg:px-6">
      {/* Left side - Panel title */}
      <div className="flex-1">
        <h2 className="text-lg font-semibold text-white">Reseller Panel</h2>
      </div>

      {/* Right side - Logged-in reseller email and logout */}
      <div className="flex items-center space-x-4">
        {user && (
          <div className="text-right hidden sm:block">
            <p className="text-sm text-text-secondary">{user.email}</p>
          </div>
        )}
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          className="border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Logout
        </Button>
      </div>
    </header>
  );
};

