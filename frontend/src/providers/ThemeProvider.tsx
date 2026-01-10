'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Theme } from '@/types/theme';

interface ThemeContextType {
  theme: Theme | null;
  setTheme: (theme: Theme) => void;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  theme: Theme | null;
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ theme, children }) => {
  const [currentTheme, setCurrentTheme] = useState<Theme | null>(theme);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (theme) {
      setCurrentTheme(theme);
      applyTheme(theme);
    }
  }, [theme]);

  const applyTheme = (themeToApply: Theme) => {
    const root = document.documentElement;
    
    // Apply color variables
    root.style.setProperty('--theme-primary', themeToApply.colors.primary);
    root.style.setProperty('--theme-secondary', themeToApply.colors.secondary);
    root.style.setProperty('--theme-accent', themeToApply.colors.accent);
    root.style.setProperty('--theme-background', themeToApply.colors.background);
    root.style.setProperty('--theme-surface', themeToApply.colors.surface);
    root.style.setProperty('--theme-text', themeToApply.colors.text);
    root.style.setProperty('--theme-text-secondary', themeToApply.colors.textSecondary);
    root.style.setProperty('--theme-border', themeToApply.colors.border);

    // Apply typography variables
    root.style.setProperty('--theme-heading-font', themeToApply.typography.headingFont);
    root.style.setProperty('--theme-body-font', themeToApply.typography.bodyFont);
    root.style.setProperty('--theme-heading-weight', themeToApply.typography.headingWeight);
    root.style.setProperty('--theme-body-weight', themeToApply.typography.bodyWeight);

    // Apply border radius variables
    root.style.setProperty('--theme-radius-sm', themeToApply.borderRadius.sm);
    root.style.setProperty('--theme-radius-md', themeToApply.borderRadius.md);
    root.style.setProperty('--theme-radius-lg', themeToApply.borderRadius.lg);
    root.style.setProperty('--theme-radius-xl', themeToApply.borderRadius.xl);

    // Apply spacing scale
    root.style.setProperty('--theme-spacing-scale', themeToApply.spacing.scale.toString());
  };

  const handleSetTheme = (newTheme: Theme) => {
    setIsLoading(true);
    setCurrentTheme(newTheme);
    applyTheme(newTheme);
    // Small delay to show loading state
    setTimeout(() => setIsLoading(false), 100);
  };

  return (
    <ThemeContext.Provider value={{ theme: currentTheme, setTheme: handleSetTheme, isLoading }}>
      <div
        style={{
          backgroundColor: currentTheme?.colors.background || '#FFFFFF',
          color: currentTheme?.colors.text || '#111827',
          fontFamily: currentTheme?.typography.bodyFont || 'system-ui',
          transition: 'background-color 0.3s ease, color 0.3s ease',
        }}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
};

