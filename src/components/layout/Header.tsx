'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Video, Layers, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Header() {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Dự án', icon: Video, match: (p: string) => p === '/' },
    {
      href: '/batch',
      label: 'Xử lý hàng loạt',
      icon: Layers,
      match: (p: string) => p.startsWith('/batch'),
    },
    {
      href: '/settings',
      label: 'Cài đặt',
      icon: Settings,
      match: (p: string) => p.startsWith('/settings'),
    },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-[#111113]/95 backdrop-blur-md">
      <div className="mx-auto flex h-13 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-base tracking-tight rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f97316]"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#f97316] text-black shadow-sm">
              <Video className="h-4 w-4 fill-current" />
            </span>
            <span className="text-[#fafafa]">
              Tik<span className="text-[#f97316]">Voice</span>
            </span>
          </Link>

          <nav aria-label="Điều hướng chính" className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f97316]',
                    active
                      ? 'bg-[#27272a] text-[#fafafa] border border-white/[0.08]'
                      : 'text-[#a1a1aa] hover:bg-white/[0.05] hover:text-[#fafafa]'
                  )}
                >
                  <Icon className={cn('h-3.5 w-3.5', active && 'text-[#f97316]')} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-[11px] text-[#9ca3af]">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/80" />
          <span>Studio AI 9:16</span>
        </div>
      </div>
    </header>
  );
}
