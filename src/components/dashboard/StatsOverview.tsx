'use client';

import { Film, Clock, Flame } from 'lucide-react';

interface StatsOverviewProps {
  stats: {
    total: number;
    today: number;
    processing: number;
  };
}

export function StatsOverview({ stats }: StatsOverviewProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="flex items-center gap-4 rounded-xl border border-[#3f3f46] bg-[#18181b] p-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#27272a] text-[#f97316]">
          <Film className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xs font-medium text-[#a1a1aa]">Tổng số video</p>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>
      </div>

      <div className="flex items-center gap-4 rounded-xl border border-[#3f3f46] bg-[#18181b] p-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#27272a] text-[#22c55e]">
          <Flame className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xs font-medium text-[#a1a1aa]">Tạo hôm nay</p>
          <p className="text-2xl font-bold text-white">{stats.today}</p>
        </div>
      </div>

      <div className="flex items-center gap-4 rounded-xl border border-[#3f3f46] bg-[#18181b] p-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#27272a] text-[#eab308]">
          <Clock className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xs font-medium text-[#a1a1aa]">Đang xử lý / Render</p>
          <p className="text-2xl font-bold text-white">{stats.processing}</p>
        </div>
      </div>
    </div>
  );
}
