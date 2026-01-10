'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 
  'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration' | 
  'onDragStart' | 'onDrag' | 'onDragEnd'> {
  hover?: boolean;
  glass?: boolean;
  variant?: 'default' | 'elevated' | 'outlined';
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  hover = false,
  glass = false,
  variant = 'default',
  className,
  children,
  ...props
}) => {
  const baseStyles = 'rounded-xl bg-[#121212] border border-[#242424]';
  
  const variantStyles = {
    default: 'shadow-lg',
    elevated: 'shadow-2xl',
    outlined: 'shadow-none border-2',
  };
  
  const glassStyles = glass 
    ? 'bg-[#121212]/80 backdrop-blur-xl border-[#242424]/50' 
    : '';
  
  return (
    <motion.div
      whileHover={hover ? { y: -4, transition: { duration: 0.2 } } : {}}
      className={cn(
        baseStyles,
        variantStyles[variant],
        glassStyles,
        hover && 'transition-shadow duration-300 hover:shadow-xl',
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  className,
  children,
  ...props
}) => {
  return (
    <div
      className={cn('px-6 pt-6 pb-4', className)}
      {...props}
    >
      {children}
    </div>
  );
};

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
}

export const CardTitle: React.FC<CardTitleProps> = ({
  className,
  children,
  ...props
}) => {
  return (
    <h3
      className={cn('text-lg font-semibold text-white', className)}
      {...props}
    >
      {children}
    </h3>
  );
};

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const CardContent: React.FC<CardContentProps> = ({
  className,
  children,
  ...props
}) => {
  return (
    <div
      className={cn('px-6 pb-6', className)}
      {...props}
    >
      {children}
    </div>
  );
};
