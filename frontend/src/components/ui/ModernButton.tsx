'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface ModernButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 
  'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration' | 
  'onDragStart' | 'onDrag' | 'onDragEnd'> {
  variant?: 'primary' | 'secondary' | 'accent' | 'gold' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  glow?: boolean;
  children: React.ReactNode;
}

export const ModernButton = React.forwardRef<HTMLButtonElement, ModernButtonProps>(
  ({ className, variant = 'primary', size = 'md', glow = false, children, ...props }, ref) => {
    const baseStyles =
      'relative inline-flex items-center justify-center font-semibold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none overflow-hidden';

    const variants = {
      primary:
        'bg-primary text-white hover:bg-opacity-90 focus:ring-primary shadow-lg hover:shadow-xl hover:shadow-primary/50',
      secondary:
        'bg-secondary-soft-blue text-white hover:bg-opacity-90 focus:ring-secondary-soft-blue shadow-lg hover:shadow-xl hover:shadow-secondary-soft-blue/50',
      accent:
        'bg-accent text-white hover:bg-opacity-90 focus:ring-accent shadow-lg hover:shadow-xl hover:shadow-accent/50',
      gold:
        'bg-gold text-surface hover:bg-opacity-90 focus:ring-gold shadow-lg hover:shadow-xl hover:shadow-gold/50',
      outline:
        'border-2 border-primary text-primary hover:bg-primary hover:text-white focus:ring-primary',
      ghost: 'text-primary hover:bg-primary/10 focus:ring-primary',
    };

    const sizes = {
      sm: 'px-4 py-2 text-sm rounded-lg',
      md: 'px-6 py-3 text-base rounded-xl',
      lg: 'px-8 py-4 text-lg rounded-2xl',
    };

    const glowStyles = glow
      ? 'before:absolute before:inset-0 before:bg-gradient-to-r before:from-primary before:via-gold before:to-accent before:opacity-0 before:blur-xl before:transition-opacity before:duration-300 hover:before:opacity-30'
      : '';

    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
        className={cn(baseStyles, variants[variant], sizes[size], glowStyles, className)}
        {...props}
      >
        <span className="relative z-10">{children}</span>
      </motion.button>
    );
  }
);

ModernButton.displayName = 'ModernButton';

