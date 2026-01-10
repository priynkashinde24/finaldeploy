'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Footer } from '@/components/marketing';
import { couponAPI, referralAPI, storeAPI } from '@/lib/api';
import { cn } from '@/lib/utils';
import { trackFunnelEvent } from '@/lib/funnelTracker';

interface CartItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const referralCodeParam = searchParams.get('ref');

  const [storeId, setStoreId] = useState('');
  const [items, setItems] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [shippingAddress, setShippingAddress] = useState({
    street: '',
    city: '',
    state: '',
    zip: '',
    country: 'US',
  });
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountAmount: number;
  } | null>(null);
  const [referralCode, setReferralCode] = useState(referralCodeParam || '');
  const [referralRedeemed, setReferralRedeemed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // In production, load cart from context/state management
    // For now, using mock data
    setStoreId('store_123');
    setItems([
      {
        productId: 'prod_1',
        sku: 'SKU001',
        name: 'Sample Product',
        quantity: 2,
        unitPrice: 29.99,
        totalPrice: 59.98,
      },
    ]);
  }, []);

  useEffect(() => {
    // Auto-redeem referral code if present in URL
    if (referralCodeParam && customerId && !referralRedeemed) {
      handleRedeemReferral();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referralCodeParam, customerId]);

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + item.totalPrice, 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const discount = appliedCoupon?.discountAmount || 0;
    return Math.max(0, subtotal - discount);
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      setError('Please enter a coupon code');
      return;
    }

    try {
      setValidatingCoupon(true);
      setError(null);

      const cart = {
        items: items.map((item) => ({
          productId: item.productId,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        })),
        subtotal: calculateSubtotal(),
      };

      const response = await couponAPI.validate(storeId, couponCode, cart, customerId || undefined);

      if (response.success && response.data.valid) {
        setAppliedCoupon({
          code: couponCode.toUpperCase(),
          discountAmount: response.data.discountAmount || 0,
        });
        setCouponCode('');
      } else {
        setError(response.data?.reason || response.message || 'Invalid coupon code');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to validate coupon');
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
  };

  const handleRedeemReferral = async () => {
    if (!referralCode.trim()) {
      setError('Please enter a referral code');
      return;
    }

    if (!customerId.trim()) {
      setError('Please enter your customer ID to redeem referral');
      return;
    }

    try {
      setError(null);

      const response = await referralAPI.redeem(referralCode, customerId, customerEmail || undefined);

      if (response.success) {
        setReferralRedeemed(true);
        // In production, apply rewards to user account
        console.log('Referral rewards:', {
          referrerReward: response.data.referrerReward,
          referredReward: response.data.referredReward,
        });
      } else {
        setError(response.message || 'Failed to redeem referral code');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to redeem referral code');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (items.length === 0) {
      setError('Cart is empty');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // Funnel tracking: checkout started (session-based)
      trackFunnelEvent('CHECKOUT_STARTED', {
        metadata: {
          itemsCount: items.length,
          subtotal: calculateSubtotal(),
          total: calculateTotal(),
          hasCoupon: !!appliedCoupon,
          hasReferral: !!referralCodeParam,
        },
      }).catch(() => {});

      const response = await storeAPI.create({
        name: 'Checkout',
        description: 'Temporary checkout',
        ownerId: customerId || 'guest',
        logoUrl: 'https://example.com/logo.png',
      });

      // Call checkout API
      const checkoutResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/checkout/create-payment-intent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            storeId,
            items: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
            })),
            customerId: customerId || undefined,
            customerEmail: customerEmail || undefined,
            customerName: customerName || undefined,
            shippingAddress: Object.values(shippingAddress).every((v) => v.trim())
              ? shippingAddress
              : undefined,
            couponCode: appliedCoupon?.code || undefined,
          }),
        }
      );

      const checkoutData = await checkoutResponse.json();

      if (checkoutData.success) {
        // Funnel tracking: payment success (in this flow, success means order/payment intent created)
        trackFunnelEvent('PAYMENT_SUCCESS', {
          entityId: checkoutData.data?.orderId,
          metadata: {
            orderId: checkoutData.data?.orderId,
            total: calculateTotal(),
          },
        }).catch(() => {});

        // Redirect to payment or success page
        router.push(`/orders/${checkoutData.data.orderId}/shipping`);
      } else {
        setError(checkoutData.message || 'Failed to create payment intent');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during checkout');
    } finally {
      setSubmitting(false);
    }
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
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <SectionTitle>Checkout</SectionTitle>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Customer Info */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Customer Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Customer ID
                    </label>
                    <input
                      type="text"
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Shipping Address</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Street</label>
                    <input
                      type="text"
                      value={shippingAddress.street}
                      onChange={(e) =>
                        setShippingAddress({ ...shippingAddress, street: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                      <input
                        type="text"
                        value={shippingAddress.city}
                        onChange={(e) =>
                          setShippingAddress({ ...shippingAddress, city: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                      <input
                        type="text"
                        value={shippingAddress.state}
                        onChange={(e) =>
                          setShippingAddress({ ...shippingAddress, state: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">ZIP</label>
                      <input
                        type="text"
                        value={shippingAddress.zip}
                        onChange={(e) =>
                          setShippingAddress({ ...shippingAddress, zip: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                      <input
                        type="text"
                        value={shippingAddress.country}
                        onChange={(e) =>
                          setShippingAddress({ ...shippingAddress, country: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Order Summary */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">Items</h3>
                    <div className="space-y-2">
                      {items.map((item, index) => (
                        <div key={index} className="flex justify-between text-sm">
                          <span>
                            {item.name} × {item.quantity}
                          </span>
                          <span>{formatCurrency(item.totalPrice)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex justify-between mb-2">
                      <span>Subtotal</span>
                      <span>{formatCurrency(calculateSubtotal())}</span>
                    </div>

                    {/* Coupon Section */}
                    {!appliedCoupon ? (
                      <div className="mb-4">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={couponCode}
                            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                            placeholder="Coupon code"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <Button
                            type="button"
                            onClick={handleApplyCoupon}
                            disabled={validatingCoupon || !couponCode.trim()}
                          >
                            {validatingCoupon ? '...' : 'Apply'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-green-800">
                            Coupon: {appliedCoupon.code}
                          </span>
                          <button
                            type="button"
                            onClick={handleRemoveCoupon}
                            className="text-sm text-red-600 hover:text-red-800"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="text-sm text-green-700">
                          Discount: -{formatCurrency(appliedCoupon.discountAmount)}
                        </div>
                      </div>
                    )}

                    {appliedCoupon && (
                      <div className="flex justify-between mb-2 text-green-600">
                        <span>Discount</span>
                        <span>-{formatCurrency(appliedCoupon.discountAmount)}</span>
                      </div>
                    )}

                    <div className="pt-4 border-t border-gray-200 flex justify-between font-bold text-lg">
                      <span>Total</span>
                      <span>{formatCurrency(calculateTotal())}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Referral Section */}
              {!referralRedeemed && (
                <Card>
                  <CardHeader>
                    <CardTitle>Referral Code</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={referralCode}
                        onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                        placeholder="Enter referral code"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <Button type="button" onClick={handleRedeemReferral} disabled={!referralCode.trim()}>
                        Redeem
                      </Button>
                    </div>
                    {referralCodeParam && (
                      <p className="text-sm text-gray-600 mt-2">
                        Referral code from URL will be applied at checkout
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {referralRedeemed && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                      <p className="text-sm text-green-800">Referral code redeemed successfully!</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Button type="submit" disabled={submitting} className="w-full" size="lg">
                {submitting ? 'Processing...' : 'Complete Order'}
              </Button>
            </div>
          </div>
        </form>
      </main>
      <Footer />
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
          <div className="mb-6">
            <SectionTitle>Checkout</SectionTitle>
          </div>
          <div className="text-center py-12">
            <p className="text-gray-600">Loading checkout...</p>
          </div>
        </main>
        <Footer />
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}

