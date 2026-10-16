'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'accent';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-xs font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none';

    const variants = {
      default: 'bg-[#f97316] text-black hover:bg-[#ea580c] shadow-sm',
      accent: 'bg-[#431407] text-[#f97316] border border-[#f97316]/50 hover:bg-[#f97316] hover:text-black shadow-sm',
      destructive: 'bg-[#ef4444] text-white hover:bg-[#dc2626] shadow-sm',
      outline: 'border border-[#3f3f46] bg-[#18181b] text-white hover:bg-[#27272a] hover:text-white',
      secondary: 'bg-[#27272a] text-white hover:bg-[#3f3f46]',
      ghost: 'text-[#a1a1aa] hover:bg-[#27272a] hover:text-white',
      link: 'text-[#f97316] underline-offset-4 hover:underline',
    };

    const sizes = {
      default: 'h-9 px-4 py-2',
      sm: 'h-8 rounded-md px-3 text-[11px]',
      lg: 'h-10 rounded-xl px-6 text-sm',
      icon: 'h-8 w-8',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
