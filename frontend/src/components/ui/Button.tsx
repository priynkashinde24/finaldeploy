'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'dark' | 'accent' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  glow?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  glow = false,
  className,
  children,
  disabled,
  ...props
}) => {
  const baseStyles = 'rounded-lg font-semibold transition-all duration-250 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-[#AA0000] text-white hover:bg-[#C80000] focus:ring-[#AA0000] shadow-lg hover:shadow-xl transition-all duration-300', // Deep Red
    secondary: 'border-2 border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37]/10 focus:ring-[#D4AF37] transition-all duration-300', // Muted Gold
    ghost: 'text-white hover:bg-[#1A1A1A] focus:ring-white transition-all duration-300',
    dark: 'bg-[#121212] text-white border border-[#242424] hover:bg-[#1A1A1A] focus:ring-[#242424] transition-all duration-300',
    accent: 'bg-[#40E0D0] text-white hover:bg-[#30D0C0] focus:ring-[#40E0D0] shadow-lg hover:shadow-xl transition-all duration-300', // Turquoise
    outline: 'border-2 border-[#AA0000] text-[#AA0000] hover:bg-[#AA0000] hover:text-white focus:ring-[#AA0000] transition-all duration-300', // Deep Red
  };
  
  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };
  
  const glowStyles = glow ? 'shadow-glowRed hover:shadow-glowRed' : '';
  
  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.02 } : undefined}
      whileTap={!disabled ? { scale: 0.98 } : undefined}
      className={cn(
        baseStyles,
        variants[variant],
        sizes[size],
        glowStyles,
        className
      )}
      disabled={disabled}
      {...(props as any)}
    >
      {children}
    </motion.button>
  );
};
