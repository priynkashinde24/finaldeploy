'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function TermsPage() {
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
            Terms & Conditions
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
          {/* Introduction */}
          <section className="bg-surface rounded-xl p-6 border border-border">
            <h2 className="text-2xl font-bold text-gold mb-4">1. Introduction</h2>
            <p className="text-text-secondary leading-relaxed">
              Welcome to Sir ShopAlot. These Terms & Conditions ("Terms") govern your use of our platform, 
              services, and website. By accessing or using Sir ShopAlot, you agree to be bound by these Terms. 
              If you do not agree with any part of these Terms, you must not use our services.
            </p>
          </section>

          {/* User Responsibilities */}
          <section className="bg-surface rounded-xl p-6 border border-border">
            <h2 className="text-2xl font-bold text-gold mb-4">2. User Responsibilities</h2>
            <p className="text-text-secondary leading-relaxed mb-4">
              As a user of Sir ShopAlot, you agree to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-text-secondary ml-4">
              <li>Provide accurate and complete information when creating an account</li>
              <li>Maintain the security of your account credentials</li>
              <li>Use the platform in compliance with all applicable laws and regulations</li>
              <li>Not engage in any fraudulent, abusive, or illegal activities</li>
              <li>Respect the intellectual property rights of others</li>
              <li>Not attempt to gain unauthorized access to any part of the platform</li>
            </ul>
          </section>

          {/* Account Usage */}
          <section className="bg-surface rounded-xl p-6 border border-border">
            <h2 className="text-2xl font-bold text-gold mb-4">3. Account Usage</h2>
            <p className="text-text-secondary leading-relaxed mb-4">
              Your account is personal and non-transferable. You are responsible for:
            </p>
            <ul className="list-disc list-inside space-y-2 text-text-secondary ml-4">
              <li>All activities that occur under your account</li>
              <li>Maintaining the confidentiality of your password</li>
              <li>Notifying us immediately of any unauthorized use</li>
              <li>Ensuring your account information is kept up to date</li>
            </ul>
            <p className="text-text-secondary leading-relaxed mt-4">
              We reserve the right to suspend or terminate accounts that violate these Terms or engage in 
              fraudulent activities.
            </p>
          </section>

          {/* Payments & Refunds */}
          <section className="bg-surface rounded-xl p-6 border border-border">
            <h2 className="text-2xl font-bold text-gold mb-4">4. Payments & Refunds</h2>
            <p className="text-text-secondary leading-relaxed mb-4">
              Payment terms and refund policies:
            </p>
            <ul className="list-disc list-inside space-y-2 text-text-secondary ml-4">
              <li>All payments must be made through our secure payment gateway</li>
              <li>Prices are subject to change without prior notice</li>
              <li>Refunds are processed according to our refund policy, available upon request</li>
              <li>Chargebacks may result in account suspension</li>
              <li>Transaction fees may apply and are non-refundable</li>
            </ul>
            <p className="text-text-secondary leading-relaxed mt-4">
              For specific refund requests, please contact our support team with your order details.
            </p>
          </section>

          {/* Limitation of Liability */}
          <section className="bg-surface rounded-xl p-6 border border-border">
            <h2 className="text-2xl font-bold text-gold mb-4">5. Limitation of Liability</h2>
            <p className="text-text-secondary leading-relaxed mb-4">
              To the maximum extent permitted by law:
            </p>
            <ul className="list-disc list-inside space-y-2 text-text-secondary ml-4">
              <li>Sir ShopAlot is provided "as is" without warranties of any kind</li>
              <li>We are not liable for any indirect, incidental, or consequential damages</li>
              <li>Our total liability shall not exceed the amount you paid in the 12 months preceding the claim</li>
              <li>We do not guarantee uninterrupted or error-free service</li>
            </ul>
            <p className="text-text-secondary leading-relaxed mt-4">
              Some jurisdictions do not allow the exclusion of certain warranties or limitations of liability, 
              so some of the above may not apply to you.
            </p>
          </section>

          {/* Contact Information */}
          <section className="bg-surface rounded-xl p-6 border border-border">
            <h2 className="text-2xl font-bold text-gold mb-4">6. Contact Information</h2>
            <p className="text-text-secondary leading-relaxed mb-4">
              If you have any questions about these Terms & Conditions, please contact us:
            </p>
            <div className="bg-surfaceLight rounded-lg p-4 border border-border">
              <p className="text-text-secondary">
                <strong className="text-gold">Email:</strong> legal@sirshopalot.com
              </p>
              <p className="text-text-secondary mt-2">
                <strong className="text-gold">Support:</strong> support@sirshopalot.com
              </p>
            </div>
          </section>

          {/* Footer Links */}
          <div className="flex gap-4 justify-center pt-8 border-t border-border">
            <Link href="/privacy" className="text-gold hover:text-gold/80 underline">
              Privacy Policy
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

