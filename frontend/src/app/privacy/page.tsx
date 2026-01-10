'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-text-primary">
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-12"
        >
          <Link href="/" className="text-gold hover:text-gold/80 text-sm mb-4 inline-block">
            ← Back to Home
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-gold to-accent bg-clip-text text-transparent">
            Privacy Policy
          </h1>
          <p className="text-text-secondary text-sm">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="prose prose-invert max-w-none space-y-8"
        >
          {/* Information We Collect */}
          <section className="bg-surface rounded-xl p-6 border border-border">
            <h2 className="text-2xl font-bold text-gold mb-4">1. Information We Collect</h2>
            <p className="text-text-secondary leading-relaxed mb-4">
              We collect information that you provide directly to us, including:
            </p>
            <ul className="list-disc list-inside space-y-2 text-text-secondary ml-4">
              <li><strong className="text-gold">Account Information:</strong> Name, email address, phone number, and password</li>
              <li><strong className="text-gold">Profile Information:</strong> Business details, preferences, and settings</li>
              <li><strong className="text-gold">Transaction Information:</strong> Payment details, purchase history, and billing information</li>
              <li><strong className="text-gold">Communication Data:</strong> Messages, support tickets, and feedback</li>
              <li><strong className="text-gold">Usage Data:</strong> How you interact with our platform, pages visited, and features used</li>
            </ul>
            <p className="text-text-secondary leading-relaxed mt-4">
              We also automatically collect certain information through cookies and similar technologies when you use our services.
            </p>
          </section>

          {/* How We Use Data */}
          <section className="bg-surface rounded-xl p-6 border border-border">
            <h2 className="text-2xl font-bold text-gold mb-4">2. How We Use Data</h2>
            <p className="text-text-secondary leading-relaxed mb-4">
              We use the information we collect to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-text-secondary ml-4">
              <li>Provide, maintain, and improve our services</li>
              <li>Process transactions and send related information</li>
              <li>Send you technical notices, updates, and support messages</li>
              <li>Respond to your comments, questions, and requests</li>
              <li>Monitor and analyze trends, usage, and activities</li>
              <li>Detect, prevent, and address technical issues and fraudulent activities</li>
              <li>Personalize your experience and provide relevant content</li>
            </ul>
          </section>

          {/* Cookies */}
          <section className="bg-surface rounded-xl p-6 border border-border">
            <h2 className="text-2xl font-bold text-gold mb-4">3. Cookies</h2>
            <p className="text-text-secondary leading-relaxed mb-4">
              We use cookies and similar tracking technologies to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-text-secondary ml-4">
              <li>Remember your preferences and settings</li>
              <li>Authenticate your identity and maintain your session</li>
              <li>Analyze how you use our platform</li>
              <li>Provide personalized content and advertisements</li>
            </ul>
            <p className="text-text-secondary leading-relaxed mt-4">
              You can control cookies through your browser settings. However, disabling cookies may limit 
              your ability to use certain features of our platform.
            </p>
          </section>

          {/* Data Sharing */}
          <section className="bg-surface rounded-xl p-6 border border-border">
            <h2 className="text-2xl font-bold text-gold mb-4">4. Data Sharing</h2>
            <p className="text-text-secondary leading-relaxed mb-4">
              We do not sell your personal information. We may share your information only in the following circumstances:
            </p>
            <ul className="list-disc list-inside space-y-2 text-text-secondary ml-4">
              <li><strong className="text-gold">Service Providers:</strong> With trusted third-party service providers who assist in operating our platform</li>
              <li><strong className="text-gold">Legal Requirements:</strong> When required by law or to protect our rights and safety</li>
              <li><strong className="text-gold">Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
              <li><strong className="text-gold">With Your Consent:</strong> When you explicitly authorize us to share your information</li>
            </ul>
            <p className="text-text-secondary leading-relaxed mt-4">
              We require all third parties to respect the security of your data and to treat it in accordance with the law.
            </p>
          </section>

          {/* Data Security */}
          <section className="bg-surface rounded-xl p-6 border border-border">
            <h2 className="text-2xl font-bold text-gold mb-4">5. Data Security</h2>
            <p className="text-text-secondary leading-relaxed mb-4">
              We implement appropriate technical and organizational measures to protect your personal information:
            </p>
            <ul className="list-disc list-inside space-y-2 text-text-secondary ml-4">
              <li>Encryption of data in transit and at rest</li>
              <li>Regular security assessments and updates</li>
              <li>Access controls and authentication mechanisms</li>
              <li>Secure payment processing</li>
              <li>Regular backups and disaster recovery procedures</li>
            </ul>
            <p className="text-text-secondary leading-relaxed mt-4">
              However, no method of transmission over the Internet or electronic storage is 100% secure. 
              While we strive to protect your data, we cannot guarantee absolute security.
            </p>
          </section>

          {/* Contact Information */}
          <section className="bg-surface rounded-xl p-6 border border-border">
            <h2 className="text-2xl font-bold text-gold mb-4">6. Contact Information</h2>
            <p className="text-text-secondary leading-relaxed mb-4">
              If you have any questions about this Privacy Policy or wish to exercise your data protection rights, please contact us:
            </p>
            <div className="bg-surfaceLight rounded-lg p-4 border border-border">
              <p className="text-text-secondary">
                <strong className="text-gold">Privacy Officer:</strong> privacy@sirshopalot.com
              </p>
              <p className="text-text-secondary mt-2">
                <strong className="text-gold">Support:</strong> support@sirshopalot.com
              </p>
              <p className="text-text-secondary mt-2">
                <strong className="text-gold">Data Protection Requests:</strong> dpo@sirshopalot.com
              </p>
            </div>
            <p className="text-text-secondary leading-relaxed mt-4">
              You have the right to access, correct, or delete your personal information, as well as the right 
              to object to or restrict certain processing activities. To exercise these rights, please contact us using the information above.
            </p>
          </section>

          {/* Footer Links */}
          <div className="flex gap-4 justify-center pt-8 border-t border-border">
            <Link href="/terms" className="text-gold hover:text-gold/80 underline">
              Terms & Conditions
            </Link>
            <span className="text-text-muted">|</span>
            <Link href="/" className="text-gold hover:text-gold/80 underline">
              Home
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

