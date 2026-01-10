'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Footer } from '@/components/marketing';
import { referralAPI } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Referral {
  _id: string;
  referralId: string;
  code: string;
  referrerUserId: string;
  referredEmail?: string;
  usedByUserId?: string;
  reward: {
    type: string;
    value: number;
  };
  status: 'active' | 'used' | 'expired';
  createdAt: string;
  updatedAt: string;
}

export default function AdminReferralsPage() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchReferrals();
  }, []);

  const fetchReferrals = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await referralAPI.getAll();
      if (response.success) {
        setReferrals(response.data || []);
      } else {
        setError(response.message || 'Failed to fetch referrals');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching referrals');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!userId.trim()) {
      setError('Please enter a user ID');
      return;
    }

    try {
      setGenerating(true);
      setError(null);

      const response = await referralAPI.generate(userId);
      if (response.success) {
        setUserId('');
        await fetchReferrals();
      } else {
        setError(response.message || 'Failed to generate referral code');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while generating the referral code');
    } finally {
      setGenerating(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-6">
          <SectionTitle>Referral Management</SectionTitle>
          <p className="text-gray-600 mt-2">Generate and manage referral codes</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Generate Referral Code</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Enter User ID"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Button onClick={handleGenerate} disabled={generating || !userId.trim()}>
                {generating ? 'Generating...' : 'Generate Code'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All Referrals</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Loading referrals...</p>
              </div>
            ) : referrals.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No referrals found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Code
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Referrer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Used By
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reward
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {referrals.map((referral) => (
                      <tr key={referral._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-mono font-semibold text-gray-900">{referral.code}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{referral.referrerUserId.substring(0, 12)}...</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {referral.usedByUserId ? referral.usedByUserId.substring(0, 12) + '...' : 'Not used'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900">
                            {formatCurrency(referral.reward.value)} {referral.reward.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={cn(
                              'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold',
                              referral.status === 'active' && 'bg-green-100 text-green-800',
                              referral.status === 'used' && 'bg-blue-100 text-blue-800',
                              referral.status === 'expired' && 'bg-gray-100 text-gray-800'
                            )}
                          >
                            {referral.status.charAt(0).toUpperCase() + referral.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(referral.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}

