'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'accent';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', type = 'button', ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center whitespace-nowrap rounded-md text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f97316] focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090b] disabled:pointer-events-none disabled:opacity-50 select-none';

    const variants = {
      default: 'bg-[#f97316] text-black hover:bg-[#ea580c] shadow-sm',
      accent:
        'bg-[#f97316]/12 text-[#f97316] border border-[#f97316]/35 hover:bg-[#f97316] hover:text-black',
      destructive: 'bg-[#ef4444] text-white hover:bg-[#dc2626] shadow-sm',
      outline:
        'border border-white/[0.12] bg-[#18181b] text-[#fafafa] hover:bg-[#27272a] hover:border-white/[0.2]',
      secondary: 'bg-[#27272a] text-[#fafafa] hover:bg-[#3f3f46]',
      ghost: 'text-[#a1a1aa] hover:bg-white/[0.06] hover:text-white',
      link: 'text-[#f97316] underline-offset-4 hover:underline',
    };

    const sizes = {
      default: 'h-9 px-3.5 py-2',
      sm: 'h-8 px-2.5 text-[11px]',
      lg: 'h-10 rounded-lg px-5 text-sm',
      icon: 'h-8 w-8',
    };

    return (
      <button
        ref={ref}
        type={type}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
