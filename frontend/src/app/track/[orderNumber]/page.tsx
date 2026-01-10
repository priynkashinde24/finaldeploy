'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';

interface TimelineItem {
  status: string;
  label: string;
  description: string;
  timestamp: Date;
  isCompleted: boolean;
  isCurrent: boolean;
}

interface OrderTrackingData {
  orderNumber: string;
  orderStatus: string;
  paymentMethod?: string;
  paymentStatus?: string;
  timeline: TimelineItem[];
  courier?: {
    name: string;
    awbNumber?: string | null;
    trackingUrl?: string | null;
  };
  shippingAddress?: {
    name: string;
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  items: Array<{
    productName: string;
    variant?: string;
    quantity: number;
    imageUrl?: string;
  }>;
  expectedDeliveryDate?: Date | null;
  grandTotal: number;
  createdAt: Date;
}

export default function TrackOrderPage() {
  const params = useParams();
  const orderNumber = params.orderNumber as string;
  const [trackingData, setTrackingData] = useState<OrderTrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTrackingData();
  }, [orderNumber]);

  const fetchTrackingData = async () => {
    try {
      setLoading(true);
      setError(null);

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiUrl}/api/orders/${orderNumber}/track`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch order tracking');
      }

      const result = await response.json();
      if (result.success && result.data) {
        setTrackingData(result.data);
      } else {
        throw new Error(result.error || 'Failed to fetch order tracking');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load order tracking');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#121212] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-deep-red mx-auto"></div>
            <p className="mt-4 text-gray-400">Loading order tracking...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#121212] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <Card className="p-8">
            <div className="text-center">
              <div className="text-red-500 text-5xl mb-4">⚠️</div>
              <h1 className="text-2xl font-bold text-white mb-2">Error</h1>
              <p className="text-gray-400 mb-6">{error}</p>
              <button
                onClick={fetchTrackingData}
                className="px-6 py-2 bg-primary-deep-red text-white rounded-lg hover:bg-red-700 transition"
              >
                Try Again
              </button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (!trackingData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#121212] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Order Tracking</h1>
          <p className="text-gray-400">Order Number: {trackingData.orderNumber}</p>
        </div>

        {/* Order Summary Card */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-400 mb-1">Order Status</p>
                <p className="text-lg font-semibold text-white capitalize">
                  {trackingData.orderStatus.replace('_', ' ')}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-1">Payment Method</p>
                <p className="text-lg font-semibold text-white capitalize">
                  {trackingData.paymentMethod || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-1">Total Amount</p>
                <p className="text-lg font-semibold text-white">
                  ₹{trackingData.grandTotal.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Order Timeline</CardTitle>
          </CardHeader>
          <CardContent>
          <div className="space-y-6">
            {trackingData.timeline.map((item, index) => (
              <div key={index} className="flex items-start">
                {/* Timeline Line */}
                <div className="flex flex-col items-center mr-4">
                  <div
                    className={`w-4 h-4 rounded-full ${
                      item.isCurrent
                        ? 'bg-primary-deep-red ring-4 ring-red-200'
                        : item.isCompleted
                        ? 'bg-green-500'
                        : 'bg-gray-300'
                    }`}
                  />
                  {index < trackingData.timeline.length - 1 && (
                    <div
                      className={`w-0.5 h-16 ${
                        item.isCompleted ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    />
                  )}
                </div>

                {/* Timeline Content */}
                <div className="flex-1 pb-6">
                  <div className="flex items-center justify-between mb-1">
                    <h3
                      className={`text-lg font-semibold ${
                        item.isCurrent ? 'text-primary-deep-red' : 'text-white'
                      }`}
                    >
                      {item.label}
                    </h3>
                    <span className="text-sm text-gray-400">{formatDate(item.timestamp)}</span>
                  </div>
                  <p className="text-gray-400">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
          </CardContent>
        </Card>

        {/* Courier & Tracking */}
        {trackingData.courier && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Shipping Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Courier</p>
                  <p className="text-lg font-semibold text-white">{trackingData.courier.name}</p>
                </div>
                {trackingData.courier.awbNumber && (
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Tracking Number (AWB)</p>
                    <p className="text-lg font-semibold text-white">
                      {trackingData.courier.awbNumber}
                    </p>
                  </div>
                )}
                {trackingData.courier.trackingUrl && (
                  <div>
                    <a
                      href={trackingData.courier.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-4 py-2 bg-primary-deep-red text-white rounded-lg hover:bg-red-700 transition"
                    >
                      Track on Courier Website
                      <svg
                        className="ml-2 w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                    </a>
                  </div>
                )}
                {trackingData.expectedDeliveryDate && (
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Expected Delivery</p>
                    <p className="text-lg font-semibold text-white">
                      {formatDate(trackingData.expectedDeliveryDate)}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Shipping Address */}
        {trackingData.shippingAddress && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Shipping Address</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-gray-300">
                <p className="font-semibold text-white">{trackingData.shippingAddress.name}</p>
                <p>{trackingData.shippingAddress.street}</p>
                <p>
                  {trackingData.shippingAddress.city}, {trackingData.shippingAddress.state}{' '}
                  {trackingData.shippingAddress.zip}
                </p>
                <p>{trackingData.shippingAddress.country}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Order Items */}
        <Card>
          <CardHeader>
            <CardTitle>Order Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {trackingData.items.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center border-b border-gray-700 pb-4 last:border-0"
                >
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt={item.productName}
                      className="w-16 h-16 object-cover rounded-lg mr-4"
                    />
                  )}
                  <div className="flex-1">
                    <p className="font-semibold text-white">{item.productName}</p>
                    {item.variant && <p className="text-sm text-gray-400">{item.variant}</p>}
                  </div>
                  <p className="text-gray-300">Qty: {item.quantity}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

