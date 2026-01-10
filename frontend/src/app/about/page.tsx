import React from 'react';
import type { Metadata } from 'next';
import { Navbar } from '@/components/layout';
import { Hero, Features, CTA, Footer } from '@/components/marketing';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

export const metadata: Metadata = {
  title: 'About Us',
  description: 'Learn about Revocart and our mission to help merchants succeed online.',
  openGraph: {
    title: 'About Us - Revocart',
    description: 'Learn about Revocart and our mission to help merchants succeed online.',
    type: 'website',
  },
};

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Hero
          title="About Revocart"
          subtitle="Empowering merchants to build successful online stores with powerful, easy-to-use tools."
          ctaText="Start Your Store"
          secondaryCtaText="Contact Us"
          secondaryCtaHref="/contact"
        />
        
        {/* Mission Section */}
        <section className="bg-white dark:bg-dark-surface py-20 sm:py-24 lg:py-32">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-dark-text sm:text-4xl md:text-5xl">
                Our Mission
              </h2>
              <p className="mt-6 text-lg leading-8 text-neutral-600 dark:text-dark-text-secondary">
                We believe that anyone should be able to start and grow an online business, regardless of technical expertise. 
                Revocart was built to democratize ecommerce, making it accessible to entrepreneurs, creators, and businesses of all sizes.
              </p>
            </div>
          </div>
        </section>

        {/* Values Section */}
        <section className="bg-secondary-off-white dark:bg-dark-background py-20 sm:py-24 lg:py-32">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-dark-text sm:text-4xl md:text-5xl">
                Our Values
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              <Card variant="elevated">
                <CardHeader>
                  <CardTitle>Simplicity</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-neutral-600 dark:text-dark-text-secondary">
                    We make complex ecommerce tools simple and intuitive, so you can focus on what matters most—your business.
                  </p>
                </CardContent>
              </Card>
              <Card variant="elevated">
                <CardHeader>
                  <CardTitle>Innovation</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-neutral-600 dark:text-dark-text-secondary">
                    We continuously innovate to provide cutting-edge features that help you stay ahead of the competition.
                  </p>
                </CardContent>
              </Card>
              <Card variant="elevated">
                <CardHeader>
                  <CardTitle>Support</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-neutral-600 dark:text-dark-text-secondary">
                    Your success is our success. We provide 24/7 support to ensure you have everything you need to thrive.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <CTA />
      </main>
      <Footer />
    </div>
  );
}

