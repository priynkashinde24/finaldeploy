'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface Testimonial {
  name: string;
  role: string;
  company: string;
  content: string;
  avatar?: string;
}

export interface TestimonialsProps {
  title?: string;
  subtitle?: string;
  testimonials?: Testimonial[];
  className?: string;
}

const defaultTestimonials: Testimonial[] = [
  {
    name: 'Sarah Johnson',
    role: 'Founder',
    company: 'Boutique Fashion',
    content: 'Revocart made it so easy to launch our online store. We went from idea to first sale in just 48 hours!',
  },
  {
    name: 'Michael Chen',
    role: 'CEO',
    company: 'Tech Gadgets Co',
    content: 'The analytics and reporting features are incredible. We\'ve grown 300% in the first quarter using Revocart.',
  },
  {
    name: 'Emily Rodriguez',
    role: 'Owner',
    company: 'Artisan Crafts',
    content: 'Beautiful themes and excellent customer support. Our customers love the shopping experience!',
  },
];

export const Testimonials: React.FC<TestimonialsProps> = ({
  title = 'Loved by merchants worldwide',
  subtitle = 'See what our customers are saying',
  testimonials = defaultTestimonials,
  className,
}) => {
  return (
    <section
      className={cn(
        'bg-secondary-off-white dark:bg-dark-background py-20 sm:py-24 lg:py-32',
        className
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-dark-text sm:text-4xl md:text-5xl">
            {title}
          </h2>
          <p className="mt-4 text-lg leading-8 text-neutral-600 dark:text-dark-text-secondary">
            {subtitle}
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 lg:max-w-none">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="rounded-xl bg-white dark:bg-dark-surface p-8 shadow-md border border-secondary-gray dark:border-dark-border"
            >
              {/* Quote icon */}
              <div className="mb-4">
                <svg className="h-8 w-8 text-primary-muted-gold" fill="currentColor" viewBox="0 0 32 32">
                  <path d="M10 8c-3.3 0-6 2.7-6 6v10h10V14H8c0-1.1.9-2 2-2V8zm16 0c-3.3 0-6 2.7-6 6v10h10V14h-6c0-1.1.9-2 2-2V8z" />
                </svg>
              </div>

              {/* Content */}
              <p className="text-base leading-7 text-neutral-600 dark:text-dark-text-secondary mb-6">
                "{testimonial.content}"
              </p>

              {/* Author */}
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary-deep-red flex items-center justify-center text-white font-semibold">
                  {testimonial.name.charAt(0)}
                </div>
                <div>
                  <div className="font-semibold text-neutral-900 dark:text-dark-text">
                    {testimonial.name}
                  </div>
                  <div className="text-sm text-neutral-500 dark:text-dark-text-secondary">
                    {testimonial.role}, {testimonial.company}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

