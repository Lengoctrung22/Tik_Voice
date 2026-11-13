'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  HardDrive,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  BookmarkCheck,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { formatFileSize } from '@/lib/utils';
import type { BrandPresetDTO } from '@/types';

interface HealthService {
  ok: boolean;
  label: string;
  detail: string;
}

interface HealthData {
  ok: boolean;
  readyForQueue: boolean;
  services: Record<string, HealthService>;
  storage: {
    totalBytes: number;
    byCategory: Record<string, { bytes: number; files: number }>;
  };
  checkedAt: string;
}

const STORAGE_LABELS: Record<string, string> = {
  uploads: 'Video & Hình ảnh gốc',
  audio: 'Giọng đọc AI & Thu âm',
  previews: 'Cache nghe thử giọng',
  subtitles: 'Tệp phụ đề',
  music: 'Nhạc nền tải lên',
  exports: 'Video MP4 đã xuất',
};

export default function SettingsPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [presets, setPresets] = useState<BrandPresetDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);

  const loadDiagnostics = useCallback(async () => {
    setLoading(true);
    try {
      const [hRes, pRes] = await Promise.all([
        fetch('/api/health'),
        fetch('/api/presets'),
      ]);
      const hJson = (await hRes.json()) as { success: boolean; data?: HealthData };
      const pJson = (await pRes.json()) as {
        success: boolean;
        data?: BrandPresetDTO[];
      };
      if (hJson.success && hJson.data) setHealth(hJson.data);
      if (pJson.success && Array.isArray(pJson.data)) setPresets(pJson.data);
    } catch {
      toast.error('Không thể tải thông tin chẩn đoán hệ thống');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDiagnostics();
  }, [loadDiagnostics]);

  const handleCleanupStorage = async () => {
    setCleaning(true);
    try {
      const res = await fetch('/api/storage/cleanup', { method: 'POST' });
      const json = (await res.json()) as {
        success: boolean;
        message?: string;
        error?: string;
      };
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Dọn dẹp thất bại');
        return;
      }
      toast.success(json.message || 'Đã dọn bộ nhớ đệm sạch sẽ');
      await loadDiagnostics();
    } catch {
      toast.error('Lỗi kết nối khi dọn bộ nhớ');
    } finally {
      setCleaning(false);
    }
  };

  const handleDeletePreset = async (id: string) => {
    try {
      const res = await fetch(`/api/presets/${id}`, { method: 'DELETE' });
      const json = (await res.json()) as { success: boolean };
      if (json.success) {
        setPresets((prev) => prev.filter((p) => p._id !== id));
        toast.success('Đã xóa cấu hình mẫu');
      }
    } catch {
      toast.error('Không thể xóa cấu hình mẫu');
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-[#fafafa] flex flex-col">
      <Header />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 sm:px-6 py-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-[#fafafa]">Cài đặt & Chẩn đoán hệ thống</h1>
            <p className="text-xs text-[#a1a1aa]">
              Kiểm tra kết nối công cụ xử lý video, quản lý dung lượng lưu trữ và cấu hình mẫu
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={loadDiagnostics}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Kiểm tra lại</span>
          </Button>
        </div>

        {/* Service Health */}
        <section className="rounded-xl border border-white/[0.08] bg-[#111113] p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-[#fafafa]">
            <Activity className="h-4 w-4 text-[#f97316]" />
            <span>Trạng thái dịch vụ nền</span>
          </div>

          {loading && !health ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-[#18181b]" />
              ))}
            </div>
          ) : health ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(health.services).map(([key, svc]) => (
                <div
                  key={key}
                  className={`rounded-lg border p-3 ${
                    svc.ok
                      ? 'border-emerald-500/20 bg-emerald-500/5'
                      : 'border-amber-500/25 bg-amber-500/5'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#fafafa]">{svc.label}</span>
                    {svc.ok ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-amber-400 shrink-0" />
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-[#a1a1aa] truncate" title={svc.detail}>
                    {svc.detail}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        {/* Storage Breakdown & Cleanup */}
        <section className="rounded-xl border border-white/[0.08] bg-[#111113] p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-[#f97316]" />
              <div>
                <h2 className="text-sm font-bold text-[#fafafa]">Dung lượng lưu trữ</h2>
                {health && (
                  <p className="text-xs text-[#a1a1aa]">
                    Tổng đang sử dụng:{' '}
                    <span className="font-mono font-semibold text-white">
                      {formatFileSize(health.storage.totalBytes)}
                    </span>
                  </p>
                )}
              </div>
            </div>

            <Button
              variant="accent"
              size="sm"
              onClick={handleCleanupStorage}
              disabled={cleaning}
              className="gap-1.5"
            >
              {cleaning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              <span>{cleaning ? 'Đang dọn...' : 'Dọn cache nghe thử & tệp thừa'}</span>
            </Button>
          </div>

          {health && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {Object.entries(health.storage.byCategory).map(([cat, info]) => (
                <div
                  key={cat}
                  className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-[#18181b] px-3 py-2.5 text-xs"
                >
                  <div>
                    <div className="font-medium text-[#fafafa]">
                      {STORAGE_LABELS[cat] || cat}
                    </div>
                    <div className="text-[10px] text-[#9ca3af]">{info.files} tệp</div>
                  </div>
                  <span className="font-mono font-semibold text-[#d4d4d8] tabular-nums">
                    {formatFileSize(info.bytes)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Brand Presets Management */}
        <section className="rounded-xl border border-white/[0.08] bg-[#111113] p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-[#fafafa]">
            <BookmarkCheck className="h-4 w-4 text-[#f97316]" />
            <span>Cấu hình mẫu thương hiệu đã lưu ({presets.length})</span>
          </div>

          {presets.length === 0 ? (
            <p className="text-xs text-[#9ca3af] py-3">
              Chưa có cấu hình mẫu nào. Bạn có thể mở bất kỳ dự án nào và bấm nút &ldquo;Cấu hình mẫu&rdquo; trên thanh công cụ để lưu.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {presets.map((p) => (
                <div
                  key={p._id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-[#18181b] px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-[#fafafa]">{p.name}</div>
                    <div className="text-[10px] text-[#9ca3af] truncate">
                      {p.voice} | {p.exportResolution} |{' '}
                      {p.aspectMode === 'blur'
                        ? 'Nền mờ'
                        : p.aspectMode === 'cover'
                        ? 'Lấp đầy'
                        : 'Vừa khung'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeletePreset(p._id)}
                    aria-label={`Xóa cấu hình ${p.name}`}
                    className="rounded p-1.5 text-[#9ca3af] hover:bg-red-500/10 hover:text-red-400 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
