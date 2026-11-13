'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[64px] w-full rounded-md border border-white/[0.1] bg-[#09090b] px-3 py-2 text-xs text-[#fafafa] shadow-sm transition-colors placeholder:text-[#9ca3af] focus-visible:outline-none focus-visible:border-[#f97316] focus-visible:ring-1 focus-visible:ring-[#f97316] disabled:cursor-not-allowed disabled:opacity-50 resize-none',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';
