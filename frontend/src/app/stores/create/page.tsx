'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Navbar } from '@/components/layout';
import { ModernButton } from '@/components/ui/ModernButton';
import { Footer } from '@/components/marketing';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { FadeIn, SlideUp } from '@/components/animations';

export default function CreateStorePage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    logoUrl: '',
    themeId: 'default-theme',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Store name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Store name must be at least 2 characters';
    } else if (formData.name.trim().length > 100) {
      newErrors.name = 'Store name must not exceed 100 characters';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Store description is required';
    } else if (formData.description.trim().length < 10) {
      newErrors.description = 'Store description must be at least 10 characters';
    } else if (formData.description.trim().length > 500) {
      newErrors.description = 'Store description must not exceed 500 characters';
    }

    if (!formData.logoUrl.trim()) {
      newErrors.logoUrl = 'Logo URL is required';
    } else {
      try {
        new URL(formData.logoUrl);
      } catch {
        newErrors.logoUrl = 'Please enter a valid URL';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Use the one-click store creation endpoint (server derives owner from auth)
      // Backend expects { storeName, subdomain }
      const base = formData.name
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
        storeName: formData.name.trim(),
        subdomain,
      });
      const data = response.data;

      if (data.success && data.data?.store) {
        const id = data.data.store._id || data.data.store.id;
        setStoreId(id);
        setShowSuccess(true);

        // Redirect after animation
        setTimeout(() => {
          router.push(`/stores/${id}/preview`);
        }, 2000);
      } else {
        setErrors({ submit: data.message || 'Failed to create store' });
        setIsSubmitting(false);
      }
    } catch (error: any) {
      setErrors({ submit: error.response?.data?.message || error.message || 'An error occurred while creating the store' });
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-surface via-surface2 to-surface">
      <Navbar />
      <main className="flex-1 py-12 sm:py-16 lg:py-20 relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/4 h-96 w-96 rounded-full bg-primary opacity-10 blur-3xl animate-pulse" />
          <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-accent opacity-10 blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 relative z-10">
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
                      Get started by setting up your online store
                    </p>
                  </div>
                </FadeIn>

                {/* Form Card */}
                <SlideUp delay={0.2}>
                  <div className="bg-surface2/80 backdrop-blur-xl border border-neutral-700/50 rounded-2xl p-6 sm:p-8 shadow-2xl">
                    <form onSubmit={handleSubmit} className="space-y-6">
                      {/* Store Name */}
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                      >
                        <label htmlFor="name" className="block text-sm font-medium text-text mb-2">
                          Store Name <span className="text-primary">*</span>
                        </label>
                        <input
                          type="text"
                          id="name"
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          className={cn(
                            'w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all',
                            'bg-surface text-text placeholder-muted',
                            'border-neutral-700',
                            errors.name && 'border-error ring-error'
                          )}
                          placeholder="My Awesome Store"
                        />
                        {errors.name && (
                          <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mt-1 text-sm text-error"
                          >
                            {errors.name}
                          </motion.p>
                        )}
                      </motion.div>

                      {/* Description */}
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 }}
                      >
                        <label htmlFor="description" className="block text-sm font-medium text-text mb-2">
                          Description <span className="text-primary">*</span>
                        </label>
                        <textarea
                          id="description"
                          name="description"
                          value={formData.description}
                          onChange={handleChange}
                          rows={4}
                          className={cn(
                            'w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none',
                            'bg-surface text-text placeholder-muted',
                            'border-neutral-700',
                            errors.description && 'border-error ring-error'
                          )}
                          placeholder="Describe your store and what you sell..."
                        />
                        <p className="mt-1 text-xs text-muted">
                          {formData.description.length}/500 characters
                        </p>
                        {errors.description && (
                          <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mt-1 text-sm text-error"
                          >
                            {errors.description}
                          </motion.p>
                        )}
                      </motion.div>

                      {/* Logo URL */}
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 }}
                      >
                        <label htmlFor="logoUrl" className="block text-sm font-medium text-text mb-2">
                          Logo URL <span className="text-primary">*</span>
                        </label>
                        <input
                          type="url"
                          id="logoUrl"
                          name="logoUrl"
                          value={formData.logoUrl}
                          onChange={handleChange}
                          className={cn(
                            'w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all',
                            'bg-surface text-text placeholder-muted',
                            'border-neutral-700',
                            errors.logoUrl && 'border-error ring-error'
                          )}
                          placeholder="https://example.com/logo.png"
                        />
                        {errors.logoUrl && (
                          <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mt-1 text-sm text-error"
                          >
                            {errors.logoUrl}
                          </motion.p>
                        )}
                        <p className="mt-1 text-xs text-muted">
                          Enter a direct URL to your store logo image
                        </p>
                      </motion.div>

                      {/* Theme Selection */}
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.6 }}
                      >
                        <label htmlFor="themeId" className="block text-sm font-medium text-text mb-2">
                          Theme
                        </label>
                        <select
                          id="themeId"
                          name="themeId"
                          value={formData.themeId}
                          onChange={(e) => setFormData((prev) => ({ ...prev, themeId: e.target.value }))}
                          className={cn(
                            'w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all',
                            'bg-surface text-text',
                            'border-neutral-700'
                          )}
                        >
                          <option value="default-theme">Default Theme</option>
                          <option value="modern-theme">Modern Theme</option>
                          <option value="classic-theme">Classic Theme</option>
                        </select>
                      </motion.div>

                      {/* Submit Error */}
                      {errors.submit && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="p-4 rounded-xl bg-error/10 border border-error"
                        >
                          <p className="text-sm text-error">{errors.submit}</p>
                        </motion.div>
                      )}

                      {/* Submit Button */}
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
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
                  <p className="text-muted mb-6">Redirecting to your store preview...</p>
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
