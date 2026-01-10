import React from 'react';
import type { Metadata } from 'next';
import { Navbar } from '@/components/layout';
import { Hero, Features, CTA, Footer } from '@/components/marketing';

export const metadata: Metadata = {
  title: 'Revocart - Launch Your Ecommerce Store in Minutes',
  description: 'The all-in-one platform to build, manage, and grow your online business. No technical skills required.',
  openGraph: {
    title: 'Revocart - Launch Your Ecommerce Store in Minutes',
    description: 'The all-in-one platform to build, manage, and grow your online business.',
    type: 'website',
  },
};

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-background overflow-x-hidden">
      <Navbar />
      <main className="flex-1 bg-background">
        <Hero />
        <Features />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
