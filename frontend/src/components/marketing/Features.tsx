'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { FadeIn, SlideUp, Stagger, StaggerItem, ScaleIn } from '@/components/animations';

export interface Feature {
  title: string;
  description: string;
  icon: React.ReactNode;
}

export interface FeaturesProps {
  title?: string;
  subtitle?: string;
  features?: Feature[];
  className?: string;
}

const defaultFeatures: Feature[] = [
  {
    title: 'Easy Setup',
    description: 'Get your store up and running in minutes with our intuitive setup wizard. No coding required.',
    icon: (
      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    title: 'Powerful Analytics',
    description: 'Track your sales, customers, and growth with comprehensive analytics and reporting tools.',
    icon: (
      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    title: 'Secure Payments',
    description: 'Accept payments securely with multiple payment gateways. PCI compliant and fraud protected.',
    icon: (
      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
  {
    title: 'Mobile Optimized',
    description: 'Your store looks perfect on any device. Mobile-first design ensures great user experience.',
    icon: (
      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: '24/7 Support',
    description: 'Get help whenever you need it. Our support team is available around the clock.',
    icon: (
      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    title: 'Customizable Themes',
    description: 'Choose from hundreds of themes or create your own. Make your store uniquely yours.',
    icon: (
      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    ),
  },
];

export const Features: React.FC<FeaturesProps> = ({
  title = 'Everything you need to succeed',
  subtitle = 'Powerful features designed to help you build and grow your online store',
  features = defaultFeatures,
  className,
}) => {
  return (
    <section
      className={cn(
        'relative overflow-hidden bg-gradient-to-br from-surface via-surface2 to-surface py-20 sm:py-24 lg:py-32',
        className
      )}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/4 h-96 w-96 rounded-full bg-primary opacity-5 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-accent opacity-5 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <FadeIn delay={0.1}>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-text sm:text-4xl md:text-5xl">
              {title}
            </h2>
            <p className="mt-4 text-lg leading-8 text-muted">
              {subtitle}
            </p>
          </div>
        </FadeIn>

        {/* Features Grid */}
        <Stagger delay={0.2} staggerDelay={0.1}>
          <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 lg:max-w-none">
            {features.map((feature, index) => (
              <StaggerItem key={index} className="h-full">
                <motion.div
                  whileHover={{
                    y: -12,
                    scale: 1.03,
                    rotateY: 5,
                    rotateX: 5,
                  }}
                  transition={{
                    duration: 0.3,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="group relative glass rounded-2xl p-8 transition-all duration-300 hover:shadow-2xl overflow-hidden h-full flex flex-col"
                  style={{
                    transformStyle: 'preserve-3d',
                    perspective: '1000px',
                  }}
                >
                  {/* Animated background gradient */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-br from-primary/5 via-gold/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    initial={{ scale: 0.8, opacity: 0 }}
                    whileHover={{ scale: 1.2, opacity: 1 }}
                    transition={{ duration: 0.5 }}
                  />

                  {/* Icon */}
                  <motion.div
                    whileHover={{
                      rotate: [0, -10, 10, -10, 0],
                      scale: 1.15,
                    }}
                    transition={{
                      duration: 0.6,
                      ease: 'easeInOut',
                    }}
                    className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-gold to-accent text-white shadow-lg relative z-10"
                  >
                    <motion.div
                      animate={{
                        boxShadow: [
                          '0 0 20px rgba(212, 175, 55, 0.3)',
                          '0 0 40px rgba(212, 175, 55, 0.6)',
                          '0 0 20px rgba(212, 175, 55, 0.3)',
                        ],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                      className="absolute inset-0 rounded-xl"
                    />
                    <div className="relative z-10">{feature.icon}</div>
                  </motion.div>

                  {/* Content */}
                  <motion.h3
                    className="text-xl font-semibold text-text relative z-10 mb-3"
                    whileHover={{ x: 5 }}
                    transition={{ duration: 0.2 }}
                  >
                    {feature.title}
                  </motion.h3>
                  <p className="text-base leading-7 text-muted relative z-10 flex-grow">
                    {feature.description}
                  </p>

                  {/* Accent decoration */}
                  <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    whileHover={{ width: '100%', opacity: 1 }}
                    transition={{ duration: 0.4 }}
                    className="absolute top-0 left-0 h-1 bg-gradient-to-r from-primary via-gold to-accent"
                  />
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    whileHover={{ height: '100%', opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                    className="absolute top-0 right-0 w-1 bg-gradient-to-b from-primary via-gold to-accent"
                  />

                  {/* Shine effect */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                    initial={{ x: '-100%', skewX: -20 }}
                    whileHover={{ x: '200%' }}
                    transition={{ duration: 0.8, ease: 'easeInOut' }}
                  />
                </motion.div>
              </StaggerItem>
            ))}
          </div>
        </Stagger>
      </div>
    </section>
  );
};
