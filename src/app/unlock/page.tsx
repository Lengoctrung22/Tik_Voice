'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function UnlockForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) {
      setError('Vui lòng nhập mã truy cập.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || 'Mã truy cập không hợp lệ.');
        return;
      }
      const next = searchParams.get('next') || '/';
      router.push(next.startsWith('/') ? next : '/');
      router.refresh();
    } catch {
      setError('Không thể xác thực lúc này. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#111113] border border-white/[0.08] rounded-xl p-6 space-y-5 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#f97316]/15 border border-[#f97316]/30 flex items-center justify-center text-[#f97316]">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#fafafa] flex items-center gap-1.5">
              TikVoice Studio
              <Sparkles className="w-3.5 h-3.5 text-[#f97316]" />
            </h1>
            <p className="text-xs text-[#a1a1aa]">
              Nhập mã truy cập để mở không gian làm việc
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="access-key-input" className="text-xs font-medium text-[#d4d4d8]">
              Mã truy cập
            </label>
            <Input
              id="access-key-input"
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Nhập mã khóa của bạn..."
              autoFocus
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Đang kiểm tra...' : 'Mở khóa Studio'}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function UnlockPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#09090b]" />}>
      <UnlockForm />
    </Suspense>
  );
}
