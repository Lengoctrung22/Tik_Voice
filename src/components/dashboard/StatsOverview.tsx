'use client';

import React from 'react';
import { FolderKanban, CalendarPlus, Loader2 } from 'lucide-react';

interface StatsOverviewProps {
  stats: {
    total: number;
    today: number;
    processing: number;
  };
}

export function StatsOverview({ stats }: StatsOverviewProps) {
  const cards = [
    {
      label: 'Tổng dự án',
      value: stats.total,
      icon: FolderKanban,
      accent: 'text-[#fafafa]',
      iconBg: 'bg-white/[0.06] text-[#a1a1aa]',
    },
    {
      label: 'Tạo hôm nay',
      value: stats.today,
      icon: CalendarPlus,
      accent: 'text-emerald-400',
      iconBg: 'bg-emerald-500/10 text-emerald-400',
    },
    {
      label: 'Đang xử lý',
      value: stats.processing,
      icon: Loader2,
      accent: stats.processing > 0 ? 'text-[#f97316]' : 'text-[#fafafa]',
      iconBg: stats.processing > 0 ? 'bg-[#f97316]/15 text-[#f97316]' : 'bg-white/[0.06] text-[#a1a1aa]',
      spin: stats.processing > 0,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-[#111113] px-4 py-3"
          >
            <div>
              <p className="text-[11px] font-medium text-[#9ca3af]">{card.label}</p>
              <p className={`mt-0.5 text-xl font-bold tabular-nums ${card.accent}`}>
                {card.value}
              </p>
            </div>
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.iconBg}`}>
              <Icon className={`h-4 w-4 ${card.spin ? 'animate-spin' : ''}`} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
