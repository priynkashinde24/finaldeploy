'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  label?: string;
}

export const Input: React.FC<InputProps> = ({
  error = false,
  label,
  className,
  ...props
}) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-text-primary mb-2">
          {label}
        </label>
      )}
      <input
        className={cn(
          'w-full px-4 py-3 rounded-lg',
          'bg-[#0B0B0B] border border-[#242424]',
          'text-white placeholder:text-white/60',
          'focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent',
          'transition-all duration-250',
          error && 'border-red-500 focus:ring-red-500',
          className
        )}
        {...props}
      />
    </div>
  );
};

