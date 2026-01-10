'use client';

import React from 'react';
import { colors, spacing, typography, shadows, radius } from '@/styles/tokens';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { SectionTitle } from '@/components/ui/SectionTitle';

export default function TokensPage() {
  return (
    <div className="min-h-screen bg-secondary-off-white dark:bg-dark-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12 text-center">
          <SectionTitle size="xl" variant="default" className="mb-4">
            Design Tokens
          </SectionTitle>
          <p className="text-lg text-neutral-600 dark:text-dark-text-secondary">
            Complete design system reference for Revocart
          </p>
        </div>

        {/* Color Swatches */}
        <section className="mb-16">
          <SectionTitle size="lg" variant="default" className="mb-8">
            Color Palette
          </SectionTitle>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Primary Colors */}
            <Card variant="elevated">
              <CardHeader>
                <CardTitle>Primary Colors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <ColorSwatch
                    name="Deep Red"
                    color={colors.primary.deepRed}
                    value={colors.primary.deepRed}
                  />
                  <ColorSwatch
                    name="Muted Gold"
                    color={colors.primary.mutedGold}
                    value={colors.primary.mutedGold}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Secondary Colors */}
            <Card variant="elevated">
              <CardHeader>
                <CardTitle>Secondary Colors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <ColorSwatch
                    name="Off White"
                    color={colors.secondary.offWhite}
                    value={colors.secondary.offWhite}
                  />
                  <ColorSwatch
                    name="Gray"
                    color={colors.secondary.gray}
                    value={colors.secondary.gray}
                  />
                  <ColorSwatch
                    name="Soft Blue"
                    color={colors.secondary.softBlue}
                    value={colors.secondary.softBlue}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Accent Colors */}
            <Card variant="elevated">
              <CardHeader>
                <CardTitle>Accent Colors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <ColorSwatch
                    name="Turquoise"
                    color={colors.accent.turquoise}
                    value={colors.accent.turquoise}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Semantic Colors */}
            <Card variant="elevated" className="md:col-span-2 lg:col-span-3">
              <CardHeader>
                <CardTitle>Semantic Colors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <ColorSwatch
                    name="Success"
                    color={colors.semantic.success}
                    value={colors.semantic.success}
                  />
                  <ColorSwatch
                    name="Warning"
                    color={colors.semantic.warning}
                    value={colors.semantic.warning}
                  />
                  <ColorSwatch
                    name="Error"
                    color={colors.semantic.error}
                    value={colors.semantic.error}
                  />
                  <ColorSwatch
                    name="Info"
                    color={colors.semantic.info}
                    value={colors.semantic.info}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Neutral Colors */}
            <Card variant="elevated" className="md:col-span-2 lg:col-span-3">
              <CardHeader>
                <CardTitle>Neutral Colors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-10 gap-3">
                  {Object.entries(colors.neutral).map(([key, value]) => (
                    <ColorSwatch
                      key={key}
                      name={key.replace('gray', '').toUpperCase() || 'White'}
                      color={value}
                      value={value}
                      compact
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Typography Scale */}
        <section className="mb-16">
          <SectionTitle size="lg" variant="default" className="mb-8">
            Typography Scale
          </SectionTitle>
          
          <Card variant="elevated">
            <CardContent>
              <div className="space-y-6">
                {Object.entries(typography.fontSize).map(([key, value]) => {
                  const [size, config] = Array.isArray(value) ? value : [value, { lineHeight: '1' }];
                  const sizeStr = String(size);
                  const lineHeightStr = String(config.lineHeight);
                  return (
                    <div key={key} className="border-b border-secondary-gray pb-4 last:border-0">
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="text-sm font-medium text-neutral-600 dark:text-dark-text-secondary">
                          {key.toUpperCase()}
                        </span>
                        <span className="text-xs text-neutral-500 dark:text-dark-text-secondary">
                          {sizeStr} / {lineHeightStr}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: sizeStr,
                          lineHeight: lineHeightStr,
                        }}
                        className="text-neutral-900 dark:text-dark-text"
                      >
                        The quick brown fox jumps over the lazy dog
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Spacing Scale */}
        <section className="mb-16">
          <SectionTitle size="lg" variant="default" className="mb-8">
            Spacing Scale
          </SectionTitle>
          
          <Card variant="elevated">
            <CardContent>
              <div className="space-y-4">
                {Object.entries(spacing).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-4">
                    <div className="w-20 text-sm font-medium text-neutral-600 dark:text-dark-text-secondary">
                      {key}
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                      <div
                        className="bg-primary-deep-red h-8 rounded"
                        style={{ width: value }}
                      />
                      <span className="text-xs text-neutral-500 dark:text-dark-text-secondary">
                        {value}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Shadow Tokens */}
        <section className="mb-16">
          <SectionTitle size="lg" variant="default" className="mb-8">
            Shadow Tokens
          </SectionTitle>
          
          <Card variant="elevated">
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.entries(shadows).map(([key, value]) => {
                  if (typeof value === 'object') return null; // Skip brand shadows for now
                  return (
                    <div key={key} className="p-6 bg-white dark:bg-dark-surface rounded-lg">
                      <div className="text-sm font-medium text-neutral-600 dark:text-dark-text-secondary mb-2">
                        {key.toUpperCase()}
                      </div>
                      <div
                        className="w-full h-24 bg-secondary-off-white dark:bg-neutral-800 rounded"
                        style={{ boxShadow: value }}
                      />
                      <div className="text-xs text-neutral-500 dark:text-dark-text-secondary mt-2 font-mono">
                        {value}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Radius Tokens */}
        <section className="mb-16">
          <SectionTitle size="lg" variant="default" className="mb-8">
            Border Radius Tokens
          </SectionTitle>
          
          <Card variant="elevated">
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-6">
                {Object.entries(radius).map(([key, value]) => (
                  <div key={key} className="text-center">
                    <div className="text-sm font-medium text-neutral-600 dark:text-dark-text-secondary mb-2">
                      {key.toUpperCase()}
                    </div>
                    <div
                      className="w-20 h-20 mx-auto bg-primary-deep-red"
                      style={{ borderRadius: value }}
                    />
                    <div className="text-xs text-neutral-500 dark:text-dark-text-secondary mt-2 font-mono">
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

interface ColorSwatchProps {
  name: string;
  color: string;
  value: string;
  compact?: boolean;
}

function ColorSwatch({ name, color, value, compact = false }: ColorSwatchProps) {
  return (
    <div className={compact ? 'text-center' : ''}>
      <div
        className={`${compact ? 'w-full h-16' : 'w-full h-24'} rounded-lg mb-2 border border-secondary-gray`}
        style={{ backgroundColor: color }}
      />
      <div className={compact ? 'text-xs' : 'text-sm'}>
        <div className="font-medium text-neutral-900 dark:text-dark-text">{name}</div>
        <div className="text-neutral-600 dark:text-dark-text-secondary font-mono text-xs mt-1">
          {value}
        </div>
      </div>
    </div>
  );
}

