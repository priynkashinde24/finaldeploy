'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout';
import { Button, Card, CardHeader, CardTitle, CardContent, StatusBadge, DomainInstructionCard } from '@/components/ui';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Footer } from '@/components/marketing';
import { storeAPI } from '@/lib/api';
import { cn } from '@/lib/utils';

interface DomainData {
  domain: string;
  domainStatus: 'verified' | 'pending' | 'unverified';
  dnsVerificationToken?: string;
  dnsInstructions?: {
    recordType: string;
    recordName: string;
    recordValue: string;
    instruction: string;
  };
}

export default function DomainSetupPage() {
  const params = useParams();
  const router = useRouter();
  const storeId = params.id as string;
  const [domain, setDomain] = useState('');
  const [domainData, setDomainData] = useState<DomainData | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [store, setStore] = useState<any>(null);

  useEffect(() => {
    const fetchStore = async () => {
      try {
        const response = await storeAPI.getById(storeId);
        if (response.success && response.data) {
          setStore(response.data);
          if (response.data.customDomain) {
            setDomain(response.data.customDomain);
            setDomainData({
              domain: response.data.customDomain,
              domainStatus: response.data.domainStatus || 'unverified',
              dnsVerificationToken: response.data.dnsVerificationToken,
            });
          }
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load store');
      }
    };

    if (storeId) {
      fetchStore();
    }
  }, [storeId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await storeAPI.setDomain(storeId, domain);

      if (response.success && response.data) {
        setDomainData(response.data);
        // Refresh store data
        const storeResponse = await storeAPI.getById(storeId);
        if (storeResponse.success) {
          setStore(storeResponse.data);
        }
      } else {
        setError(response.message || 'Failed to set domain');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to set domain');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError(null);
    setVerifying(true);

    try {
      const response = await storeAPI.verifyDomain(storeId);

      if (response.success && response.data) {
        setDomainData((prev) => ({
          ...prev!,
          domainStatus: response.data.domainStatus,
        }));
        // Refresh store data
        const storeResponse = await storeAPI.getById(storeId);
        if (storeResponse.success) {
          setStore(storeResponse.data);
        }
      } else {
        setError(response.message || 'Domain verification failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify domain');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-secondary-off-white dark:bg-dark-background">
      <Navbar />
      <main className="flex-1 py-12 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8 text-center">
            <SectionTitle size="xl" variant="default" className="mb-4">
              Custom Domain Setup
            </SectionTitle>
            <p className="text-lg text-neutral-600 dark:text-dark-text-secondary">
              Configure a custom domain for your store
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 rounded-lg bg-error/10 border border-error">
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          {/* Domain Input Form */}
          <Card variant="elevated" className="mb-8">
            <CardHeader>
              <CardTitle>Domain Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="domain" className="block text-sm font-medium text-neutral-900 dark:text-dark-text mb-2">
                    Custom Domain <span className="text-primary-deep-red">*</span>
                  </label>
                  <div className="flex gap-4">
                    <input
                      type="text"
                      id="domain"
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      className={cn(
                        'flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-deep-red focus:border-transparent',
                        'bg-white dark:bg-dark-surface text-neutral-900 dark:text-dark-text',
                        'border-secondary-gray dark:border-dark-border'
                      )}
                      placeholder="example.com"
                      disabled={loading || !!domainData}
                    />
                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      disabled={loading || !domain.trim() || !!domainData}
                    >
                      {loading ? 'Configuring...' : domainData ? 'Update Domain' : 'Set Domain'}
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-neutral-500 dark:text-dark-text-secondary">
                    Enter your domain without protocol (e.g., example.com)
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Domain Status */}
          {domainData && (
            <Card variant="elevated" className="mb-8">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Domain Status</CardTitle>
                  <StatusBadge status={domainData.domainStatus} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <span className="text-sm font-medium text-neutral-600 dark:text-dark-text-secondary">
                      Domain:
                    </span>
                    <p className="text-lg font-semibold text-neutral-900 dark:text-dark-text mt-1">
                      {domainData.domain}
                    </p>
                  </div>

                  {domainData.domainStatus === 'pending' && (
                    <div className="pt-4 border-t border-secondary-gray dark:border-dark-border">
                      <Button
                        variant="primary"
                        size="md"
                        onClick={handleVerify}
                        disabled={verifying}
                        className="w-full sm:w-auto"
                      >
                        {verifying ? 'Verifying...' : 'Verify Domain'}
                      </Button>
                    </div>
                  )}

                  {domainData.domainStatus === 'verified' && (
                    <div className="pt-4 border-t border-secondary-gray dark:border-dark-border">
                      <div className="p-4 rounded-lg bg-success/10 border border-success">
                        <p className="text-sm text-success font-medium">
                          ✓ Your domain is verified and ready to use!
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* DNS Instructions */}
          {domainData && domainData.dnsInstructions && (
            <DomainInstructionCard
              recordType={domainData.dnsInstructions.recordType}
              recordName={domainData.dnsInstructions.recordName}
              recordValue={domainData.dnsInstructions.recordValue}
              instruction={domainData.dnsInstructions.instruction}
            />
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
            <Button
              variant="outline"
              size="lg"
              onClick={() => router.push(`/stores/${storeId}/preview`)}
              className="px-8"
            >
              Back to Preview
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

