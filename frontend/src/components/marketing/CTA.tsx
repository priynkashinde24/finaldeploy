'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { VideoModal } from '@/components/ui/VideoModal';
import { cn } from '@/lib/utils';
import { FadeIn, SlideUp, ScaleIn, FloatingParticles } from '@/components/animations';

export interface CTAProps {
  title?: string;
  subtitle?: string;
  ctaText?: string;
  ctaHref?: string;
  secondaryCtaText?: string;
  secondaryCtaHref?: string;
  variant?: 'default' | 'centered' | 'split';
  className?: string;
}

export const CTA: React.FC<CTAProps> = ({
  title = 'Ready to start your store?',
  subtitle = 'Join thousands of successful merchants and start selling today.',
  ctaText = 'Start Your Store',
  ctaHref = '/stores/create',
  secondaryCtaText,
  secondaryCtaHref,
  variant = 'default',
  className,
}) => {
  const [showVideoModal, setShowVideoModal] = useState(false);
  const isCentered = variant === 'centered';
  const isSplit = variant === 'split';

  return (
    <section
      className={cn(
        'relative overflow-hidden bg-background',
        'py-16 sm:py-20 lg:py-24',
        className
      )}
    >
      {/* Animated background */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <motion.div
          animate={{
            background: [
              'radial-gradient(circle at 20% 50%, rgba(212, 175, 55, 0.2) 0%, transparent 50%)',
              'radial-gradient(circle at 80% 50%, rgba(64, 224, 208, 0.2) 0%, transparent 50%)',
              'radial-gradient(circle at 50% 20%, rgba(212, 175, 55, 0.2) 0%, transparent 50%)',
              'radial-gradient(circle at 20% 50%, rgba(212, 175, 55, 0.2) 0%, transparent 50%)',
            ],
          }}
          transition={{ duration: 8, repeat: Infinity }}
          className="absolute inset-0"
        />
        <motion.div
          animate={{
            x: [0, 50, 0],
            y: [0, 30, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-0 right-0 h-64 w-64 rounded-full bg-gold opacity-20 blur-3xl"
        />
        <motion.div
          animate={{
            x: [0, -50, 0],
            y: [0, -30, 0],
            scale: [1, 1.3, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-accent opacity-20 blur-3xl"
        />
        <FloatingParticles count={15} />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        <div
          className={cn(
            'mx-auto',
            isCentered ? 'max-w-3xl text-center' : isSplit ? 'max-w-5xl' : 'max-w-4xl text-center'
          )}
        >
          {isSplit ? (
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-center">
              <FadeIn delay={0.1}>
                <div>
                  <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
                    {title}
                  </h2>
                  <p className="mt-4 text-lg leading-8 text-white/90">
                    {subtitle}
                  </p>
                </div>
              </FadeIn>
              <SlideUp delay={0.3}>
                <div className="flex flex-col items-start gap-4 sm:flex-row lg:justify-end">
                  <motion.div
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button
                      size="lg"
                      variant="secondary"
                      glow
                      className="w-full sm:w-auto relative overflow-hidden"
                      onClick={() => (window.location.href = ctaHref)}
                    >
                      <motion.span
                        className="relative z-10"
                        whileHover={{ scale: 1.05 }}
                      >
                        {ctaText}
                      </motion.span>
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-gold/30 via-accent/30 to-gold/30"
                        initial={{ x: '-100%' }}
                        whileHover={{ x: '100%' }}
                        transition={{ duration: 0.6 }}
                      />
                    </Button>
                  </motion.div>
                  {secondaryCtaText && (
                    <motion.div
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Button
                        size="lg"
                        variant="ghost"
                        className="w-full sm:w-auto"
                        onClick={() => {
                          if (secondaryCtaHref === '/demo' || secondaryCtaText.toLowerCase().includes('demo')) {
                            setShowVideoModal(true);
                          } else {
                            window.location.href = secondaryCtaHref || '#';
                          }
                        }}
                      >
                        {secondaryCtaText}
                      </Button>
                    </motion.div>
                  )}
                </div>
              </SlideUp>
            </div>
          ) : (
            <>
              <FadeIn delay={0.1}>
                <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
                  {title}
                </h2>
              </FadeIn>
              <SlideUp delay={0.2}>
                <p className="mt-4 text-lg leading-8 text-white/90">
                  {subtitle}
                </p>
              </SlideUp>
              <FadeIn delay={0.3}>
                <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
                  <motion.div
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <Button
                      size="lg"
                      variant="secondary"
                      glow
                      className="w-full sm:w-auto relative overflow-hidden"
                      onClick={() => (window.location.href = ctaHref)}
                    >
                      <motion.span
                        className="relative z-10"
                        whileHover={{ scale: 1.05 }}
                      >
                        {ctaText}
                      </motion.span>
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-gold/30 via-accent/30 to-gold/30"
                        initial={{ x: '-100%' }}
                        whileHover={{ x: '100%' }}
                        transition={{ duration: 0.6 }}
                      />
                    </Button>
                  </motion.div>
                  {secondaryCtaText && (
                    <motion.div
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                    >
                      <Button
                        size="lg"
                        variant="ghost"
                        className="w-full sm:w-auto"
                        onClick={() => {
                          if (secondaryCtaHref === '/demo' || secondaryCtaText.toLowerCase().includes('demo')) {
                            setShowVideoModal(true);
                          } else {
                            window.location.href = secondaryCtaHref || '#';
                          }
                        }}
                      >
                        {secondaryCtaText}
                      </Button>
                    </motion.div>
                  )}
                </div>
              </FadeIn>
            </>
          )}
        </div>
      </div>

      {/* Video Modal */}
      <VideoModal
        isOpen={showVideoModal}
        onClose={() => setShowVideoModal(false)}
        videoUrl="/videos/demo.mp4"
        title="Revocart Demo Video"
      />
    </section>
  );
};
