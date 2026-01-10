'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { validateInvite, acceptInvite } from '@/lib/invites';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

function InviteAcceptContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteData, setInviteData] = useState<{
    email: string;
    role: 'supplier' | 'reseller';
  } | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    password: '',
    confirmPassword: '',
  });

  // Validate invite token on mount
  useEffect(() => {
    if (!token) {
      setError('Invalid invite link. Token is missing.');
      setLoading(false);
      return;
    }

    const validate = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await validateInvite(token);

        if (response.success && response.data) {
          setInviteData({
            email: response.data.email,
            role: response.data.role,
          });
        } else {
          setError(response.message || 'Invalid or expired invite');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to validate invite');
      } finally {
        setLoading(false);
      }
    };

    validate();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      setError('Invalid invite link');
      return;
    }

    if (!formData.name || !formData.password || !formData.confirmPassword) {
      setError('All fields are required');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      setValidating(true);
      setError(null);

      const response = await acceptInvite({
        token,
        name: formData.name.trim(),
        password: formData.password,
      });

      if (response.success) {
        // Redirect to login with success message
        router.push('/login?registered=true&message=Account created successfully. Please login.');
      } else {
        setError(response.message || 'Failed to create account');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setValidating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#B00000] mx-auto mb-4"></div>
            <p className="text-text-secondary">Validating invite...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !inviteData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="mb-4">
              <svg className="w-16 h-16 text-red-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">Invalid Invite</h2>
            <p className="text-text-secondary mb-6">{error}</p>
            <Button variant="primary" onClick={() => router.push('/login')}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Accept Invitation</CardTitle>
        </CardHeader>
        <CardContent>
          {inviteData && (
            <div className="mb-6 p-4 bg-[#1A1A1A] rounded-lg border border-[#242424]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-text-secondary">Email</span>
                <span className="text-sm font-medium text-white">{inviteData.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Role</span>
                <span
                  className={cn(
                    'px-2 py-1 rounded text-xs font-semibold',
                    inviteData.role === 'supplier' && 'bg-[#D4AF37]/20 text-[#D4AF37]',
                    inviteData.role === 'reseller' && 'bg-[#40E0D0]/20 text-[#40E0D0]'
                  )}
                >
                  {inviteData.role.charAt(0).toUpperCase() + inviteData.role.slice(1)}
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Full Name</label>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="Enter your full name"
                disabled={validating}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Password</label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={6}
                placeholder="Minimum 6 characters"
                disabled={validating}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Confirm Password</label>
              <Input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
                minLength={6}
                placeholder="Confirm your password"
                disabled={validating}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              glow
              className="w-full"
              disabled={validating}
            >
              {validating ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>

          <p className="mt-4 text-xs text-text-secondary text-center">
            By creating an account, you agree to our{' '}
            <Link href="/terms" className="text-gold hover:underline">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-gold hover:underline">
              Privacy Policy
            </Link>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function InviteAcceptPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#B00000] mx-auto mb-4"></div>
            <p className="text-text-secondary">Loading...</p>
          </CardContent>
        </Card>
      </div>
    }>
      <InviteAcceptContent />
    </Suspense>
  );
}

