'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'purple' | 'blue';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    default: 'border-transparent bg-[#f97316] text-black font-bold',
    secondary: 'border-transparent bg-[#27272a] text-[#a1a1aa]',
    destructive: 'border-transparent bg-[#ef4444]/15 text-[#ef4444]',
    success: 'border-transparent bg-[#22c55e]/15 text-[#22c55e]',
    warning: 'border-transparent bg-[#eab308]/15 text-[#eab308]',
    purple: 'border-transparent bg-purple-500/15 text-purple-400',
    blue: 'border-transparent bg-blue-500/15 text-blue-400',
    outline: 'border-[#3f3f46] text-white',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none select-none',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
