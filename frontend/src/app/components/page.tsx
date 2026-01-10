'use client';

import React from 'react';
import { Button, Card, CardHeader, CardTitle, CardContent, SectionTitle } from '@/components/ui';

export default function ComponentsPage() {
  return (
    <div className="min-h-screen bg-secondary-off-white dark:bg-dark-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12 text-center">
          <SectionTitle size="xl" variant="default" className="mb-4">
            UI Components Preview
          </SectionTitle>
          <p className="text-lg text-neutral-600 dark:text-dark-text-secondary">
            Reusable components built with design tokens
          </p>
        </div>

        {/* Button Variants */}
        <section className="mb-16">
          <SectionTitle size="lg" variant="default" className="mb-6">
            Button Component
          </SectionTitle>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card variant="elevated">
              <CardHeader>
                <CardTitle>Button Variants</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  <Button variant="primary">Primary</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="accent">Accent</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                </div>
              </CardContent>
            </Card>

            <Card variant="elevated">
              <CardHeader>
                <CardTitle>Button Sizes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-4">
                  <Button size="sm" variant="primary">Small</Button>
                  <Button size="md" variant="primary">Medium</Button>
                  <Button size="lg" variant="primary">Large</Button>
                </div>
              </CardContent>
            </Card>

            <Card variant="elevated" className="md:col-span-2">
              <CardHeader>
                <CardTitle>Button States</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  <Button variant="primary">Normal</Button>
                  <Button variant="primary" disabled>Disabled</Button>
                  <Button variant="primary" className="opacity-75">Hover</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Card Variants */}
        <section className="mb-16">
          <SectionTitle size="lg" variant="default" className="mb-6">
            Card Component
          </SectionTitle>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card variant="default">
              <CardHeader>
                <CardTitle>Default Card</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-neutral-600 dark:text-dark-text-secondary">
                  This is a default card with standard shadow and border.
                </p>
              </CardContent>
            </Card>

            <Card variant="elevated">
              <CardHeader>
                <CardTitle>Elevated Card</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-neutral-600 dark:text-dark-text-secondary">
                  This card has a more prominent shadow for emphasis.
                </p>
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardHeader>
                <CardTitle>Outlined Card</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-neutral-600 dark:text-dark-text-secondary">
                  This card uses a border instead of shadow.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Section Title Variants */}
        <section className="mb-16">
          <SectionTitle size="lg" variant="default" className="mb-6">
            Section Title Component
          </SectionTitle>
          
          <Card variant="elevated">
            <CardContent>
              <div className="space-y-8">
                <div>
                  <h3 className="text-sm font-medium text-neutral-600 dark:text-dark-text-secondary mb-4">
                    Variants
                  </h3>
                  <div className="space-y-4">
                    <SectionTitle variant="default" size="lg">
                      Default (Deep Red)
                    </SectionTitle>
                    <SectionTitle variant="accent" size="lg">
                      Accent (Turquoise)
                    </SectionTitle>
                    <SectionTitle variant="gold" size="lg">
                      Gold (Muted Gold)
                    </SectionTitle>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-neutral-600 dark:text-dark-text-secondary mb-4">
                    Sizes
                  </h3>
                  <div className="space-y-4">
                    <SectionTitle variant="default" size="sm">Small Title</SectionTitle>
                    <SectionTitle variant="default" size="md">Medium Title</SectionTitle>
                    <SectionTitle variant="default" size="lg">Large Title</SectionTitle>
                    <SectionTitle variant="default" size="xl">Extra Large Title</SectionTitle>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Combined Example */}
        <section className="mb-16">
          <SectionTitle size="lg" variant="default" className="mb-6">
            Combined Example
          </SectionTitle>
          
          <Card variant="elevated">
            <CardHeader>
              <CardTitle>Product Card Example</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-neutral-600 dark:text-dark-text-secondary mb-6">
                This demonstrates how components work together using the design tokens.
              </p>
              <div className="flex gap-4">
                <Button variant="primary">Add to Cart</Button>
                <Button variant="outline">Learn More</Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

