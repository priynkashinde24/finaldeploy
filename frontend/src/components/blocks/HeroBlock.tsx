'use client';

import React from 'react';
import { HeroBlockSettings } from '@/types/blockTypes';
import { useBranding } from '@/context/BrandingContext';

interface HeroBlockProps {
  settings: HeroBlockSettings;
}

export function HeroBlock({ settings }: HeroBlockProps) {
  const branding = useBranding();
  const {
    headline,
    subheadline,
    backgroundImage,
    alignment = 'center',
    primaryButton,
    secondaryButton,
  } = settings;

  const alignmentClasses = {
    left: 'text-left items-start',
    center: 'text-center items-center',
  };

  return (
    <section
      className={`relative min-h-[400px] flex flex-col justify-center px-4 py-16 ${
        alignmentClasses[alignment]
      }`}
      style={{
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
        backgroundColor: backgroundImage ? undefined : branding.colors?.primary || '#AA0000',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {backgroundImage && (
        <div className="absolute inset-0 bg-black/40" />
      )}
      <div className={`relative z-10 max-w-4xl mx-auto ${alignmentClasses[alignment]}`}>
        <h1
          className="text-4xl md:text-6xl font-bold mb-4 text-white"
          style={{
            fontFamily: branding.fonts?.primaryFont || 'system-ui',
          }}
        >
          {headline}
        </h1>
        {subheadline && (
          <p className="text-xl md:text-2xl mb-8 text-white/90">
            {subheadline}
          </p>
        )}
        <div className={`flex gap-4 ${alignment === 'center' ? 'justify-center' : 'justify-start'}`}>
          {primaryButton && (
            <a
              href={primaryButton.link}
              className="px-6 py-3 rounded-lg font-semibold text-white transition-opacity hover:opacity-90"
              style={{
                backgroundColor: branding.colors?.accent || '#FFFFFF',
                color: branding.colors?.primary || '#000000',
              }}
            >
              {primaryButton.text}
            </a>
          )}
          {secondaryButton && (
            <a
              href={secondaryButton.link}
              className="px-6 py-3 rounded-lg font-semibold border-2 text-white transition-opacity hover:opacity-90"
              style={{
                borderColor: branding.colors?.accent || '#FFFFFF',
              }}
            >
              {secondaryButton.text}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

