'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export type AnyStatus =
  | 'draft'
  | 'scripted'
  | 'voiced'
  | 'subtitled'
  | 'rendering'
  | 'done'
  | 'error'
  | 'pending'
  | 'processing'
  | 'cancelled';

const STATUS_CONFIG: Record<
  AnyStatus,
  { label: string; classes: string; pulse?: boolean }
> = {
  draft: {
    label: 'Bản nháp',
    classes: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/25',
  },
  pending: {
    label: 'Chờ xử lý',
    classes: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/25',
  },
  scripted: {
    label: 'Đã có kịch bản',
    classes: 'bg-blue-500/15 text-blue-300 border-blue-500/25',
  },
  voiced: {
    label: 'Đã tạo giọng đọc',
    classes: 'bg-purple-500/15 text-purple-300 border-purple-500/25',
  },
  subtitled: {
    label: 'Đã tạo phụ đề',
    classes: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25',
  },
  rendering: {
    label: 'Đang xuất video',
    classes: 'bg-[#f97316]/15 text-[#fb923c] border-[#f97316]/35',
    pulse: true,
  },
  processing: {
    label: 'Đang xử lý',
    classes: 'bg-[#f97316]/15 text-[#fb923c] border-[#f97316]/35',
    pulse: true,
  },
  done: {
    label: 'Hoàn tất',
    classes: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  },
  error: {
    label: 'Gặp lỗi',
    classes: 'bg-red-500/15 text-red-300 border-red-500/25',
  },
  cancelled: {
    label: 'Đã hủy',
    classes: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/25',
  },
};

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const cfg = STATUS_CONFIG[status as AnyStatus] || STATUS_CONFIG.draft;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium select-none whitespace-nowrap',
        cfg.classes,
        className
      )}
    >
      {cfg.pulse && (
        <span className="h-1.5 w-1.5 rounded-full bg-[#f97316] animate-pulse shrink-0" />
      )}
      {cfg.label}
    </span>
  );
}
