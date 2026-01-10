'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from '@/lib/api';

type ThemeVariant = {
  layout?: {
    headerStyle?: 'centered' | 'left' | 'minimal';
    footerStyle?: 'simple' | 'extended';
    gridDensity?: 'comfortable' | 'compact';
  };
  components?: {
    buttonStyle?: 'rounded' | 'square' | 'pill';
    cardStyle?: 'flat' | 'elevated';
    inputStyle?: 'outline' | 'filled';
  };
  spacing?: {
    baseSpacing?: number;
  };
  animations?: {
    enabled?: boolean;
    intensity?: 'low' | 'medium' | 'high';
  };
};

interface ThemeContextValue extends ThemeVariant {
  loading: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const useThemeVariant = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeVariant must be used within ThemeProvider');
  return ctx;
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeVariant>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchTheme = async () => {
      try {
        const { data } = await api.get('/theme/active');
        if (cancelled) return;
        setTheme(data.data?.theme || {});
      } catch {
        // fall back to defaults
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchTheme();
    return () => {
      cancelled = true;
    };
  }, []);

  // Apply CSS variables
  useEffect(() => {
    const root = document.documentElement;
    const spacing = theme.spacing?.baseSpacing ?? 12;
    root.style.setProperty('--spacing-base', `${spacing}px`);

    const buttonStyle = theme.components?.buttonStyle || 'rounded';
    const radius =
      buttonStyle === 'pill' ? '9999px' : buttonStyle === 'square' ? '0px' : '8px';
    root.style.setProperty('--button-radius', radius);

    const cardStyle = theme.components?.cardStyle || 'flat';
    const cardShadow = cardStyle === 'elevated' ? '0 10px 25px rgba(0,0,0,0.08)' : 'none';
    root.style.setProperty('--card-shadow', cardShadow);

    const anim = theme.animations?.intensity || 'low';
    const animLevel = anim === 'high' ? '300ms' : anim === 'medium' ? '200ms' : '120ms';
    root.style.setProperty('--animation-level', animLevel);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ ...theme, loading }}>
      {children}
    </ThemeContext.Provider>
  );
}

