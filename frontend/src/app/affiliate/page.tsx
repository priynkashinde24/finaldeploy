'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export default function AffiliateDashboardPage() {
  // Placeholder stat cards for affiliate dashboard
  const statCards = [
    {
      title: 'Total Referrals',
      value: '—',
      description: 'People you referred',
    },
    {
      title: 'Active Referrals',
      value: '—',
      description: 'Active referrals',
    },
    {
      title: 'Total Commissions',
      value: '—',
      description: 'All time earnings',
    },
    {
      title: 'Pending Payout',
      value: '—',
      description: 'Awaiting payment',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Affiliate Dashboard</h1>
        <p className="text-text-secondary">Welcome to Affiliate Panel</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, index) => (
          <Card key={index} className="bg-surface border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-text-secondary">
                {card.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white mb-1">{card.value}</div>
              <p className="text-xs text-text-muted">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-surface border-border">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-white">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-text-secondary text-sm">
              Get your referral link and start earning commissions today!
            </p>
            <div className="flex gap-3">
              <button className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
                Get Referral Link
              </button>
              <button className="px-4 py-2 bg-surfaceLight text-text-secondary rounded-lg hover:bg-surfaceLight/80 transition-colors">
                View Analytics
              </button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface border-border">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-white">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-text-secondary text-sm">
              Your recent referral activity will appear here.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

