'use client';

import React, { ReactNode, useEffect } from 'react';
import { BrandingProvider } from '@/context/BrandingContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { initializeFunnelTracking } from '@/lib/funnelTracker';
import { initializeMarketingTracking } from '@/lib/marketingTracker';

export function AppProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Track PAGE_VIEW automatically on load + navigation (SPA)
    initializeFunnelTracking();

    // Track marketing touches (UTM + referrer) for attribution
    const storeId = typeof window !== 'undefined' ? window.localStorage.getItem('storeId') || undefined : undefined;
    initializeMarketingTracking(storeId);
  }, []);

  return (
    <ThemeProvider>
      <BrandingProvider>
        {children}
      </BrandingProvider>
    </ThemeProvider>
  );
}

