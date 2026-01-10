'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { cryptoPaymentAPI } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
// QR Code will be generated using an external service or library
// For now, we'll use a simple image URL approach

type Cryptocurrency = 'BTC' | 'ETH' | 'USDT' | 'USDC' | 'BNB' | 'MATIC';

interface CryptoPaymentData {
  paymentId: string;
  walletAddress: string;
  cryptocurrency: Cryptocurrency;
  amountInCrypto: number;
  exchangeRate: number;
  currency: string;
  status: 'pending' | 'confirming' | 'confirmed' | 'expired' | 'failed' | 'paid';
  paymentStatus: 'pending' | 'paid' | 'failed';
  transactionHash?: string;
  confirmations?: number;
  requiredConfirmations?: number;
  expiresAt: string;
  qrCodeData: string;
}

const CRYPTO_NAMES: Record<Cryptocurrency, string> = {
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
  USDT: 'Tether (USDT)',
  USDC: 'USD Coin',
  BNB: 'Binance Coin',
  MATIC: 'Polygon',
};

export default function CryptoPaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const cryptocurrency = (searchParams.get('crypto') as Cryptocurrency) || 'BTC';

  const [payment, setPayment] = useState<CryptoPaymentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCrypto, setSelectedCrypto] = useState<Cryptocurrency>(cryptocurrency);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    if (!orderId) {
      setError('Order ID is required');
      setLoading(false);
      return;
    }
    createPayment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, selectedCrypto]);

  useEffect(() => {
    if (payment && payment.status === 'pending' && !polling) {
      startPolling();
    }
    return () => {
      if (polling) {
        stopPolling();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payment]);

  const createPayment = async () => {
    if (!orderId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await cryptoPaymentAPI.createPayment({
        orderId,
        cryptocurrency: selectedCrypto,
      });

      if (response.success) {
        setPayment(response.data);
        if (response.data.status === 'pending') {
          startPolling();
        }
      } else {
        setError(response.message || 'Failed to create payment');
      }
    } catch (err: any) {
      console.error('[CRYPTO PAYMENT] Create error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to create payment');
    } finally {
      setLoading(false);
    }
  };

  let pollInterval: NodeJS.Timeout | null = null;

  const startPolling = () => {
    if (!payment) return;
    setPolling(true);

    pollInterval = setInterval(async () => {
      try {
        const response = await cryptoPaymentAPI.checkStatus(payment.paymentId);
        if (response.success) {
          const updatedPayment = response.data;
          setPayment(updatedPayment);

          if (updatedPayment.paymentStatus === 'paid' || updatedPayment.status === 'confirmed') {
            stopPolling();
            // Redirect to success page after a delay
            setTimeout(() => {
              router.push(`/order/success?orderId=${orderId}`);
            }, 2000);
          } else if (updatedPayment.status === 'expired' || updatedPayment.status === 'failed') {
            stopPolling();
          }
        }
      } catch (err) {
        console.error('[CRYPTO PAYMENT] Poll error:', err);
      }
    }, 10000); // Poll every 10 seconds
  };

  const stopPolling = () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    setPolling(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  const formatCryptoAmount = (amount: number, crypto: Cryptocurrency): string => {
    const decimals = crypto === 'BTC' ? 8 : crypto === 'ETH' ? 6 : 2;
    return amount.toFixed(decimals);
  };

  const formatFiatAmount = (amount: number, currency: string): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-secondary">Creating payment...</p>
        </div>
      </div>
    );
  }

  if (error && !payment) {
    return (
      <div className="min-h-screen bg-background p-6 md:p-10">
        <div className="max-w-2xl mx-auto">
          <Card className="bg-surface border-border">
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-red-400 mb-4">{error}</p>
                <Button onClick={() => router.back()} variant="primary">
                  Go Back
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!payment) {
    return null;
  }

  const isExpired = new Date(payment.expiresAt) < new Date();
  const isPaid = payment.paymentStatus === 'paid' || payment.status === 'confirmed';
  const isConfirming = payment.status === 'confirming';

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Cryptocurrency Payment</h1>
          <p className="text-text-secondary">Pay with {CRYPTO_NAMES[payment.cryptocurrency]}</p>
        </div>

        {/* Status Messages */}
        {isPaid && (
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <div className="font-semibold text-green-400">Payment Confirmed!</div>
                <div className="text-sm text-green-300">Your order will be processed shortly.</div>
              </div>
            </div>
          </div>
        )}

        {isConfirming && (
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-yellow-400"></div>
              <div>
                <div className="font-semibold text-yellow-400">Payment Confirming</div>
                <div className="text-sm text-yellow-300">
                  Waiting for {payment.requiredConfirmations || 3} blockchain confirmations...
                  {payment.confirmations !== undefined && (
                    <span> ({payment.confirmations}/{payment.requiredConfirmations || 3})</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {isExpired && !isPaid && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <div className="font-semibold text-red-400">Payment Expired</div>
                <div className="text-sm text-red-300">This payment address has expired. Please create a new payment.</div>
              </div>
            </div>
          </div>
        )}

        {/* Payment Details Card */}
        <Card className="bg-surface border-border">
          <CardHeader>
            <CardTitle className="text-white">Payment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Amount:</span>
              <span className="text-white font-semibold">
                {formatCryptoAmount(payment.amountInCrypto, payment.cryptocurrency)} {payment.cryptocurrency}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Fiat Amount:</span>
              <span className="text-white font-semibold">
                {formatFiatAmount(payment.amountInCrypto * payment.exchangeRate, payment.currency)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Exchange Rate:</span>
              <span className="text-white">
                1 {payment.cryptocurrency} = {formatFiatAmount(payment.exchangeRate, payment.currency)}
              </span>
            </div>
            {payment.transactionHash && (
              <div className="pt-2 border-t border-border">
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary">Transaction Hash:</span>
                  <span className="text-white font-mono text-xs break-all">{payment.transactionHash}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* QR Code Card */}
        {!isPaid && !isExpired && (
          <Card className="bg-surface border-border">
            <CardHeader>
              <CardTitle className="text-white">Scan QR Code</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(payment.qrCodeData)}`}
                  alt="Payment QR Code"
                  className="w-64 h-64"
                />
              </div>
              <p className="text-sm text-text-secondary text-center">
                Scan this QR code with your cryptocurrency wallet to send payment
              </p>
            </CardContent>
          </Card>
        )}

        {/* Wallet Address Card */}
        {!isPaid && !isExpired && (
          <Card className="bg-surface border-border">
            <CardHeader>
              <CardTitle className="text-white">Wallet Address</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-background border border-border rounded-lg">
                <p className="text-white font-mono text-sm break-all">{payment.walletAddress}</p>
              </div>
              <Button
                onClick={() => copyToClipboard(payment.walletAddress)}
                variant="secondary"
                className="w-full"
              >
                Copy Address
              </Button>
              <p className="text-xs text-text-muted text-center">
                Send exactly {formatCryptoAmount(payment.amountInCrypto, payment.cryptocurrency)}{' '}
                {payment.cryptocurrency} to this address
              </p>
            </CardContent>
          </Card>
        )}

        {/* Instructions Card */}
        {!isPaid && !isExpired && (
          <Card className="bg-surface border-border">
            <CardHeader>
              <CardTitle className="text-white">Payment Instructions</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="text-sm text-text-secondary list-decimal pl-5 space-y-2">
                <li>Open your cryptocurrency wallet</li>
                <li>Scan the QR code or copy the wallet address</li>
                <li>Send exactly {formatCryptoAmount(payment.amountInCrypto, payment.cryptocurrency)}{' '}
                  {payment.cryptocurrency} to the address</li>
                <li>Wait for blockchain confirmation (usually takes a few minutes)</li>
                <li>Your order will be processed automatically once payment is confirmed</li>
              </ol>
              <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-xs text-yellow-400">
                  <strong>Important:</strong> This payment address expires in{' '}
                  {Math.max(0, Math.floor((new Date(payment.expiresAt).getTime() - Date.now()) / 60000))} minutes.
                  Please complete the payment before it expires.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          {isPaid ? (
            <Button onClick={() => router.push(`/order/success?orderId=${orderId}`)} variant="primary" className="flex-1">
              View Order
            </Button>
          ) : isExpired ? (
            <Button onClick={createPayment} variant="primary" className="flex-1">
              Create New Payment
            </Button>
          ) : (
            <Button onClick={() => router.back()} variant="secondary" className="flex-1">
              Cancel
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

