'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { VideoModal } from '@/components/ui/VideoModal';
import { cn } from '@/lib/utils';
import { FadeIn, SlideUp, Parallax, FloatingParticles, ScaleIn } from '@/components/animations';

export interface HeroProps {
  title?: string;
  subtitle?: string;
  ctaText?: string;
  ctaHref?: string;
  secondaryCtaText?: string;
  secondaryCtaHref?: string;
  className?: string;
}

export const Hero: React.FC<HeroProps> = ({
  title = 'Launch Your Ecommerce Store in Minutes',
  subtitle = 'The all-in-one platform to build, manage, and grow your online business. No technical skills required.',
  ctaText = 'Start Your Store',
  ctaHref = '/stores/create',
  secondaryCtaText = 'Watch Demo',
  secondaryCtaHref = '/demo',
  className,
}) => {
  const [showVideoModal, setShowVideoModal] = useState(false);
  const words = title.split(' ');

  return (
    <section
      className={cn(
        'relative overflow-hidden bg-background',
        'py-20 sm:py-24 lg:py-32',
        className
      )}
    >
      {/* Animated background gradients */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
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
        <motion.div
          animate={{
            x: [0, 100, 0],
            y: [0, 50, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-0 left-1/4 h-96 w-96 rounded-full bg-primary opacity-10 blur-3xl"
        />
        <motion.div
          animate={{
            x: [0, -100, 0],
            y: [0, -50, 0],
            scale: [1, 1.3, 1],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-accent opacity-10 blur-3xl"
        />
        <motion.div
          animate={{
            x: [0, 50, 0],
            y: [0, -30, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          className="absolute top-1/2 left-1/2 h-96 w-96 rounded-full bg-gold opacity-5 blur-3xl"
        />
        <FloatingParticles count={30} />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="mx-auto max-w-3xl text-center">
          {/* Accent decoration */}
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

          {/* Main heading with word-by-word animation */}
          <h1 className="text-h1 font-bold tracking-tight text-text-primary sm:text-[56px] md:text-[64px] lg:text-[72px] mb-6">
            {words.map((word, index) => (
              <motion.span
                key={index}
                initial={{ opacity: 0, y: 30, rotateX: -90 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{
                  duration: 0.6,
                  delay: 0.3 + index * 0.1,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="inline-block mr-2"
                whileHover={{ scale: 1.1, y: -5 }}
              >
                {index === words.length - 1 ? (
                  <motion.span
                    className="bg-gradient-to-r from-primary via-gold to-accent bg-clip-text text-transparent"
                    animate={{
                      backgroundPosition: ['0%', '100%', '0%'],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                    style={{
                      backgroundSize: '200% 200%',
                    }}
                  >
                    {word}
                  </motion.span>
                ) : (
                  word
                )}
              </motion.span>
            ))}
          </h1>

          {/* Subtitle */}
          <SlideUp delay={0.5}>
            <p className="mt-6 text-lg leading-8 text-text-secondary sm:text-xl md:text-2xl">
              {subtitle}
            </p>
          </SlideUp>

          {/* CTA Buttons */}
          <FadeIn delay={0.7}>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
              <motion.div
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.5 }}
              >
                <motion.div
                  whileHover={{
                    boxShadow: '0 0 30px rgba(170, 0, 0, 0.5)',
                  }}
                  transition={{ duration: 0.3 }}
                >
                  <Button
                    size="lg"
                    variant="primary"
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
                      className="absolute inset-0 bg-gradient-to-r from-gold/20 via-accent/20 to-gold/20"
                      initial={{ x: '-100%' }}
                      whileHover={{ x: '100%' }}
                      transition={{ duration: 0.6 }}
                    />
                  </Button>
                </motion.div>
              </motion.div>
              {secondaryCtaText && (
                <motion.div
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9, duration: 0.5 }}
                >
                  <Button
                    size="lg"
                    variant="secondary"
                    className="w-full sm:w-auto relative overflow-hidden group"
                    onClick={() => {
                      if (secondaryCtaHref === '/demo') {
                        setShowVideoModal(true);
                      } else {
                        window.location.href = secondaryCtaHref || '#';
                      }
                    }}
                  >
                    <motion.span
                      className="relative z-10"
                      whileHover={{ scale: 1.05 }}
                    >
                      {secondaryCtaText}
                    </motion.span>
                  </Button>
                </motion.div>
              )}
            </div>
          </FadeIn>

          {/* Trust indicators */}
          <FadeIn delay={0.9}>
            <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-sm text-text-secondary">
              {[
                { icon: '⭐', text: '4.9/5 Rating' },
                { icon: '✓', text: '10,000+ Stores' },
                { icon: '⚡', text: '99.9% Uptime' },
              ].map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{
                    delay: 1 + index * 0.1,
                    duration: 0.5,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  whileHover={{ scale: 1.1, y: -3 }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10 hover:border-gold/50 transition-colors"
                >
                  <motion.span
                    className="text-gold text-lg"
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: index * 0.5,
                    }}
                  >
                    {item.icon}
                  </motion.span>
                  <span>{item.text}</span>
                </motion.div>
              ))}
            </div>
          </FadeIn>
        </div>
      </div>

      {/* Floating shapes */}
      <Parallax speed={0.3}>
        <div className="absolute top-20 left-10 w-20 h-20 rounded-full bg-primary/20 blur-xl" />
      </Parallax>
      <Parallax speed={0.5}>
        <div className="absolute bottom-20 right-10 w-32 h-32 rounded-full bg-accent/20 blur-xl" />
      </Parallax>

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
