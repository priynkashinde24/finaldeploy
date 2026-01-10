import React from 'react';
import type { Metadata } from 'next';
import './globals.css';
import { AppProviders } from '@/components/providers/AppProviders';
import { ErrorHandlerInit } from '@/components/ErrorHandlerInit';

export const metadata: Metadata = {
  title: {
    default: 'Revocart - Launch Your Ecommerce Store in Minutes',
    template: '%s | Revocart',
  },
  description: 'The all-in-one platform to build, manage, and grow your online business. No technical skills required.',
  keywords: ['ecommerce', 'online store', 'SaaS', 'shopify alternative', 'online business'],
  authors: [{ name: 'Revocart' }],
  creator: 'Revocart',
  publisher: 'Revocart',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    siteName: 'Revocart',
    title: 'Revocart - Launch Your Ecommerce Store in Minutes',
    description: 'The all-in-one platform to build, manage, and grow your online business.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Revocart - Ecommerce Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Revocart - Launch Your Ecommerce Store in Minutes',
    description: 'The all-in-one platform to build, manage, and grow your online business.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark bg-background">
      <body className="bg-background text-white min-h-screen" style={{ color: '#FFFFFF' }}>
        <ErrorHandlerInit />
        <AppProviders>
          <div className="min-h-screen bg-gradient-to-br from-background via-surface to-background">
            <div className="relative">
              {/* Subtle noise/pattern background */}
              <div className="fixed inset-0 opacity-[0.02] pointer-events-none" 
                   style={{
                     backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                   }} />
              <div className="relative z-10">
                {children}
              </div>
            </div>
          </div>
        </AppProviders>
      </body>
    </html>
  );
}

