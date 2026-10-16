'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: DialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in-0 duration-150">
      <div
        className="fixed inset-0"
        onClick={() => onOpenChange(false)}
      />
      <div
        className={cn(
          'relative z-50 w-full max-w-lg rounded-2xl border border-[#3f3f46] bg-[#18181b] p-6 shadow-2xl flex flex-col gap-4 text-white animate-in zoom-in-95 duration-150',
          className
        )}
      >
        <div className="flex items-center justify-between border-b border-[#3f3f46]/80 pb-3">
          <div>
            {title && <h3 className="font-bold text-white text-base">{title}</h3>}
            {description && <p className="text-xs text-[#a1a1aa] mt-0.5">{description}</p>}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg p-1 text-[#a1a1aa] hover:bg-[#27272a] hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}
