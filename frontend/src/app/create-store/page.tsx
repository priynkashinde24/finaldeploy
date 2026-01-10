'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Navbar } from '@/components/layout';
import { ModernButton } from '@/components/ui/ModernButton';
import { Footer } from '@/components/marketing';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { FadeIn, SlideUp } from '@/components/animations';

interface Theme {
  themeId: string;
  name: string;
  previewImage?: string;
  defaultColors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
  };
  defaultFonts: {
    heading: string;
    body: string;
  };
}

export default function CreateStorePage() {
  const router = useRouter();
  const [storeName, setStoreName] = useState('');
  const [selectedThemeId, setSelectedThemeId] = useState<string>('');
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdStoreId, setCreatedStoreId] = useState<string | null>(null);

  // Fetch themes on mount
  useEffect(() => {
    const fetchThemes = async () => {
      try {
        setLoading(true);
        const response = await api.get('/stores/themes');
        if (response.data.success && response.data.data) {
          setThemes(response.data.data);
          // Set first theme as default
          if (response.data.data.length > 0) {
            setSelectedThemeId(response.data.data[0].themeId);
          }
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load themes');
      } finally {
        setLoading(false);
      }
    };

    fetchThemes();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!storeName.trim()) {
      setError('Store name is required');
      return;
    }

    if (storeName.trim().length < 2) {
      setError('Store name must be at least 2 characters');
      return;
    }

    if (storeName.trim().length > 100) {
      setError('Store name must not exceed 100 characters');
      return;
    }

    if (!selectedThemeId) {
      setError('Please select a theme');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // One-click store creation expects { storeName, subdomain }
      const base = storeName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\\s-]/g, '')
        .replace(/[\\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40);
      const ts = Date.now().toString(36);
      const suffix = Math.random().toString(36).slice(2, 8);
      const subdomain = `${base || 'store'}-${ts}-${suffix}`.slice(0, 63);

      const response = await api.post('/stores/create', {
        storeName: storeName.trim(),
        subdomain,
        // planId / templateId are optional; backend picks a default template
      });

      if (response.data.success && response.data.data?.store) {
        const storeId = response.data.data.store._id || response.data.data.store.id;
        setCreatedStoreId(storeId);
        setShowSuccess(true);

        // Redirect to store dashboard after animation
        setTimeout(() => {
          router.push(`/dashboard/store/${storeId}`);
        }, 2000);
      } else {
        setError(response.data.message || 'Failed to create store');
        setIsSubmitting(false);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'An error occurred while creating the store');
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-surface via-surface2 to-surface">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted">Loading themes...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-surface via-surface2 to-surface">
      <Navbar />
      <main className="flex-1 py-12 sm:py-16 lg:py-20 relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/4 h-96 w-96 rounded-full bg-primary opacity-10 blur-3xl animate-pulse" />
          <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-accent opacity-10 blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 relative z-10">
          <AnimatePresence mode="wait">
            {!showSuccess ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
              >
                {/* Header */}
                <FadeIn delay={0.1}>
                  <div className="mb-8 text-center">
                    <h1 className="text-4xl sm:text-5xl font-extrabold text-text mb-4 bg-gradient-to-r from-primary via-gold to-accent bg-clip-text text-transparent">
                      Create Your Store
                    </h1>
                    <p className="text-lg text-muted">
                      One click to launch your online store
                    </p>
                  </div>
                </FadeIn>

                {/* Form Card */}
                <SlideUp delay={0.2}>
                  <div className="bg-surface2/80 backdrop-blur-xl border border-neutral-700/50 rounded-2xl p-6 sm:p-8 shadow-2xl">
                    <form onSubmit={handleSubmit} className="space-y-8">
                      {/* Store Name Input */}
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                      >
                        <label htmlFor="storeName" className="block text-sm font-medium text-text mb-2">
                          Store Name <span className="text-primary">*</span>
                        </label>
                        <input
                          type="text"
                          id="storeName"
                          value={storeName}
                          onChange={(e) => {
                            setStoreName(e.target.value);
                            setError(null);
                          }}
                          className={cn(
                            'w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all',
                            'bg-surface text-text placeholder-muted',
                            'border-neutral-700',
                            error && 'border-error ring-error'
                          )}
                          placeholder="My Awesome Store"
                          maxLength={100}
                          disabled={isSubmitting}
                        />
                        <p className="mt-1 text-xs text-muted">
                          {storeName.length}/100 characters
                        </p>
                      </motion.div>

                      {/* Theme Selection */}
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 }}
                      >
                        <label className="block text-sm font-medium text-text mb-4">
                          Select Theme <span className="text-primary">*</span>
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {themes.map((theme) => (
                            <motion.button
                              key={theme.themeId}
                              type="button"
                              onClick={() => {
                                setSelectedThemeId(theme.themeId);
                                setError(null);
                              }}
                              disabled={isSubmitting}
                              className={cn(
                                'relative p-4 rounded-xl border-2 transition-all text-left',
                                'bg-surface hover:bg-surface2',
                                'border-neutral-700 hover:border-neutral-600',
                                selectedThemeId === theme.themeId
                                  ? 'border-gold ring-2 ring-gold ring-opacity-50 shadow-lg shadow-gold/20'
                                  : '',
                                isSubmitting && 'opacity-50 cursor-not-allowed'
                              )}
                              whileHover={!isSubmitting ? { scale: 1.02, y: -2 } : {}}
                              whileTap={!isSubmitting ? { scale: 0.98 } : {}}
                            >
                              {/* Theme Preview */}
                              <div className="mb-3 h-24 rounded-lg overflow-hidden relative" style={{ backgroundColor: theme.defaultColors.background }}>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="flex gap-2">
                                    <div
                                      className="w-8 h-8 rounded-full"
                                      style={{ backgroundColor: theme.defaultColors.primary }}
                                    />
                                    <div
                                      className="w-8 h-8 rounded-full"
                                      style={{ backgroundColor: theme.defaultColors.secondary }}
                                    />
                                    <div
                                      className="w-8 h-8 rounded-full"
                                      style={{ backgroundColor: theme.defaultColors.accent }}
                                    />
                                  </div>
                                </div>
                              </div>
                              
                              {/* Theme Name */}
                              <h3 className="font-semibold text-text mb-1">{theme.name}</h3>
                              
                              {/* Selected Indicator */}
                              {selectedThemeId === theme.themeId && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-gold flex items-center justify-center"
                                >
                                  <svg
                                    className="w-4 h-4 text-surface"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M5 13l4 4L19 7"
                                    />
                                  </svg>
                                </motion.div>
                              )}
                            </motion.button>
                          ))}
                        </div>
                      </motion.div>

                      {/* Error Message */}
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="p-4 rounded-xl bg-error/10 border border-error"
                        >
                          <p className="text-sm text-error">{error}</p>
                        </motion.div>
                      )}

                      {/* Submit Button */}
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="flex gap-4 pt-4"
                      >
                        <ModernButton
                          type="submit"
                          variant="primary"
                          size="lg"
                          glow
                          className="flex-1 sm:flex-none px-8"
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? (
                            <span className="flex items-center gap-2">
                              <motion.span
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                              />
                              Creating...
                            </span>
                          ) : (
                            'Create Store'
                          )}
                        </ModernButton>
                        <ModernButton
                          type="button"
                          variant="outline"
                          size="lg"
                          onClick={() => router.back()}
                          disabled={isSubmitting}
                        >
                          Cancel
                        </ModernButton>
                      </motion.div>
                    </form>
                  </div>
                </SlideUp>
              </motion.div>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="text-center"
              >
                <div className="bg-surface2/80 backdrop-blur-xl border border-gold/50 rounded-2xl p-12 shadow-2xl">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                    className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary to-gold flex items-center justify-center"
                  >
                    <motion.svg
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.5, delay: 0.2 }}
                      className="w-10 h-10 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <motion.path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </motion.svg>
                  </motion.div>
                  <h2 className="text-3xl font-bold text-text mb-4">Store Created Successfully!</h2>
                  <p className="text-muted mb-6">Redirecting to your store dashboard...</p>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 2 }}
                    className="h-1 bg-gradient-to-r from-primary via-gold to-accent rounded-full"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
      <Footer />
    </div>
  );
}

