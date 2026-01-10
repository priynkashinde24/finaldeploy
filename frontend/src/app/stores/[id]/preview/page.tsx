'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent, StatusBadge } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Footer } from '@/components/marketing';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { storeAPI } from '@/lib/api';
import { loadTheme } from '@/lib/themeLoader';
import { Theme } from '@/types/theme';
import Image from 'next/image';

interface Store {
  _id?: string;
  id?: string;
  name: string;
  description: string;
  logoUrl: string;
  themeId: string;
  customDomain?: string | null;
  domainStatus?: 'verified' | 'pending' | 'unverified';
  dnsVerificationToken?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export default function StorePreviewPage() {
  const params = useParams();
  const router = useRouter();
  const storeId = params.id as string;
  const [store, setStore] = useState<Store | null>(null);
  const [theme, setTheme] = useState<Theme | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previousThemeId, setPreviousThemeId] = useState<string | null>(null);

  useEffect(() => {
    const fetchStore = async () => {
      try {
        setLoading(true);
        const response = await storeAPI.getById(storeId);
        
        if (response.success && response.data) {
          const storeData = response.data;
          setStore(storeData);
          
          // Load theme
          const themeId = storeData.themeId || 'default';
          const loadedTheme = await loadTheme(themeId);
          if (loadedTheme) {
            setTheme(loadedTheme);
            // Store previous theme for rollback (in a real app, this would come from history)
            setPreviousThemeId(themeId);
          }
        } else {
          setError(response.message || 'Store not found');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load store');
      } finally {
        setLoading(false);
      }
    };

    if (storeId) {
      fetchStore();
    }
  }, [storeId]);

  const handleRollbackTheme = () => {
    // Placeholder function - in production, this would restore previous theme
    alert('Rollback functionality will be implemented with theme history tracking');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-secondary-off-white dark:bg-dark-background">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-deep-red mx-auto mb-4"></div>
            <p className="text-neutral-600 dark:text-dark-text-secondary">Loading store...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="min-h-screen flex flex-col bg-secondary-off-white dark:bg-dark-background">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <Card variant="elevated" className="max-w-md">
            <CardContent className="text-center py-8">
              <p className="text-error mb-4">{error || 'Store not found'}</p>
              <Button variant="primary" onClick={() => router.push('/stores/create')}>
                Create New Store
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const PreviewContent = () => (
    <>
      <Navbar />
      <main className="flex-1 py-12 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8 text-center">
            <SectionTitle size="xl" variant="default" className="mb-4">
              Store Preview
            </SectionTitle>
            <p className="text-lg text-neutral-600 dark:text-dark-text-secondary">
              Your store has been created successfully!
            </p>
          </div>

          {/* Store Preview Card */}
          <Card variant="elevated" className="mb-8">
            <CardContent className="p-8">
              <div className="flex flex-col items-center text-center space-y-6">
                {/* Logo */}
                <div className="relative w-32 h-32 rounded-full overflow-hidden bg-white dark:bg-dark-surface border-4 border-primary-muted-gold">
                  {store.logoUrl ? (
                    <img
                      src={store.logoUrl}
                      alt={`${store.name} logo`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/placeholder-logo.png';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-secondary-gray dark:bg-dark-border">
                      <span className="text-4xl font-bold text-primary-deep-red">
                        {store.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Store Name */}
                <div>
                  <h2 className="text-3xl font-bold text-neutral-900 dark:text-dark-text mb-2">
                    {store.name}
                  </h2>
                  <p className="text-neutral-600 dark:text-dark-text-secondary max-w-2xl">
                    {store.description}
                  </p>
                </div>

                {/* Store Details */}
                <div className="w-full max-w-md space-y-4 pt-6 border-t border-secondary-gray dark:border-dark-border">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-neutral-600 dark:text-dark-text-secondary">
                      Store ID:
                    </span>
                    <span className="text-sm text-neutral-900 dark:text-dark-text font-mono">
                      {store._id || store.id}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-neutral-600 dark:text-dark-text-secondary">
                      Active Theme:
                    </span>
                    <span className="text-sm text-neutral-900 dark:text-dark-text capitalize">
                      {store.themeId.replace('-', ' ')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-neutral-600 dark:text-dark-text-secondary">
                      Custom Domain:
                    </span>
                    <div className="flex items-center gap-2">
                      {store.customDomain ? (
                        <>
                          <span className="text-sm text-primary-deep-red">{store.customDomain}</span>
                          {store.domainStatus && (
                            <StatusBadge status={store.domainStatus} />
                          )}
                        </>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/stores/${storeId}/domain`)}
                        >
                          Setup Domain
                        </Button>
                      )}
                    </div>
                  </div>
                  {store.customDomain && (
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/stores/${storeId}/domain`)}
                        className="text-primary-deep-red"
                      >
                        Manage Domain →
                      </Button>
                    </div>
                  )}
                  {store.createdAt && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-neutral-600 dark:text-dark-text-secondary">
                        Created:
                      </span>
                      <span className="text-sm text-neutral-900 dark:text-dark-text">
                        {new Date(store.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Theme Preview Components */}
          <Card variant="elevated" className="mt-8">
            <CardHeader>
              <CardTitle>Theme Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Example Heading */}
                <div>
                  <h3
                    style={{
                      fontFamily: theme?.typography.headingFont,
                      fontWeight: theme?.typography.headingWeight,
                      color: theme?.colors.text,
                    }}
                    className="text-2xl mb-2"
                  >
                    Example Heading
                  </h3>
                  <p
                    style={{
                      fontFamily: theme?.typography.bodyFont,
                      fontWeight: theme?.typography.bodyWeight,
                      color: theme?.colors.textSecondary,
                    }}
                  >
                    This is example body text showing how your theme typography looks.
                  </p>
                </div>

                {/* Example Buttons */}
                <div className="flex flex-wrap gap-4">
                  <button
                    style={{
                      backgroundColor: theme?.colors.primary,
                      color: '#FFFFFF',
                      borderRadius: theme?.borderRadius.md,
                      padding: '0.5rem 1.5rem',
                    }}
                    className="font-medium"
                  >
                    Primary Button
                  </button>
                  <button
                    style={{
                      backgroundColor: theme?.colors.secondary,
                      color: '#FFFFFF',
                      borderRadius: theme?.borderRadius.md,
                      padding: '0.5rem 1.5rem',
                    }}
                    className="font-medium"
                  >
                    Secondary Button
                  </button>
                  <button
                    style={{
                      backgroundColor: theme?.colors.accent,
                      color: '#FFFFFF',
                      borderRadius: theme?.borderRadius.md,
                      padding: '0.5rem 1.5rem',
                    }}
                    className="font-medium"
                  >
                    Accent Button
                  </button>
                </div>

                {/* Example Card */}
                <div
                  style={{
                    backgroundColor: theme?.colors.surface,
                    borderColor: theme?.colors.border,
                    borderRadius: theme?.borderRadius.lg,
                    borderWidth: '1px',
                    padding: '1.5rem',
                  }}
                >
                  <h4
                    style={{
                      fontFamily: theme?.typography.headingFont,
                      fontWeight: theme?.typography.headingWeight,
                      color: theme?.colors.text,
                    }}
                    className="text-lg mb-2"
                  >
                    Example Card
                  </h4>
                  <p
                    style={{
                      fontFamily: theme?.typography.bodyFont,
                      color: theme?.colors.textSecondary,
                    }}
                  >
                    This card demonstrates the surface and border colors from your selected theme.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
            <Button
              variant="primary"
              size="lg"
              onClick={() => router.push(`/stores/${storeId}/theme`)}
              className="px-8"
            >
              Change Theme
            </Button>
            {previousThemeId && previousThemeId !== store?.themeId && (
              <Button
                variant="outline"
                size="lg"
                onClick={handleRollbackTheme}
                className="px-8"
              >
                Rollback to Previous Theme
              </Button>
            )}
            <Button
              variant="ghost"
              size="lg"
              onClick={() => router.push('/stores/create')}
              className="px-8"
            >
              Create Another Store
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );

  // Wrap content in ThemeProvider if theme is loaded
  if (theme) {
    return (
      <ThemeProvider theme={theme}>
        <div className="min-h-screen flex flex-col">
          <PreviewContent />
        </div>
      </ThemeProvider>
    );
  }

  // Fallback without theme
  return (
    <div className="min-h-screen flex flex-col bg-secondary-off-white dark:bg-dark-background">
      <PreviewContent />
    </div>
  );
}

