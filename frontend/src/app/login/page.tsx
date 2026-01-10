'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { login, getCurrentUser, sendMagicLink, sendOTP, verifyOTP } from '@/lib/auth';
import { sendVerificationEmail } from '@/lib/emailVerification';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<'vendor' | 'reseller' | 'customer' | 'delivery' | 'admin' | 'affiliate'>('vendor');
  const [loginMethod, setLoginMethod] = useState<'password' | 'phone' | 'magic'>('password');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [magicLinkEmail, setMagicLinkEmail] = useState('');
  const [sendingMagicLink, setSendingMagicLink] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [otpPhone, setOtpPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [sendingOTP, setSendingOTP] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [verifyingOTP, setVerifyingOTP] = useState(false);

  const roles = [
    { id: 'vendor', label: 'Vendor' },
    { id: 'reseller', label: 'Reseller' },
    { id: 'customer', label: 'Customer' },
    { id: 'delivery', label: 'Delivery' },
    { id: 'admin', label: 'Admin' },
    { id: 'affiliate', label: 'Affiliate' },
  ];

  const loginMethods = [
    { id: 'password', label: 'Password', enabled: true },
    { id: 'phone', label: 'Phone OTP', enabled: true },
    { id: 'magic', label: 'Magic Link', enabled: true },
  ];

  // Ensure loginMethod is always set to an enabled method
  useEffect(() => {
    const currentMethod = loginMethods.find(m => m.id === loginMethod);
    if (currentMethod && !currentMethod.enabled) {
      setLoginMethod('password');
    }
  }, [loginMethod]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevent default form submission

    if (!formData.email || !formData.password) {
      setErrors({ submit: 'Email and password are required' });
      return;
    }

    setIsSubmitting(true);
    setErrors({});
    setShowResendVerification(false);

    try {
      console.log('[LOGIN PAGE] Submitting login form:', { email: formData.email });
      const response = await login(formData.email, formData.password);
      console.log('[LOGIN PAGE] Login response:', { success: response.success, hasData: !!response.data, message: response.message });

      if (response.success && response.data && response.data.user) {
        const role = response.data.user.role as 'admin' | 'supplier' | 'reseller' | 'affiliate' | string;
        console.log('[LOGIN PAGE] ========================================');
        console.log('[LOGIN PAGE] ✅ Login successful!');
        console.log('[LOGIN PAGE] User role from backend:', role);
        console.log('[LOGIN PAGE] Role type:', typeof role);
        console.log('[LOGIN PAGE] Role comparison (affiliate):', role === 'affiliate');
        console.log('[LOGIN PAGE] Role comparison (reseller):', role === 'reseller');
        console.log('[LOGIN PAGE] Full user object:', JSON.stringify(response.data.user, null, 2));
        console.log('[LOGIN PAGE] ========================================');
        
        // Redirect based on role - use hard redirect for admins and affiliates
        if (role === 'admin') {
          console.log('[LOGIN PAGE] ✅✅✅ ADMIN DETECTED - Redirecting to /admin ✅✅✅');
          // Use window.location for immediate hard redirect
          if (typeof window !== 'undefined') {
            console.log('[LOGIN PAGE] Using window.location.href for hard redirect to /admin');
            window.location.href = '/admin';
            return; // Exit early since we're doing hard redirect
          } else {
            router.replace('/admin');
          }
        } else if (role === 'supplier') {
          console.log('[LOGIN PAGE] ✅✅✅ SUPPLIER DETECTED - Redirecting to /supplier ✅✅✅');
          // Use window.location for immediate hard redirect
          if (typeof window !== 'undefined') {
            console.log('[LOGIN PAGE] Using window.location.href for hard redirect to /supplier');
            window.location.href = '/supplier';
            return; // Exit early since we're doing hard redirect
          } else {
            router.replace('/supplier');
          }
        } else if (role === 'affiliate') {
          // For affiliates, redirect to affiliate dashboard - use hard redirect
          console.log('[LOGIN PAGE] ✅✅✅ AFFILIATE DETECTED - Redirecting to /affiliate ✅✅✅');
          // Use window.location for immediate hard redirect
          if (typeof window !== 'undefined') {
            console.log('[LOGIN PAGE] Using window.location.href for hard redirect to /affiliate');
            window.location.href = '/affiliate';
            return; // Exit early since we're doing hard redirect
          } else {
            router.replace('/affiliate');
          }
        } else if (role === 'reseller') {
          // For resellers, redirect to reseller dashboard
          console.log('[LOGIN PAGE] ⚠️⚠️⚠️ RESELLER DETECTED (not affiliate) ⚠️⚠️⚠️');
          console.log('[LOGIN PAGE] If this user should be an affiliate, update their role in the database!');
          console.log('[LOGIN PAGE] → Redirecting reseller to /reseller');
          router.replace('/reseller');
        } else {
          // For customer/delivery, redirect to dashboard which will determine the correct page
          console.log('[LOGIN PAGE] Unknown role:', role, '- Redirecting to /dashboard');
          router.replace('/dashboard');
        }
      } else {
        // Login failed - show backend error message
        const errorMessage = response.message || 'Invalid email or password';
        console.error('[LOGIN PAGE] Login failed:', errorMessage);
        setErrors({ submit: errorMessage });
        
        // Show resend verification if email not verified
        if (errorMessage.includes('verify your email') || errorMessage.includes('email to continue') || errorMessage.includes('Please verify')) {
          setShowResendVerification(true);
        }
      }
    } catch (error: any) {
      console.error('[LOGIN PAGE] Login error:', error);
      const errorMessage = error.message || error.response?.data?.message || 'An error occurred during login';
      setErrors({ submit: errorMessage });
      setShowResendVerification(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    if (!formData.email) {
      setErrors({ submit: 'Please enter your email first' });
      return;
    }

    try {
      setResending(true);
      setResendSuccess(false);
      setErrors({});

      const response = await sendVerificationEmail(formData.email);

      if (response.success) {
        setResendSuccess(true);
        setShowResendVerification(false);
        setTimeout(() => setResendSuccess(false), 5000);
      } else {
        setErrors({ submit: response.message || 'Failed to resend verification email' });
      }
    } catch (error: any) {
      setErrors({ submit: error.message || 'Failed to resend verification email' });
    } finally {
      setResending(false);
    }
  };

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!magicLinkEmail) {
      setErrors({ submit: 'Email is required' });
      return;
    }

    setSendingMagicLink(true);
    setErrors({});
    setMagicLinkSent(false);

    try {
      console.log('[LOGIN PAGE] Sending magic link:', { email: magicLinkEmail });
      const response = await sendMagicLink(magicLinkEmail);
      console.log('[LOGIN PAGE] Magic link response:', { success: response.success, message: response.message });

      if (response.success) {
        setMagicLinkSent(true);
        setMagicLinkEmail('');
        setTimeout(() => setMagicLinkSent(false), 10000); // Hide after 10 seconds
      } else {
        setErrors({ submit: response.message || 'Failed to send magic link' });
      }
    } catch (error: any) {
      console.error('[LOGIN PAGE] Magic link error:', error);
      setErrors({ submit: error.message || 'Failed to send magic link' });
    } finally {
      setSendingMagicLink(false);
    }
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!otpPhone) {
      setErrors({ submit: 'Phone number is required' });
      return;
    }

    setSendingOTP(true);
    setErrors({});
    setOtpSent(false);

    try {
      console.log('[LOGIN PAGE] Sending OTP:', { phone: otpPhone });
      const response = await sendOTP(otpPhone);
      console.log('[LOGIN PAGE] OTP send response:', { success: response.success, message: response.message });

      if (response.success) {
        setOtpSent(true);
        setTimeout(() => setOtpSent(false), 300000); // Hide after 5 minutes
      } else {
        setErrors({ submit: response.message || 'Failed to send OTP' });
      }
    } catch (error: any) {
      console.error('[LOGIN PAGE] OTP send error:', error);
      setErrors({ submit: error.message || 'Failed to send OTP' });
    } finally {
      setSendingOTP(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!otpPhone || !otpCode) {
      setErrors({ submit: 'Phone number and OTP code are required' });
      return;
    }

    setVerifyingOTP(true);
    setErrors({});

    try {
      console.log('[LOGIN PAGE] Verifying OTP:', { phone: otpPhone });
      const response = await verifyOTP(otpPhone, otpCode);
      console.log('[LOGIN PAGE] OTP verify response:', { success: response.success, message: response.message });

      if (response.success && response.data?.user) {
        const user = response.data.user;
        console.log('[LOGIN PAGE] OTP login successful:', { userId: user.id, role: user.role });

        // Redirect based on role
        if (user.role === 'admin') {
          router.push('/admin');
        } else if (user.role === 'supplier') {
          router.push('/supplier');
        } else {
          // For reseller/customer/delivery, redirect to dashboard which will determine the correct page
          router.push('/dashboard');
        }
      } else {
        setErrors({ submit: response.message || 'OTP verification failed' });
      }
    } catch (error: any) {
      console.error('[LOGIN PAGE] OTP verify error:', error);
      setErrors({ submit: error.message || 'OTP verification failed' });
    } finally {
      setVerifyingOTP(false);
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
    setErrors({ submit: 'Google login is coming soon. Please use email and password to login.' });
    
    // TODO: Implement Google OAuth
    // Example: window.location.href = '/api/auth/google';
  };

  const handleGetStarted = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    console.log('[LOGIN] Get Started clicked');
    router.push('/signup');
  };

  const handleLearnMore = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    console.log('[LOGIN] Learn More clicked');
    router.push('/features');
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Section - Marketing */}
      <div className="hidden lg:flex lg:w-1/2 bg-background p-12 flex-col justify-between relative">
        {/* E-Commerce Hub Icon - Modernized with new colors */}
        <div className="absolute top-8 right-8 flex flex-col items-center">
          <div className="w-12 h-12 bg-gradient-to-br from-primary to-gold rounded-xl flex items-center justify-center mb-2 shadow-lg glow-primary">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20 6h-2.18c.11-.31.18-.65.18-1a2.996 2.996 0 0 0-5.5-1.65l-.5.67-.5-.68C10.96 2.54 10 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z"/>
            </svg>
          </div>
          <span className="text-secondary-offWhite text-xs font-medium">E-Commerce Hub</span>
        </div>

        <div>
          {/* Brand - Modernized */}
          <h1 className="text-gold text-3xl font-bold mb-12 bg-gradient-to-r from-gold to-accent bg-clip-text text-transparent">
            Sir ShopAlot
          </h1>
          
          {/* Headline - Enhanced with gradient */}
          <h2 className="text-text-primary text-[56px] font-bold mb-6 leading-tight">
            Sell smarter.<br />
            <span className="bg-gradient-to-r from-primary via-gold to-accent bg-clip-text text-transparent">
              Ship faster.
            </span>
          </h2>
          
          {/* Description */}
          <p className="text-secondary-offWhite text-lg mb-8 leading-relaxed">
            A single marketplace for vendors, resellers, delivery partners, and customers. Built for scale and speed.
          </p>
          
          {/* Features - Modernized with accent colors */}
          <ul className="space-y-4 mb-12">
            <li className="flex items-start text-secondary-offWhite group">
              <span className="text-accent mr-3 text-xl group-hover:text-turquoise transition-colors">•</span>
              <span className="group-hover:text-white transition-colors">Multi-vendor store management</span>
            </li>
            <li className="flex items-start text-secondary-offWhite group">
              <span className="text-accent mr-3 text-xl group-hover:text-turquoise transition-colors">•</span>
              <span className="group-hover:text-white transition-colors">Fast order routing & delivery</span>
            </li>
            <li className="flex items-start text-secondary-offWhite group">
              <span className="text-accent mr-3 text-xl group-hover:text-turquoise transition-colors">•</span>
              <span className="group-hover:text-white transition-colors">Reseller & affiliate tools</span>
            </li>
            <li className="flex items-start text-secondary-offWhite group">
              <span className="text-accent mr-3 text-xl group-hover:text-turquoise transition-colors">•</span>
              <span className="group-hover:text-white transition-colors">Secure payments & analytics</span>
            </li>
          </ul>
          
          {/* CTA Buttons */}
          <div className="flex gap-4 mb-12">
            <Button 
              variant="primary" 
              size="lg" 
              glow 
              type="button"
              onClick={handleGetStarted}
            >
              Get started
            </Button>
            <Button 
              variant="secondary" 
              size="lg" 
              type="button"
              onClick={handleLearnMore}
            >
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

      {/* Right Section - Login Form */}
      <div className="w-full lg:w-1/2 bg-surface p-8 lg:p-12 flex flex-col justify-center">
        <Card glass className="max-w-md mx-auto w-full p-8">
          {/* Title */}
          <h3 className="text-text-primary text-[36px] font-bold mb-2">Welcome back</h3>
          <p className="text-text-secondary mb-8">Sign in to your vendor account</p>

          {/* Role Tabs - Modernized */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {roles.map((role) => (
              <motion.button
                key={role.id}
                onClick={() => setSelectedRole(role.id as any)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  'px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-300',
                  selectedRole === role.id
                    ? 'bg-gold text-background shadow-lg'
                    : 'bg-gold/20 text-secondary-offWhite hover:bg-gold/30 border border-gold/50'
                )}
              >
                {role.label}
              </motion.button>
            ))}
          </div>

          {/* Login Method Tabs - Modernized */}
          <div className="flex gap-2 mb-6">
            {loginMethods.map((method) => {
              const isDisabled = !method.enabled;
              const isSelected = loginMethod === method.id;
              
              return (
                <motion.button
                  key={method.id}
                  onClick={() => {
                    if (!isDisabled) {
                      setLoginMethod(method.id as any);
                    }
                  }}
                  whileHover={!isDisabled ? { scale: 1.05 } : undefined}
                  whileTap={!isDisabled ? { scale: 0.95 } : undefined}
                  disabled={isDisabled}
                  className={cn(
                    'px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 relative',
                    isDisabled
                      ? 'bg-surfaceLight/50 text-text-muted cursor-not-allowed opacity-60 border border-border/50'
                      : isSelected
                      ? 'bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg glow-primary'
                      : 'bg-surfaceLight text-secondary-offWhite hover:bg-surfaceLight/80 hover:text-white border border-border'
                  )}
                  title={isDisabled ? 'Coming soon' : undefined}
                >
                  {method.label}
                  {isDisabled && (
                    <span className="absolute -top-1 -right-1 text-[10px] text-gold bg-background px-1 rounded">
                      Soon
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Form */}
          {loginMethod === 'password' && (
            <form onSubmit={handleSubmit} className="space-y-4">
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
                autoComplete="current-password"
              />

              {/* Remember Me & Forgot */}
              <div className="flex items-center justify-between">
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
                <div className="flex gap-2">
                  <Link href="/forgot-password" className="text-gold text-sm hover:underline">
                    Forgot?
                  </Link>
                  <span className="text-text-muted">|</span>
                  <Link href="/signup" className="text-gold text-sm hover:underline">
                    Sign up
                  </Link>
                </div>
              </div>

              {/* Error Message - Modernized */}
              {errors.submit && (
                <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-xl p-4 backdrop-blur-sm">
                  {errors.submit}
                  {showResendVerification && (
                    <div className="mt-3 pt-3 border-t border-red-500/20">
                      <p className="text-text-secondary text-xs mb-2">Email not verified</p>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleResendVerification}
                        disabled={resending}
                        className="w-full"
                      >
                        {resending ? 'Sending...' : 'Resend verification email'}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Resend Success Message - Modernized */}
              {resendSuccess && (
                <div className="text-accent text-sm bg-accent/10 border border-accent/30 rounded-xl p-4 backdrop-blur-sm glow-turquoise">
                  Verification email sent! Please check your inbox.
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
                {isSubmitting ? 'Signing in...' : `Continue as ${selectedRole}`}
              </Button>
            </form>
          )}

          {/* Magic Link Form */}
          {loginMethod === 'magic' && (
            <form onSubmit={handleSendMagicLink} className="space-y-4">
              {/* Email */}
              <Input
                type="email"
                id="magicLinkEmail"
                name="magicLinkEmail"
                value={magicLinkEmail}
                onChange={(e) => setMagicLinkEmail(e.target.value)}
                placeholder="you@company.com"
                disabled={sendingMagicLink || magicLinkSent}
                autoComplete="email"
              />

              {/* Error Message */}
              {errors.submit && (
                <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-xl p-4 backdrop-blur-sm">
                  {errors.submit}
                </div>
              )}

              {/* Success Message */}
              {magicLinkSent && (
                <div className="text-accent text-sm bg-accent/10 border border-accent/30 rounded-xl p-4 backdrop-blur-sm glow-turquoise">
                  Magic link sent! Please check your email. The link expires in 15 minutes.
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                glow
                disabled={sendingMagicLink || magicLinkSent}
                className="w-full"
              >
                {sendingMagicLink ? 'Sending...' : magicLinkSent ? 'Link Sent!' : 'Send Magic Link'}
              </Button>

              {/* Sign up link */}
              <div className="text-center">
                <Link href="/signup" className="text-gold text-sm hover:underline">
                  Don't have an account? Sign up
                </Link>
              </div>
            </form>
          )}

          {/* Phone OTP Form */}
          {loginMethod === 'phone' && (
            <div className="space-y-4">
              {!otpSent ? (
                <form onSubmit={handleSendOTP} className="space-y-4">
                  {/* Phone Number */}
                  <Input
                    type="tel"
                    id="otpPhone"
                    name="otpPhone"
                    value={otpPhone}
                    onChange={(e) => setOtpPhone(e.target.value)}
                    placeholder="+1234567890"
                    disabled={sendingOTP}
                    autoComplete="tel"
                  />

                  {/* Error Message */}
                  {errors.submit && (
                    <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-xl p-4 backdrop-blur-sm">
                      {errors.submit}
                    </div>
                  )}

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    glow
                    disabled={sendingOTP}
                    className="w-full"
                  >
                    {sendingOTP ? 'Sending...' : 'Send OTP'}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOTP} className="space-y-4">
                  {/* Phone Number (read-only) */}
                  <Input
                    type="tel"
                    id="otpPhoneDisplay"
                    name="otpPhoneDisplay"
                    value={otpPhone}
                    disabled
                    className="opacity-60"
                    autoComplete="tel"
                  />

                  {/* OTP Code */}
                  <Input
                    type="text"
                    id="otpCode"
                    name="otpCode"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter 6-digit OTP"
                    disabled={verifyingOTP}
                    maxLength={6}
                    className="text-center text-2xl tracking-widest"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                  />

                  {/* Error Message */}
                  {errors.submit && (
                    <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-xl p-4 backdrop-blur-sm">
                      {errors.submit}
                    </div>
                  )}

                  {/* Success Message */}
                  {otpSent && (
                    <div className="text-accent text-sm bg-accent/10 border border-accent/30 rounded-xl p-4 backdrop-blur-sm glow-turquoise">
                      OTP sent! Please check your phone. The code expires in 5 minutes.
                    </div>
                  )}

                  {/* Verify Button */}
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    glow
                    disabled={verifyingOTP || !otpCode || otpCode.length !== 6}
                    className="w-full"
                  >
                    {verifyingOTP ? 'Verifying...' : 'Verify OTP'}
                  </Button>

                  {/* Resend OTP */}
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setOtpSent(false);
                        setOtpCode('');
                        setErrors({});
                      }}
                      className="text-gold text-sm hover:underline"
                    >
                      Resend OTP
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Social Login */}
          <div className="mt-8 flex gap-3">
            <Button 
              variant="dark" 
              size="md" 
              className="flex-1 flex items-center justify-center gap-2 text-white"
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
            <Button 
              variant="dark" 
              size="md" 
              className="flex-1 flex items-center justify-center gap-2 text-white"
            >
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

          {/* Guest & Create Store - Modernized */}
          <div className="flex gap-3">
            <Button 
              variant="dark" 
              size="md" 
              className="flex-1 hover:bg-surfaceLight/90 transition-all duration-300 border border-border hover:border-secondary-softBlue"
              onClick={handleGuestClick}
            >
              Guest
            </Button>
            <Button 
              variant="secondary" 
              size="md" 
              className="flex-1 bg-transparent"
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
