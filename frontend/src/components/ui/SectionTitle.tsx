import React from 'react';
import { cn } from '@/lib/utils';

export interface SectionTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  variant?: 'default' | 'accent' | 'gold';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
}

export const SectionTitle = React.forwardRef<HTMLHeadingElement, SectionTitleProps>(
  ({ className, variant = 'default', size = 'lg', children, ...props }, ref) => {
    const baseStyles = 'font-bold text-neutral-900 dark:text-dark-text';
    
    const variants = {
      default: 'text-primary-deep-red',
      accent: 'text-accent-turquoise',
      gold: 'text-primary-muted-gold',
    };
    
    const sizes = {
      sm: 'text-xl',
      md: 'text-2xl',
      lg: 'text-3xl',
      xl: 'text-4xl',
    };
    
    return (
      <h2
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {children}
      </h2>
    );
  }
);

SectionTitle.displayName = 'SectionTitle';

