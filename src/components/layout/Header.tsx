'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Video, Layers, PlusCircle, Sparkles } from 'lucide-react';

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#3f3f46] bg-[#18181b]/90 backdrop-blur">
      <div className="flex h-14 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f97316] text-black">
              <Video className="h-5 w-5 fill-current" />
            </span>
            <span className="text-white">
              Tik<span className="text-[#f97316]">Voice</span>
            </span>
          </Link>

          <nav className="flex items-center gap-1 text-sm font-medium">
            <Link
              href="/"
              className={`rounded-md px-3 py-1.5 transition-colors ${
                pathname === '/'
                  ? 'bg-[#27272a] text-white'
                  : 'text-[#a1a1aa] hover:bg-[#27272a]/60 hover:text-white'
              }`}
            >
              Dự án
            </Link>
            <Link
              href="/batch"
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors ${
                pathname === '/batch'
                  ? 'bg-[#27272a] text-white'
                  : 'text-[#a1a1aa] hover:bg-[#27272a]/60 hover:text-white'
              }`}
            >
              <Layers className="h-4 w-4" />
              <span>Xử lý lô (Batch)</span>
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/batch"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-[#3f3f46] bg-[#27272a] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#3f3f46] transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#f97316]" />
            <span>Tạo hàng loạt</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
