import React from 'react';
import { cn } from '@/lib/utils';

export interface StatusBadgeProps {
  status: 'verified' | 'pending' | 'unverified';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const variants = {
    verified: 'bg-success text-white',
    pending: 'bg-warning text-white',
    unverified: 'bg-neutral-400 text-white',
  };

  const labels = {
    verified: 'Verified',
    pending: 'Pending',
    unverified: 'Unverified',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold',
        variants[status],
        className
      )}
    >
      {labels[status]}
    </span>
  );
};

