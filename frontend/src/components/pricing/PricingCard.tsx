import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

type Props = {
  title: string;
  priceMonthly: number;
  priceYearly?: number;
  features: string[];
  popular?: boolean;
  billingPeriod: 'monthly' | 'yearly';
  ctaText?: string;
  onSelect?: () => void;
};

export default function PricingCard({
  title,
  priceMonthly,
  priceYearly,
  features,
  popular,
  billingPeriod,
  ctaText = 'Get Started',
  onSelect,
}: Props) {
  const price = billingPeriod === 'yearly' && priceYearly ? priceYearly : priceMonthly;

  return (
    <Card
      hover
      className={cn(
        'p-8 flex flex-col justify-between relative',
        popular && 'border-gold border-2'
      )}
    >
      {popular && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <span className="text-xs px-3 py-1 bg-gold text-background rounded-full font-semibold">
            Popular
          </span>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-h3 font-bold text-text-primary">{title}</h3>
        </div>

        <div className="mt-6 mb-6">
          <div className="flex items-baseline gap-3">
            <AnimatePresence mode="wait">
              <motion.span
                key={price}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.3 }}
                className="text-[40px] font-bold text-text-primary"
              >
                ₹{price.toLocaleString('en-IN')}
              </motion.span>
            </AnimatePresence>
            <span className="text-sm text-text-muted">
              {billingPeriod === 'yearly' ? '/yr' : '/mo'}
            </span>
          </div>
        </div>

        <ul className="space-y-3 text-body-sm text-text-secondary">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-3">
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1 }}
                className="w-5 h-5 rounded-full bg-primary mt-1 flex-shrink-0 flex items-center justify-center"
              >
                <svg
                  className="w-3 h-3 text-white"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </motion.span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8">
        <Button
          variant={popular ? 'secondary' : 'primary'}
          size="lg"
          glow={popular}
          onClick={onSelect}
          className="w-full"
        >
          {ctaText}
        </Button>
      </div>
    </Card>
  );
}
