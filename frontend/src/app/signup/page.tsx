'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { signup, getCurrentUser } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

export default function SignupPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<'vendor' | 'reseller' | 'customer' | 'delivery' | 'admin' | 'affiliate'>('reseller');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    rememberMe: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const roles = [
    { id: 'vendor', label: 'Vendor', backendRole: 'supplier' },
    { id: 'reseller', label: 'Reseller', backendRole: 'reseller' },
    { id: 'customer', label: 'Customer', backendRole: 'reseller' },
    { id: 'delivery', label: 'Delivery', backendRole: 'reseller' },
    { id: 'admin', label: 'Admin', backendRole: 'admin' },
    { id: 'affiliate', label: 'Affiliate', backendRole: 'reseller' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword) {
      setErrors({ submit: 'All fields are required' });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setErrors({ submit: 'Passwords do not match' });
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const selectedRoleData = roles.find(r => r.id === selectedRole);
      const backendRole = selectedRoleData?.backendRole || 'reseller';

      // Only reseller can self-register
      // Admin and supplier accounts must be created by an admin
      if (backendRole === 'admin' || backendRole === 'supplier') {
        setErrors({ submit: 'Admin and supplier accounts can only be created by existing admins. Please contact support or register as a reseller.' });
        setIsSubmitting(false);
        return;
      }

      const response = await signup({
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        role: backendRole,
      });

      if (response.success) {
        // Show success message and redirect to login
        // Registration does NOT auto-login per requirements
        router.push('/login?registered=true');
      } else {
        setErrors({ submit: response.message || 'Registration failed' });
      }
    } catch (error: any) {
      setErrors({ submit: error.message || 'An error occurred during registration' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGuestClick = () => {
    // Set guest flag in sessionStorage for better UX
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('guest', 'true');
    }
    router.push('/');
  };

  const handleCreateStoreClick = () => {
    const user = getCurrentUser();
    
    if (!user) {
      // Not logged in - redirect to login
      router.push('/login');
      return;
    }

    // Check role
    if (user.role === 'reseller') {
      router.push('/create-store');
    } else if (user.role === 'admin' || user.role === 'supplier') {
      // Show permission message
      setErrors({ submit: 'Only resellers can create stores. Please login as a reseller.' });
    } else {
      router.push('/create-store');
    }
  };

  const handleGoogleLogin = () => {
    // For now, show a message that Google login is coming soon
    // In production, this would redirect to Google OAuth
    setErrors({ submit: 'Google login is coming soon. Please use email and password to sign up.' });
    
    // TODO: Implement Google OAuth
    // Example: window.location.href = '/api/auth/google';
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Section - Marketing */}
      <div className="hidden lg:flex lg:w-1/2 bg-background p-12 flex-col justify-between relative">
        {/* E-Commerce Hub Icon */}
        <div className="absolute top-8 right-8 flex flex-col items-center">
          <div className="w-12 h-12 bg-[#8B4513] rounded-lg flex items-center justify-center mb-2">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20 6h-2.18c.11-.31.18-.65.18-1a2.996 2.996 0 0 0-5.5-1.65l-.5.67-.5-.68C10.96 2.54 10 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z"/>
            </svg>
          </div>
          <span className="text-text-secondary text-xs">E-Commerce Hub</span>
        </div>

        <div>
          {/* Brand */}
          <h1 className="text-gold text-2xl font-bold mb-12">Sir ShopAlot</h1>
          
          {/* Headline */}
          <h2 className="text-text-primary text-[56px] font-bold mb-6 leading-tight">
            Sell smarter.<br />Ship faster.
          </h2>
          
          {/* Description */}
          <p className="text-text-secondary text-lg mb-8 leading-relaxed">
            A single marketplace for vendors, resellers, delivery partners, and customers. Built for scale and speed.
          </p>
          
          {/* Features */}
          <ul className="space-y-4 mb-12">
            <li className="flex items-start text-text-secondary">
              <span className="text-gold mr-3 text-xl">•</span>
              <span>Multi-vendor store management</span>
            </li>
            <li className="flex items-start text-text-secondary">
              <span className="text-gold mr-3 text-xl">•</span>
              <span>Fast order routing & delivery</span>
            </li>
            <li className="flex items-start text-text-secondary">
              <span className="text-gold mr-3 text-xl">•</span>
              <span>Reseller & affiliate tools</span>
            </li>
            <li className="flex items-start text-text-secondary">
              <span className="text-gold mr-3 text-xl">•</span>
              <span>Secure payments & analytics</span>
            </li>
          </ul>
          
          {/* CTA Buttons */}
          <div className="flex gap-4 mb-12">
            <Button variant="primary" size="lg" glow>
              Get started
            </Button>
            <Button variant="secondary" size="lg">
              Learn more
            </Button>
          </div>
        </div>
        
        {/* Stats */}
        <div className="flex gap-8 text-text-secondary">
          <div>
            <div className="text-2xl font-bold text-text-primary">500+</div>
            <div className="text-sm">Active vendors</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-text-primary">2M+</div>
            <div className="text-sm">Monthly visits</div>
          </div>
        </div>
      </div>

      {/* Right Section - Signup Form */}
      <div className="w-full lg:w-1/2 bg-surface p-8 lg:p-12 flex flex-col justify-center">
        <Card glass className="max-w-md mx-auto w-full p-8">
          {/* Title */}
          <h3 className="text-text-primary text-[36px] font-bold mb-2">Create account</h3>
          <p className="text-text-secondary mb-8">Sign up to get started</p>

          {/* Role Tabs */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {roles.map((role) => (
              <motion.button
                key={role.id}
                onClick={() => setSelectedRole(role.id as any)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors',
                  selectedRole === role.id
                    ? 'bg-gold text-background'
                    : 'bg-surfaceLight text-text-secondary hover:bg-[#242424]'
                )}
              >
                {role.label}
              </motion.button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <Input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Full name"
              autoComplete="name"
            />

            {/* Email */}
            <Input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="you@company.com"
              autoComplete="email"
            />

            {/* Password */}
            <Input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Password"
              autoComplete="new-password"
            />

            {/* Confirm Password */}
            <Input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              placeholder="Confirm password"
              autoComplete="new-password"
            />

            {/* Remember Me */}
            <div className="flex items-center">
              <label className="flex items-center text-text-secondary text-sm">
                <input
                  type="checkbox"
                  id="rememberMe"
                  name="rememberMe"
                  checked={formData.rememberMe}
                  onChange={(e) => setFormData({ ...formData, rememberMe: e.target.checked })}
                  className="mr-2 w-4 h-4 rounded border-border bg-background text-primary focus:ring-gold"
                />
                Remember me
              </label>
            </div>

            {/* Error Message */}
            {errors.submit && (
              <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                {errors.submit}
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              glow
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? 'Creating account...' : `Sign up as ${selectedRole}`}
            </Button>
          </form>

          {/* Login Link */}
          <div className="mt-6 text-center">
            <span className="text-text-secondary text-sm">Already have an account? </span>
            <a href="/login" className="text-gold text-sm font-semibold hover:underline">
              Sign in
            </a>
          </div>

          {/* Social Login */}
          <div className="mt-8 space-y-3">
            <Button 
              variant="dark" 
              size="md" 
              className="w-full flex items-center justify-center gap-2"
              onClick={handleGoogleLogin}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google
            </Button>
            <Button variant="dark" size="md" className="w-full flex items-center justify-center gap-2">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.96-3.24-1.44-1.56-.62-2.7-1.08-3.36-1.94-1.03-1.25-1.25-2.7-1.25-4.28 0-1.58.22-3.03 1.25-4.28.66-.86 1.8-1.32 3.36-1.94 1.16-.48 2.15-.94 3.24-1.44 1.03-.48 2.1-.55 3.08.4 1.01.98 1.01 2.4 0 3.38-.5.48-1.1.88-1.75 1.2-.65.33-1.35.6-2.05.8-.7.2-1.4.35-2.1.45-.7.1-1.4.15-2.1.15s-1.4-.05-2.1-.15c-.7-.1-1.4-.25-2.1-.45-.7-.2-1.4-.47-2.05-.8-.65-.32-1.25-.72-1.75-1.2-1.01-.98-1.01-2.4 0-3.38.98-.95 2.05-.88 3.08-.4 1.09.5 2.08.96 3.24 1.44 1.56.62 2.7 1.08 3.36 1.94 1.03 1.25 1.25 2.7 1.25 4.28 0 1.58-.22 3.03-1.25 4.28-.66.86-1.8 1.32-3.36 1.94-1.16.48-2.15.94-3.24 1.44-1.03.48-2.1.55-3.08-.4-1.01-.98-1.01-2.4 0-3.38.5-.48 1.1-.88 1.75-1.2.65-.33 1.35-.6 2.05-.8.7-.2 1.4-.35 2.1-.45.7-.1 1.4-.15 2.1-.15s1.4.05 2.1.15c.7.1 1.4.25 2.1.45.7.2 1.4.47 2.05.8.65.32 1.25.72 1.75 1.2 1.01.98 1.01 2.4 0 3.38z"/>
              </svg>
              Apple
            </Button>
          </div>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-surface text-text-muted">or</span>
            </div>
          </div>

          {/* Guest & Create Store */}
          <div className="flex gap-3">
            <Button 
              variant="dark" 
              size="md" 
              className="flex-1"
              onClick={handleGuestClick}
            >
              Guest
            </Button>
            <Button 
              variant="secondary" 
              size="md" 
              className="flex-1"
              onClick={handleCreateStoreClick}
            >
              Create store
            </Button>
          </div>

          {/* Terms */}
          <p className="mt-8 text-xs text-text-muted text-center">
            By continuing you agree to Sir ShopAlot's{' '}
            <a href="/terms" className="text-gold hover:underline">Terms</a> and{' '}
            <a href="/privacy" className="text-gold hover:underline">Privacy Policy</a>.
          </p>
        </Card>
      </div>
    </div>
  );
}
