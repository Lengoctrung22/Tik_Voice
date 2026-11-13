'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?:
    | 'default'
    | 'secondary'
    | 'destructive'
    | 'outline'
    | 'success'
    | 'warning'
    | 'purple'
    | 'blue'
    | 'info';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    default: 'border-transparent bg-[#f97316] text-black font-bold',
    secondary: 'border-white/[0.08] bg-[#27272a] text-[#a1a1aa]',
    destructive: 'border-[#ef4444]/30 bg-[#ef4444]/15 text-[#ef4444]',
    success: 'border-[#22c55e]/30 bg-[#22c55e]/15 text-[#22c55e]',
    warning: 'border-[#eab308]/30 bg-[#eab308]/15 text-[#eab308]',
    purple: 'border-purple-500/30 bg-purple-500/15 text-purple-300',
    blue: 'border-blue-500/30 bg-blue-500/15 text-blue-300',
    info: 'border-cyan-500/30 bg-cyan-500/15 text-cyan-300',
    outline: 'border-white/[0.14] text-[#fafafa]',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors select-none',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
