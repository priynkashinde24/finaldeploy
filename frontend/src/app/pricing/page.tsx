'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import PriceToggle from '@/components/pricing/PriceToggle';
import PricingCard from '@/components/pricing/PricingCard';
import FeatureTable from '@/components/pricing/FeatureTable';
import { Navbar } from '@/components/layout';
import { Footer } from '@/components/marketing';
import { Button } from '@/components/ui/Button';

export default function PricingPage() {
  const [yearly, setYearly] = useState(false);
  const billing = yearly ? 'yearly' : 'monthly';

  const plans = [
    {
      key: 'starter',
      title: 'Starter',
      monthly: 499,
      yearly: Math.round(499 * 12 * 0.8),
      features: ['1 store', 'Basic analytics', 'Email support'],
    },
    {
      key: 'pro',
      title: 'Professional',
      monthly: 1499,
      yearly: Math.round(1499 * 12 * 0.8),
      features: ['Up to 5 stores', 'Advanced analytics', 'Priority support'],
      popular: true,
    },
    {
      key: 'enterprise',
      title: 'Enterprise',
      monthly: 4999,
      yearly: Math.round(4999 * 12 * 0.8),
      features: ['Unlimited stores', 'Dedicated success', 'SLA & integrations'],
    },
  ];

  const features = [
    'Multi-store management',
    'Supplier integrations',
    'Split payments',
    'Analytics dashboard',
    'Priority support',
  ];

  const tablePlans = plans.map((p) => ({
    key: p.key,
    label: p.title,
    includes: features.map((f) => {
      // Map features to plan inclusions
      if (f === 'Multi-store management') {
        return p.key !== 'starter';
      }
      if (f === 'Supplier integrations') {
        return p.key !== 'starter';
      }
      if (f === 'Split payments') {
        return true; // All plans
      }
      if (f === 'Analytics dashboard') {
        return true; // All plans
      }
      if (f === 'Priority support') {
        return p.key !== 'starter';
      }
      return false;
    }),
  }));

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 px-6 py-20 max-w-7xl mx-auto w-full">
        <div className="text-center mb-8">
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-h1 font-bold text-text-primary mb-4"
          >
            Pricing Plans
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-text-secondary mt-3 text-lg"
          >
            Simple, transparent pricing. Upgrade any time.
          </motion.p>
        </div>

        <div className="flex items-center justify-center mb-12">
          <PriceToggle yearly={yearly} onToggle={() => setYearly((s) => !s)} />
        </div>

        <motion.div
          layout
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12"
        >
          {plans.map((p, idx) => (
            <motion.div
              key={p.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
            >
              <PricingCard
                title={p.title}
                priceMonthly={p.monthly}
                priceYearly={p.yearly}
                features={p.features}
                popular={!!p.popular}
                billingPeriod={billing as 'monthly' | 'yearly'}
                onSelect={() => {
                  // Track selection or open signup
                  window.location.href = '/stores/create';
                }}
                ctaText={p.popular ? 'Get Professional' : 'Get Started'}
              />
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-12"
        >
          <FeatureTable features={features} plans={tablePlans} />
        </motion.div>

        <div className="text-center mt-16">
          <Button
            variant="primary"
            size="lg"
            glow
            onClick={() => {
              window.location.href = '/stores/create';
            }}
          >
            Start your free trial
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  );
}

