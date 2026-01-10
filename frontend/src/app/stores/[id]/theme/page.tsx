'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout';
import { Button, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Footer } from '@/components/marketing';
import { storeAPI } from '@/lib/api';
import { getAllThemes, loadTheme } from '@/lib/themeLoader';
import { Theme } from '@/types/theme';
import { cn } from '@/lib/utils';

export default function ThemeSelectionPage() {
  const params = useParams();
  const router = useRouter();
  const storeId = params.id as string;
  const [themes, setThemes] = useState<Theme[]>([]);
  const [currentThemeId, setCurrentThemeId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [applyingTheme, setApplyingTheme] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Get current store to find active theme
        const storeResponse = await storeAPI.getById(storeId);
        if (storeResponse.success && storeResponse.data) {
          setCurrentThemeId(storeResponse.data.themeId || 'default');
        }

        // Load all themes
        const allThemes = await getAllThemes();
        setThemes(allThemes);
      } catch (err: any) {
        setError(err.message || 'Failed to load themes');
      } finally {
        setLoading(false);
      }
    };

    if (storeId) {
      fetchData();
    }
  }, [storeId]);

  const handleApplyTheme = async (themeId: string) => {
    try {
      setApplyingTheme(themeId);
      setError(null);

      const response = await storeAPI.updateTheme(storeId, themeId);

      if (response.success) {
        setCurrentThemeId(themeId);
        // Optionally redirect to preview
        // router.push(`/stores/${storeId}/preview`);
      } else {
        setError(response.message || 'Failed to apply theme');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to apply theme');
    } finally {
      setApplyingTheme(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-secondary-off-white dark:bg-dark-background">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-deep-red mx-auto mb-4"></div>
            <p className="text-neutral-600 dark:text-dark-text-secondary">Loading themes...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-secondary-off-white dark:bg-dark-background">
      <Navbar />
      <main className="flex-1 py-12 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8 text-center">
            <SectionTitle size="xl" variant="default" className="mb-4">
              Choose Your Theme
            </SectionTitle>
            <p className="text-lg text-neutral-600 dark:text-dark-text-secondary">
              Select a theme to customize your store's appearance
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 rounded-lg bg-error/10 border border-error">
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          {/* Themes Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {themes.map((theme) => {
              const isActive = theme.id === currentThemeId;
              const isApplying = applyingTheme === theme.id;

              return (
                <Card
                  key={theme.id}
                  variant={isActive ? 'elevated' : 'default'}
                  className={cn(
                    'relative transition-all hover:shadow-lg',
                    isActive && 'ring-2 ring-primary-deep-red'
                  )}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between mb-2">
                      <CardTitle className="text-xl">{theme.name}</CardTitle>
                      {isActive && (
                        <span className="px-2 py-1 text-xs font-semibold rounded bg-primary-deep-red text-white">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-neutral-600 dark:text-dark-text-secondary">
                      {theme.description}
                    </p>
                  </CardHeader>
                  <CardContent>
                    {/* Color Preview */}
                    <div className="mb-4 space-y-2">
                      <div className="flex gap-2">
                        <div
                          className="flex-1 h-12 rounded"
                          style={{ backgroundColor: theme.colors.primary }}
                          title="Primary"
                        />
                        <div
                          className="flex-1 h-12 rounded"
                          style={{ backgroundColor: theme.colors.secondary }}
                          title="Secondary"
                        />
                        <div
                          className="flex-1 h-12 rounded"
                          style={{ backgroundColor: theme.colors.accent }}
                          title="Accent"
                        />
                      </div>
                      <div className="flex gap-2">
                        <div
                          className="flex-1 h-8 rounded"
                          style={{ backgroundColor: theme.colors.background }}
                          title="Background"
                        />
                        <div
                          className="flex-1 h-8 rounded border"
                          style={{ backgroundColor: theme.colors.surface }}
                          title="Surface"
                        />
                      </div>
                    </div>

                    {/* Apply Button */}
                    <Button
                      variant={isActive ? 'outline' : 'primary'}
                      size="sm"
                      className="w-full"
                      onClick={() => handleApplyTheme(theme.id)}
                      disabled={isActive || isApplying || !!applyingTheme}
                    >
                      {isApplying
                        ? 'Applying...'
                        : isActive
                        ? 'Current Theme'
                        : 'Apply Theme'}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              variant="outline"
              size="lg"
              onClick={() => router.push(`/stores/${storeId}/preview`)}
              className="px-8"
            >
              Preview Store
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => router.back()}
              className="px-8"
            >
              Back
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

