'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Footer } from '@/components/marketing';
import { shippingAPI } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ShippingRate {
  service: string;
  rate: number;
  estimatedDays?: number;
}

interface Shipment {
  _id: string;
  orderId: string;
  supplierId: string;
  courier: string;
  trackingNumber: string;
  labelUrl: string;
  rate: number;
  status: 'created' | 'shipped' | 'delivered';
  createdAt: string;
  updatedAt: string;
}

export default function OrderShippingPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.orderId as string;

  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCourier, setSelectedCourier] = useState<'standard' | 'express'>('standard');

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch shipping rates
      const ratesResponse = await shippingAPI.getShippingRates(orderId);
      if (ratesResponse.success) {
        setRates(ratesResponse.data.rates || []);
      }

      // Check if label already exists
      try {
        const shipmentResponse = await shippingAPI.getShippingByOrderId(orderId);
        if (shipmentResponse.success) {
          setShipment(shipmentResponse.data);
        }
      } catch (err) {
        // Shipment doesn't exist yet, that's okay
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching shipping information');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLabel = async () => {
    try {
      setCreating(true);
      setError(null);

      const response = await shippingAPI.createLabel({
        orderId,
        courier: selectedCourier,
      });

      if (response.success) {
        setShipment(response.data);
        // Refresh to get full shipment data
        await fetchData();
      } else {
        setError(response.message || 'Failed to create shipping label');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while creating the shipping label');
    } finally {
      setCreating(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getLabelUrl = (labelUrl: string) => {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    return `${apiBaseUrl}${labelUrl}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
          <div className="text-center py-8">
            <p className="text-gray-500">Loading shipping information...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <SectionTitle>Shipping for Order {orderId}</SectionTitle>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {shipment ? (
          // Show existing shipment
          <Card>
            <CardHeader>
              <CardTitle>Shipping Label Created</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tracking Number
                  </label>
                  <p className="text-lg font-mono text-gray-900">{shipment.trackingNumber}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Courier</label>
                  <p className="text-gray-900 uppercase">{shipment.courier}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <span
                    className={cn(
                      'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border',
                      shipment.status === 'created' && 'bg-blue-100 text-blue-800 border-blue-200',
                      shipment.status === 'shipped' &&
                        'bg-yellow-100 text-yellow-800 border-yellow-200',
                      shipment.status === 'delivered' &&
                        'bg-green-100 text-green-800 border-green-200'
                    )}
                  >
                    {shipment.status.charAt(0).toUpperCase() + shipment.status.slice(1)}
                  </span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Shipping Rate</label>
                  <p className="text-gray-900">{formatCurrency(shipment.rate)}</p>
                </div>

                <div>
                  <a
                    href={getLabelUrl(shipment.labelUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block"
                  >
                    <Button>Download Shipping Label PDF</Button>
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          // Show rate options and create label
          <>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Shipping Rates</CardTitle>
              </CardHeader>
              <CardContent>
                {rates.length === 0 ? (
                  <p className="text-gray-500">No shipping rates available</p>
                ) : (
                  <div className="space-y-3">
                    {rates.map((rate) => (
                      <div
                        key={rate.service}
                        className={cn(
                          'p-4 border-2 rounded-lg cursor-pointer transition-colors',
                          selectedCourier === rate.service
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        )}
                        onClick={() => setSelectedCourier(rate.service as 'standard' | 'express')}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-gray-900 capitalize">
                              {rate.service} Shipping
                            </h3>
                            {rate.estimatedDays && (
                              <p className="text-sm text-gray-500">
                                Estimated delivery: {rate.estimatedDays} business days
                              </p>
                            )}
                          </div>
                          <div className="text-lg font-bold text-gray-900">
                            {formatCurrency(rate.rate)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Generate Shipping Label</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-gray-600">
                    Select a shipping rate above and click the button below to generate a shipping
                    label.
                  </p>
                  <Button
                    onClick={handleCreateLabel}
                    disabled={creating || rates.length === 0}
                    className="w-full md:w-auto"
                  >
                    {creating ? 'Creating Label...' : 'Generate Shipping Label'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

