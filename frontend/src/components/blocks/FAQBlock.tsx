'use client';

import React, { useState } from 'react';
import { FAQBlockSettings } from '@/types/blockTypes';
import { useBranding } from '@/context/BrandingContext';

interface FAQBlockProps {
  settings: FAQBlockSettings;
}

export function FAQBlock({ settings }: FAQBlockProps) {
  const branding = useBranding();
  const { title, items, layout } = settings;
  const [openIndex, setOpenIndex] = useState<number | null>(layout === 'accordion' ? null : null);

  const toggleItem = (index: number) => {
    if (layout === 'accordion') {
      setOpenIndex(openIndex === index ? null : index);
    }
  };

  return (
    <section className="py-16 px-4" style={{ backgroundColor: branding.colors?.background || '#FFFFFF' }}>
      <div className="max-w-4xl mx-auto">
        <h2
          className="text-3xl font-bold mb-8 text-center"
          style={{
            color: branding.colors?.text || '#000000',
            fontFamily: branding.fonts?.primaryFont || 'system-ui',
          }}
        >
          {title}
        </h2>
        <div className="space-y-4">
          {items.map((item, index) => (
            <div
              key={index}
              className="border rounded-lg overflow-hidden"
              style={{
                borderColor: branding.colors?.primary || '#E0E0E0',
                backgroundColor: branding.colors?.background || '#FFFFFF',
              }}
            >
              {layout === 'accordion' ? (
                <>
                  <button
                    onClick={() => toggleItem(index)}
                    className="w-full px-6 py-4 text-left flex justify-between items-center hover:bg-gray-50 transition-colors"
                    style={{
                      backgroundColor: openIndex === index 
                        ? (branding.colors?.primary || '#AA0000')
                        : 'transparent',
                      color: openIndex === index 
                        ? '#FFFFFF'
                        : (branding.colors?.text || '#000000'),
                    }}
                  >
                    <span
                      className="font-semibold"
                      style={{
                        fontFamily: branding.fonts?.primaryFont || 'system-ui',
                      }}
                    >
                      {item.question}
                    </span>
                    <span className="text-xl">
                      {openIndex === index ? '−' : '+'}
                    </span>
                  </button>
                  {openIndex === index && (
                    <div
                      className="px-6 py-4 border-t"
                      style={{
                        borderColor: branding.colors?.primary || '#E0E0E0',
                        color: branding.colors?.text || '#000000',
                      }}
                    >
                      <p>{item.answer}</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="px-6 py-4">
                  <h3
                    className="font-semibold mb-2"
                    style={{
                      color: branding.colors?.primary || '#AA0000',
                      fontFamily: branding.fonts?.primaryFont || 'system-ui',
                    }}
                  >
                    {item.question}
                  </h3>
                  <p
                    style={{
                      color: branding.colors?.text || '#000000',
                    }}
                  >
                    {item.answer}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

