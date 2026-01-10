'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from '@/lib/api';

type Branding = {
  logo?: { light?: string; dark?: string; favicon?: string };
  colors?: { primary?: string; secondary?: string; accent?: string; background?: string; text?: string };
  fonts?: { primaryFont?: string; secondaryFont?: string; source?: 'google' | 'custom' };
};

interface BrandingContextValue extends Branding {
  loading: boolean;
}

const BrandingContext = createContext<BrandingContextValue | undefined>(undefined);

export const useBranding = () => {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error('useBranding must be used within BrandingProvider');
  return ctx;
};

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<Branding>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchBranding = async () => {
      try {
        const { data } = await api.get('/branding/active');
        if (cancelled) return;
        setBranding(data.data?.branding || {});
      } catch {
        // ignore, fall back to defaults
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchBranding();
    return () => {
      cancelled = true;
    };
  }, []);

  // Apply CSS variables
  useEffect(() => {
    const root = document.documentElement;
    const colors = branding.colors || {};
    if (colors.primary) root.style.setProperty('--color-primary', colors.primary);
    if (colors.secondary) root.style.setProperty('--color-secondary', colors.secondary);
    if (colors.accent) root.style.setProperty('--color-accent', colors.accent);
    if (colors.background) root.style.setProperty('--color-background', colors.background);
    if (colors.text) root.style.setProperty('--color-text', colors.text);
    const fonts = branding.fonts || {};
    if (fonts.primaryFont) root.style.setProperty('--font-primary', fonts.primaryFont);
    if (fonts.secondaryFont) root.style.setProperty('--font-secondary', fonts.secondaryFont);
  }, [branding]);

  return (
    <BrandingContext.Provider
      value={{
        ...branding,
        loading,
      }}
    >
      {children}
    </BrandingContext.Provider>
  );
}

