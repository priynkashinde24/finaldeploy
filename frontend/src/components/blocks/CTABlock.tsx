'use client';

import React from 'react';
import { CTABlockSettings } from '@/types/blockTypes';
import { useBranding } from '@/context/BrandingContext';

interface CTABlockProps {
  settings: CTABlockSettings;
}

export function CTABlock({ settings }: CTABlockProps) {
  const branding = useBranding();
  const { text, buttonText, buttonLink, backgroundStyle } = settings;

  const getBackgroundStyle = () => {
    switch (backgroundStyle) {
      case 'primary':
        return {
          backgroundColor: branding.colors?.primary || '#AA0000',
          color: '#FFFFFF',
        };
      case 'secondary':
        return {
          backgroundColor: branding.colors?.secondary || '#D4AF37',
          color: '#000000',
        };
      case 'gradient':
        return {
          background: `linear-gradient(135deg, ${branding.colors?.primary || '#AA0000'} 0%, ${branding.colors?.secondary || '#D4AF37'} 100%)`,
          color: '#FFFFFF',
        };
      default:
        return {
          backgroundColor: branding.colors?.primary || '#AA0000',
          color: '#FFFFFF',
        };
    }
  };

  const buttonStyle = {
    backgroundColor: backgroundStyle === 'primary' 
      ? (branding.colors?.accent || '#FFFFFF')
      : (branding.colors?.primary || '#AA0000'),
    color: backgroundStyle === 'primary'
      ? (branding.colors?.primary || '#000000')
      : '#FFFFFF',
  };

  return (
    <section
      className="py-16 px-4 text-center"
      style={getBackgroundStyle()}
    >
      <div className="max-w-4xl mx-auto">
        <p
          className="text-2xl md:text-3xl font-semibold mb-6"
          style={{
            fontFamily: branding.fonts?.primaryFont || 'system-ui',
          }}
        >
          {text}
        </p>
        <a
          href={buttonLink}
          className="inline-block px-8 py-4 rounded-lg font-semibold text-lg transition-opacity hover:opacity-90"
          style={buttonStyle}
        >
          {buttonText}
        </a>
      </div>
    </section>
  );
}

