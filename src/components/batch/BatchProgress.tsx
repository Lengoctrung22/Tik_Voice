'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { IBatchGroup } from '@/types';
import { Play, Download, CheckCircle2, Clock, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface BatchProgressProps {
  batchId: string;
}

export function BatchProgress({ batchId }: BatchProgressProps) {
  const [batch, setBatch] = useState<IBatchGroup | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchBatch = async () => {
    try {
      const res = await fetch(`/api/batch/${batchId}`);
      const data = await res.json();
      if (data.success && data.data) {
        setBatch(data.data);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchBatch();
    const interval = setInterval(fetchBatch, 2500);
    return () => clearInterval(interval);
  }, [batchId]);

  const handleStartProcessing = async () => {
    try {
      setIsProcessing(true);
      const res = await fetch(`/api/batch/${batchId}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.info('Đã bắt đầu xử lý hàng loạt video trong lô');
        fetchBatch();
      } else {
        toast.error(data.error || 'Bắt đầu xử lý thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!batch) {
    return (
      <div className="flex items-center justify-center p-12 text-[#a1a1aa] text-sm">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span>Đang tải thông tin lô video...</span>
      </div>
    );
  }

  const completedCount = batch.items.filter((i) => (i.projectId as any)?.status === 'done').length;
  const totalCount = batch.items.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="flex flex-col gap-5 p-5 bg-[#18181b] rounded-2xl border border-[#3f3f46]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#3f3f46] pb-4">
        <div>
          <h3 className="font-bold text-white text-base">{batch.name || 'Lô video'}</h3>
          <p className="text-xs text-[#a1a1aa] mt-0.5">
            Tiến độ: {completedCount}/{totalCount} video đã hoàn thành ({progressPercent}%)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {completedCount > 0 && (
            <a
              href={`/api/batch/${batchId}/export`}
              download
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#22c55e] px-4 py-2 text-xs font-semibold text-black hover:bg-[#16a34a] transition-colors shadow-md"
            >
              <Download className="h-4 w-4" />
              <span>Tải trọn bộ .ZIP ({completedCount} video)</span>
            </a>
          )}

          <button
            type="button"
            onClick={handleStartProcessing}
            disabled={isProcessing || batch.status === 'processing'}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#f97316] px-4 py-2 text-xs font-semibold text-black hover:bg-[#ea580c] transition-colors disabled:opacity-50"
          >
            {isProcessing || batch.status === 'processing' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Đang xử lý tuần tự...</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-current" />
                <span>Bắt đầu xử lý hàng loạt</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Overall Progress Bar */}
      <div className="w-full bg-[#09090b] rounded-full h-2.5 overflow-hidden border border-[#3f3f46]">
        <div
          className="bg-gradient-to-r from-[#eab308] to-[#22c55e] h-full rounded-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Items List */}
      <div className="flex flex-col gap-2.5">
        <span className="text-xs font-semibold text-white">Danh sách video trong lô</span>
        <div className="flex flex-col gap-2 max-h-96 overflow-y-auto pr-1">
          {batch.items.map((item, idx) => {
            const project = item.projectId as any;
            const status = project?.status || item.status;

            return (
              <div
                key={idx}
                className="flex items-center justify-between rounded-xl border border-[#3f3f46] bg-[#09090b] p-3 text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[#27272a] text-[11px] font-mono text-[#a1a1aa]">
                    {idx + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-white">
                      {project?.name || `Video #${idx + 1}`}
                    </p>
                    <p className="text-[11px] text-[#a1a1aa] truncate max-w-xs mt-0.5">
                      {project?.script?.text || 'Chưa có kịch bản'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {status === 'done' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#22c55e]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#22c55e]">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Hoàn tất</span>
                    </span>
                  ) : status === 'rendering' || status === 'processing' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#eab308]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#eab308] animate-pulse">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Đang xử lý</span>
                    </span>
                  ) : status === 'error' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#ef4444]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#ef4444]">
                      <AlertCircle className="h-3 w-3" />
                      <span>Lỗi</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#71717a]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#a1a1aa]">
                      <Clock className="h-3 w-3" />
                      <span>Chờ xử lý</span>
                    </span>
                  )}

                  {project?._id && (
                    <Link
                      href={`/projects/${project._id}`}
                      className="rounded border border-[#3f3f46] bg-[#27272a] px-2.5 py-1 text-[11px] text-white hover:bg-[#3f3f46] transition-colors"
                    >
                      Mở Editor
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
