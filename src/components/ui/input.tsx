'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-9 w-full rounded-lg border border-[#3f3f46] bg-[#09090b] px-3 py-1 text-xs text-white shadow-sm transition-colors file:border-0 file:bg-transparent file:text-xs file:font-medium placeholder:text-[#71717a] focus-visible:outline-none focus-visible:border-[#f97316] focus-visible:ring-1 focus-visible:ring-[#f97316] disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';
