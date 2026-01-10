'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Navbar } from '@/components/layout';
import { Footer } from '@/components/marketing';
import { ModernButton } from '@/components/ui/ModernButton';
import { VideoModal } from '@/components/ui/VideoModal';
import { FadeIn, SlideUp } from '@/components/animations';

export default function DemoPage() {
  const [showVideoModal, setShowVideoModal] = useState(false);

  // Check if video exists (in production, this would be an API call or file check)
  const hasVideo = false; // Set to true when video is added to /public/videos/demo.mp4
  const videoUrl = '/videos/demo.mp4';
  const youtubeId = undefined; // Optional: 'dQw4w9WgXcQ' for YouTube embed

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-surface via-surface2 to-surface">
      <Navbar />
      <main className="flex-1 relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 -z-10">
          <motion.div
            animate={{
              background: [
                'radial-gradient(circle at 20% 50%, rgba(170, 0, 0, 0.15) 0%, transparent 50%)',
                'radial-gradient(circle at 80% 50%, rgba(212, 175, 55, 0.15) 0%, transparent 50%)',
                'radial-gradient(circle at 50% 20%, rgba(64, 224, 208, 0.15) 0%, transparent 50%)',
                'radial-gradient(circle at 20% 50%, rgba(170, 0, 0, 0.15) 0%, transparent 50%)',
              ],
            }}
            transition={{ duration: 10, repeat: Infinity }}
            className="absolute inset-0"
          />
          <div className="absolute top-0 left-1/4 h-96 w-96 rounded-full bg-primary opacity-10 blur-3xl animate-pulse" />
          <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-accent opacity-10 blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        <div className="relative z-10">
          {/* Hero Section */}
          <section className="py-20 sm:py-24 lg:py-32">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="mx-auto max-w-3xl text-center">
                <FadeIn delay={0.1}>
                  <div className="mb-6 flex justify-center">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: 64 }}
                      transition={{ duration: 0.8, delay: 0.2 }}
                      className="h-1 bg-gradient-to-r from-primary via-gold to-accent rounded-full"
                    />
                  </div>
                </FadeIn>

                <FadeIn delay={0.2}>
                  <h1 className="text-4xl font-extrabold tracking-tight text-text sm:text-5xl md:text-6xl lg:text-7xl mb-6">
                    <span className="bg-gradient-to-r from-primary via-gold to-accent bg-clip-text text-transparent">
                      Watch Our Demo
                    </span>
                  </h1>
                </FadeIn>

                <SlideUp delay={0.3}>
                  <p className="mt-6 text-lg leading-8 text-muted sm:text-xl md:text-2xl mb-10">
                    See how easy it is to create, manage, and grow your online store with Revocart.
                  </p>
                </SlideUp>

                <FadeIn delay={0.4}>
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <ModernButton
                      size="lg"
                      variant="primary"
                      glow
                      className="px-12 py-6 text-xl font-semibold"
                      onClick={() => setShowVideoModal(true)}
                    >
                      <span className="flex items-center gap-3">
                        <svg
                          className="w-6 h-6"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        Play Demo Video
                      </span>
                    </ModernButton>
                  </motion.div>
                </FadeIn>
              </div>
            </div>
          </section>

          {/* Features Section */}
          <section className="py-16 sm:py-20">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <FadeIn delay={0.5}>
                <div className="text-center mb-12">
                  <h2 className="text-3xl font-bold text-text sm:text-4xl">
                    What You'll See in the Demo
                  </h2>
                  <p className="mt-4 text-lg text-muted">
                    Get a complete walkthrough of Revocart's powerful features
                  </p>
                </div>
              </FadeIn>

              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 mt-12">
                {[
                  {
                    title: 'Store Setup',
                    description: 'See how easy it is to create your store in minutes',
                    icon: (
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    ),
                  },
                  {
                    title: 'Product Management',
                    description: 'Add products, set prices, and manage inventory effortlessly',
                    icon: (
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    ),
                  },
                  {
                    title: 'Analytics Dashboard',
                    description: 'Track sales, customers, and growth with real-time insights',
                    icon: (
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    ),
                  },
                  {
                    title: 'Checkout Process',
                    description: 'Experience the smooth, secure checkout flow',
                    icon: (
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    ),
                  },
                  {
                    title: 'Theme Customization',
                    description: 'Customize your store to match your brand perfectly',
                    icon: (
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                      </svg>
                    ),
                  },
                  {
                    title: 'Order Management',
                    description: 'Manage orders, shipments, and customer service all in one place',
                    icon: (
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    ),
                  },
                ].map((feature, index) => (
                  <SlideUp key={index} delay={0.6 + index * 0.1}>
                    <motion.div
                      whileHover={{ y: -8, scale: 1.02 }}
                      className="glass rounded-2xl p-6 transition-all duration-300"
                    >
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-gold text-white">
                        {feature.icon}
                      </div>
                      <h3 className="text-xl font-semibold text-text mb-2">{feature.title}</h3>
                      <p className="text-muted">{feature.description}</p>
                    </motion.div>
                  </SlideUp>
                ))}
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="py-16 sm:py-20">
            <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
              <FadeIn delay={0.9}>
                <h2 className="text-3xl font-bold text-text sm:text-4xl mb-4">
                  Ready to Get Started?
                </h2>
                <p className="text-lg text-muted mb-8">
                  Create your store today and start selling in minutes
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <ModernButton
                    size="lg"
                    variant="primary"
                    glow
                    onClick={() => (window.location.href = '/stores/create')}
                  >
                    Start Your Store
                  </ModernButton>
                  <ModernButton
                    size="lg"
                    variant="outline"
                    onClick={() => (window.location.href = '/pricing')}
                  >
                    View Pricing
                  </ModernButton>
                </div>
              </FadeIn>
            </div>
          </section>
        </div>
      </main>
      <Footer />

      {/* Video Modal */}
      <VideoModal
        isOpen={showVideoModal}
        onClose={() => setShowVideoModal(false)}
        videoUrl={hasVideo ? videoUrl : undefined}
        youtubeId={youtubeId}
        title="Revocart Demo Video"
      />
    </div>
  );
}

