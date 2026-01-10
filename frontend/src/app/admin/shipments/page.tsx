'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Footer } from '@/components/marketing';
import { shippingAPI } from '@/lib/api';
import { cn } from '@/lib/utils';

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

const ShipmentStatusBadge: React.FC<{ status: Shipment['status'] }> = ({ status }) => {
  const variants = {
    created: 'bg-blue-100 text-blue-800 border-blue-200',
    shipped: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    delivered: 'bg-green-100 text-green-800 border-green-200',
  };

  const labels = {
    created: 'Created',
    shipped: 'Shipped',
    delivered: 'Delivered',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border',
        variants[status]
      )}
    >
      {labels[status]}
    </span>
  );
};

export default function AdminShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    supplierId: '',
    status: '' as '' | 'created' | 'shipped' | 'delivered',
    courier: '',
  });

  const fetchShipments = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {};
      if (filters.supplierId) params.supplierId = filters.supplierId;
      if (filters.status) params.status = filters.status;
      if (filters.courier) params.courier = filters.courier;

      const response = await shippingAPI.getAllShipments(params);
      if (response.success) {
        setShipments(response.data || []);
      } else {
        setError(response.message || 'Failed to fetch shipments');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching shipments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShipments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.supplierId, filters.status, filters.courier]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
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

  const getLabelUrl = (labelUrl: string) => {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    return `${apiBaseUrl}${labelUrl}`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-6">
          <SectionTitle>Shipment Management</SectionTitle>
          <p className="text-gray-600 mt-2">View and manage all shipping labels and tracking</p>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="supplierId" className="block text-sm font-medium text-gray-700 mb-1">
                  Supplier ID
                </label>
                <input
                  id="supplierId"
                  type="text"
                  value={filters.supplierId}
                  onChange={(e) => setFilters({ ...filters, supplierId: e.target.value })}
                  placeholder="Filter by supplier ID"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  id="status"
                  value={filters.status}
                  onChange={(e) =>
                    setFilters({ ...filters, status: e.target.value as typeof filters.status })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Statuses</option>
                  <option value="created">Created</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                </select>
              </div>
              <div>
                <label htmlFor="courier" className="block text-sm font-medium text-gray-700 mb-1">
                  Courier
                </label>
                <input
                  id="courier"
                  type="text"
                  value={filters.courier}
                  onChange={(e) => setFilters({ ...filters, courier: e.target.value })}
                  placeholder="Filter by courier"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Shipments Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Shipments</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Loading shipments...</p>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <p className="text-red-500">{error}</p>
                <button
                  onClick={fetchShipments}
                  className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                >
                  Retry
                </button>
              </div>
            ) : shipments.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No shipments found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Order ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tracking Number
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Courier
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rate
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Label
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created At
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {shipments.map((shipment) => (
                      <tr key={shipment._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{shipment.orderId}</div>
                          <div className="text-xs text-gray-500">
                            Supplier: {shipment.supplierId.substring(0, 8)}...
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-mono text-gray-900">{shipment.trackingNumber}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900 uppercase">{shipment.courier}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(shipment.rate)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <ShipmentStatusBadge status={shipment.status} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <a
                            href={getLabelUrl(shipment.labelUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            Download PDF
                          </a>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(shipment.createdAt)}
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


