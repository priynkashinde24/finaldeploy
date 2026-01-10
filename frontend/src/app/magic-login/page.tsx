'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { magicLogin } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { motion } from 'framer-motion';

function MagicLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Invalid magic link. Token is missing.');
      setLoading(false);
      return;
    }

    const login = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('[MAGIC LOGIN PAGE] Attempting magic login with token');
        
        const response = await magicLogin(token);

        if (response.success && response.data?.user) {
          setSuccess(true);
          const role = response.data.user.role as 'admin' | 'supplier' | 'reseller' | 'affiliate' | string;
          setUserRole(role);
          console.log('[MAGIC LOGIN PAGE] Magic login successful:', { role });

          // Redirect based on role - use hard redirect for admins and affiliates
          let redirectPath = '/';
          if (role === 'admin') {
            redirectPath = '/admin';
            // Use window.location for immediate hard redirect
            if (typeof window !== 'undefined') {
              console.log('[MAGIC LOGIN PAGE] Using window.location.href for hard redirect to /admin');
              window.location.href = '/admin';
              return; // Exit early since we're doing hard redirect
            }
          } else if (role === 'supplier') {
            redirectPath = '/supplier';
          } else if (role === 'affiliate') {
            // For affiliates, redirect to affiliate dashboard - use hard redirect
            redirectPath = '/affiliate';
            // Use window.location for immediate hard redirect
            if (typeof window !== 'undefined') {
              window.location.href = '/affiliate';
              return; // Exit early since we're doing hard redirect
            }
          } else if (role === 'reseller') {
            // For resellers, redirect to reseller dashboard
            redirectPath = '/reseller';
          } else {
            // For customer/delivery, redirect to dashboard which will determine the correct page
            redirectPath = '/dashboard';
          }

          // Redirect after 2 seconds
          setTimeout(() => {
            router.push(redirectPath);
          }, 2000);
        } else {
          setError(response.message || 'Invalid or expired magic link');
        }
      } catch (err: any) {
        console.error('[MAGIC LOGIN PAGE] Magic login error:', err);
        setError(err.message || 'Failed to login with magic link');
      } finally {
        setLoading(false);
      }
    };

    login();
  }, [token, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-text-secondary">Logging you in...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="mb-6"
            >
              <div className="w-20 h-20 bg-accent/20 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-12 h-12 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </motion.div>
            <h2 className="text-2xl font-bold text-white mb-4">Login Successful!</h2>
            <p className="text-text-secondary mb-6">
              You've been logged in successfully. Redirecting to your dashboard...
            </p>
            <Button 
              variant="primary" 
              onClick={() => {
                if (userRole === 'admin') {
                  router.push('/admin');
                } else if (userRole === 'supplier') {
                  router.push('/supplier');
                } else {
                  // For reseller/customer/delivery, redirect to dashboard which will determine the correct page
                  router.push('/dashboard');
                }
              }} 
              glow
            >
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center">
          <div className="mb-4">
            <svg className="w-16 h-16 text-red-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">Login Failed</h2>
          <p className="text-text-secondary mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <Button variant="primary" onClick={() => router.push('/login')} glow>
              Go to Login
            </Button>
            <Button variant="secondary" onClick={() => router.push('/')}>
              Go Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function MagicLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-text-secondary">Loading...</p>
          </CardContent>
        </Card>
      </div>
    }>
      <MagicLoginContent />
    </Suspense>
  );
}

