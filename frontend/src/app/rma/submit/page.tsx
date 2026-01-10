'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Footer } from '@/components/marketing';
import { rmaAPI } from '@/lib/api';
import { cn } from '@/lib/utils';

interface OrderItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

interface ReturnItem {
  productId: string;
  sku: string;
  quantity: number;
  reason: string;
}

interface FeeCalculation {
  totalFee: number;
  itemFees: Array<{
    productId: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    daysSincePurchase: number;
    baseFee: number;
    categorySurcharge: number;
    itemTotalFee: number;
  }>;
}

export default function SubmitRMAPage() {
  const router = useRouter();
  const [orderId, setOrderId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [feeCalculation, setFeeCalculation] = useState<FeeCalculation | null>(null);
  const [loading, setLoading] = useState(false);
  const [calculatingFee, setCalculatingFee] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ rmaId: string; returnFee: number } | null>(null);

  // Mock function to fetch order - in production, this would call an API
  const fetchOrder = async (orderId: string) => {
    // This is a stub - in production, you'd have an order API
    // For now, we'll use a mock structure
    return {
      orderId,
      items: [
        {
          productId: 'prod_123',
          sku: 'SKU001',
          name: 'Sample Product',
          quantity: 2,
          unitPrice: 29.99,
        },
      ],
    };
  };

  const handleOrderIdChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newOrderId = e.target.value;
    setOrderId(newOrderId);

    if (newOrderId.length > 0) {
      try {
        setLoading(true);
        // In production, fetch real order data
        const order = await fetchOrder(newOrderId);
        setOrderItems(order.items || []);
        setReturnItems([]);
        setFeeCalculation(null);
      } catch (err: any) {
        setError(err.message || 'Failed to load order');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleItemToggle = (item: OrderItem) => {
    const existingIndex = returnItems.findIndex((ri) => ri.productId === item.productId);
    if (existingIndex >= 0) {
      // Remove item
      setReturnItems(returnItems.filter((_, i) => i !== existingIndex));
    } else {
      // Add item with default quantity 1
      setReturnItems([
        ...returnItems,
        {
          productId: item.productId,
          sku: item.sku,
          quantity: 1,
          reason: '',
        },
      ]);
    }
    setFeeCalculation(null);
  };

  const handleQuantityChange = (productId: string, quantity: number) => {
    const maxQuantity = orderItems.find((item) => item.productId === productId)?.quantity || 1;
    const clampedQuantity = Math.max(1, Math.min(quantity, maxQuantity));

    setReturnItems(
      returnItems.map((item) =>
        item.productId === productId ? { ...item, quantity: clampedQuantity } : item
      )
    );
    setFeeCalculation(null);
  };

  const handleReasonChange = (productId: string, reason: string) => {
    setReturnItems(returnItems.map((item) => (item.productId === productId ? { ...item, reason } : item)));
  };

  const calculateFee = async () => {
    if (returnItems.length === 0) {
      setError('Please select at least one item to return');
      return;
    }

    if (returnItems.some((item) => !item.reason.trim())) {
      setError('Please provide a reason for all selected items');
      return;
    }

    try {
      setCalculatingFee(true);
      setError(null);

      const items = returnItems.map((item) => ({
        productId: item.productId,
        sku: item.sku,
        quantity: item.quantity,
      }));

      const response = await rmaAPI.calculateFee(orderId, items);
      if (response.success) {
        setFeeCalculation(response.data);
      } else {
        setError(response.message || 'Failed to calculate return fee');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while calculating the return fee');
    } finally {
      setCalculatingFee(false);
    }
  };

  const handleSubmit = async () => {
    if (returnItems.length === 0) {
      setError('Please select at least one item to return');
      return;
    }

    if (returnItems.some((item) => !item.reason.trim())) {
      setError('Please provide a reason for all selected items');
      return;
    }

    if (!feeCalculation) {
      setError('Please calculate the return fee first');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const customerIdToUse = customerId || `customer_${Date.now()}`; // In production, get from auth

      const response = await rmaAPI.submit({
        orderId,
        customerId: customerIdToUse,
        items: returnItems,
      });

      if (response.success) {
        setSuccess({
          rmaId: response.data.rmaId,
          returnFee: response.data.returnFee,
        });
      } else {
        setError(response.message || 'Failed to submit RMA');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while submitting the RMA');
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
          <SectionTitle>Submit Return Request</SectionTitle>
          <p className="text-gray-600 mt-2">Request a return for your order</p>
        </div>

        {success ? (
          <Card>
            <CardHeader>
              <CardTitle>RMA Submitted Successfully</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">RMA ID:</p>
                  <p className="text-lg font-mono font-semibold text-gray-900">{success.rmaId}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Return Fee:</p>
                  <p className="text-lg font-semibold text-gray-900">{formatCurrency(success.returnFee)}</p>
                </div>
                <p className="text-gray-600">
                  Your return request has been submitted and is pending admin approval.
                </p>
                <Button onClick={() => router.push('/')}>Return to Home</Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-800">{error}</p>
              </div>
            )}

            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Order Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="orderId" className="block text-sm font-medium text-gray-700 mb-1">
                      Order ID
                    </label>
                    <input
                      id="orderId"
                      type="text"
                      value={orderId}
                      onChange={handleOrderIdChange}
                      placeholder="Enter your order ID"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="customerId" className="block text-sm font-medium text-gray-700 mb-1">
                      Customer ID (optional)
                    </label>
                    <input
                      id="customerId"
                      type="text"
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}
                      placeholder="Your customer ID"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {orderItems.length > 0 && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Select Items to Return</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {orderItems.map((item) => {
                      const returnItem = returnItems.find((ri) => ri.productId === item.productId);
                      const isSelected = !!returnItem;

                      return (
                        <div
                          key={item.productId}
                          className={cn(
                            'p-4 border-2 rounded-lg',
                            isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                          )}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900">{item.name}</h3>
                              <p className="text-sm text-gray-500">SKU: {item.sku}</p>
                              <p className="text-sm text-gray-500">
                                Ordered: {item.quantity} × {formatCurrency(item.unitPrice)}
                              </p>
                            </div>
                            <button
                              onClick={() => handleItemToggle(item)}
                              className={cn(
                                'px-4 py-2 rounded-md text-sm font-medium',
                                isSelected
                                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              )}
                            >
                              {isSelected ? 'Selected' : 'Select'}
                            </button>
                          </div>

                          {isSelected && (
                            <div className="mt-4 space-y-3 pt-4 border-t border-gray-200">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Return Quantity (max: {item.quantity})
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  max={item.quantity}
                                  value={returnItem.quantity}
                                  onChange={(e) =>
                                    handleQuantityChange(item.productId, parseInt(e.target.value) || 1)
                                  }
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Reason for Return *
                                </label>
                                <textarea
                                  value={returnItem.reason}
                                  onChange={(e) => handleReasonChange(item.productId, e.target.value)}
                                  placeholder="Please explain why you're returning this item"
                                  rows={3}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  required
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {returnItems.length > 0 && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Return Fee Calculation</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {!feeCalculation ? (
                      <Button onClick={calculateFee} disabled={calculatingFee} className="w-full md:w-auto">
                        {calculatingFee ? 'Calculating...' : 'Calculate Return Fee'}
                      </Button>
                    ) : (
                      <>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Total Return Fee:</p>
                          <p className="text-2xl font-bold text-gray-900">
                            {formatCurrency(feeCalculation.totalFee)}
                          </p>
                        </div>
                        <div className="mt-4">
                          <p className="text-sm font-medium text-gray-700 mb-2">Fee Breakdown:</p>
                          <div className="space-y-2">
                            {feeCalculation.itemFees.map((itemFee, index) => (
                              <div key={index} className="p-3 bg-gray-50 rounded-md text-sm">
                                <p className="font-medium">SKU: {itemFee.sku}</p>
                                <p className="text-gray-600">
                                  Days since purchase: {itemFee.daysSincePurchase}
                                </p>
                                <p className="text-gray-600">
                                  Base fee: {formatCurrency(itemFee.baseFee)} per unit
                                </p>
                                {itemFee.categorySurcharge > 0 && (
                                  <p className="text-gray-600">
                                    Category surcharge: {formatCurrency(itemFee.categorySurcharge)} per unit
                                  </p>
                                )}
                                <p className="font-semibold mt-1">
                                  Item total: {formatCurrency(itemFee.itemTotalFee)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {feeCalculation && (
              <Card>
                <CardContent className="pt-6">
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="w-full md:w-auto"
                    size="lg"
                  >
                    {submitting ? 'Submitting...' : 'Submit Return Request'}
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

