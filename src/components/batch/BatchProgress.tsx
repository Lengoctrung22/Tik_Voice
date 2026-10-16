'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { IPopulatedBatchGroup } from '@/types';
import {
  Play,
  Download,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  RefreshCw,
  ExternalLink,
  Layers,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

interface BatchProgressProps {
  batchId: string;
}

export function BatchProgress({ batchId }: BatchProgressProps) {
  const [batch, setBatch] = useState<IPopulatedBatchGroup | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchBatch = async () => {
    try {
      const res = await fetch(`/api/batch/${batchId}`);
      const data = await res.json();
      if (data.success && data.data) {
        setBatch(data.data);
      }
    } catch {
      // ignore network errors during poll
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setBatch(null);
    fetchBatch();
    const interval = setInterval(fetchBatch, 2000);
    return () => clearInterval(interval);
  }, [batchId]);

  const handleStartProcessing = async () => {
    try {
      setIsProcessing(true);
      const res = await fetch(`/api/batch/${batchId}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.info('Đã bắt đầu xử lý hàng loạt video trong lô!');
        if (data.data) {
          setBatch(data.data);
        } else {
          fetchBatch();
        }
      } else {
        toast.error(data.error || 'Bắt đầu xử lý thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading && !batch) {
    return (
      <div className="flex items-center justify-center p-12 text-[#a1a1aa] text-sm">
        <Loader2 className="h-5 w-5 animate-spin mr-2 text-[#f97316]" />
        <span>Đang tải thông tin lô video...</span>
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="rounded-2xl border border-[#3f3f46] bg-[#18181b] p-8 text-center text-xs text-[#a1a1aa]">
        Không tìm thấy thông tin lô video
      </div>
    );
  }

  const completedCount =
    batch.items?.filter(
      (i) => i.status === 'done' || (typeof i.projectId === 'object' && i.projectId !== null && i.projectId?.status === 'done')
    ).length || 0;
  const totalCount = batch.items?.length || 0;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const isBatchDone = (completedCount === totalCount && totalCount > 0) || batch.status === 'done';

  return (
    <div className="flex flex-col gap-6 p-6 bg-[#18181b] rounded-2xl border border-[#3f3f46]">
      {/* Batch Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#3f3f46] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-white text-base">{batch.name || 'Lô video'}</h3>
            {isBatchDone ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#22c55e]/15 px-2.5 py-0.5 text-xs font-semibold text-[#22c55e] border border-[#22c55e]/30">
                <CheckCircle2 className="h-3 w-3" />
                <span>Hoàn tất 100%</span>
              </span>
            ) : batch.status === 'processing' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#eab308]/15 px-2.5 py-0.5 text-xs font-semibold text-[#eab308] border border-[#eab308]/30 animate-pulse">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Đang xử lý</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#71717a]/15 px-2.5 py-0.5 text-xs font-medium text-[#a1a1aa] border border-[#71717a]/30">
                <span>Chờ bắt đầu</span>
              </span>
            )}
          </div>

          <p className="text-xs text-[#a1a1aa] mt-1">
            Tiến độ lô: {completedCount}/{totalCount} video thành phẩm ({progressPercent}%)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {completedCount > 0 && (
            <a
              href={`/api/batch/${batchId}/export`}
              download
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#22c55e] px-4 py-2 text-xs font-bold text-black hover:bg-[#16a34a] transition-colors shadow-md"
            >
              <Download className="h-4 w-4" />
              <span>Tải trọn bộ .ZIP ({completedCount} video)</span>
            </a>
          )}

          <button
            type="button"
            onClick={handleStartProcessing}
            disabled={isProcessing || batch.status === 'processing' || isBatchDone}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#f97316] px-5 py-2 text-xs font-bold text-black hover:bg-[#ea580c] transition-colors disabled:opacity-50 shadow-md"
          >
            {isProcessing || batch.status === 'processing' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Đang xử lý trong BullMQ...</span>
              </>
            ) : isBatchDone ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>Đã xử lý xong toàn bộ</span>
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

      {/* Progress Bar */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-xs font-medium text-[#a1a1aa]">
          <span>Tiến trình hoàn thành toàn lô</span>
          <span className="font-mono text-white font-bold">{progressPercent}%</span>
        </div>
        <div className="w-full bg-[#09090b] rounded-full h-3 overflow-hidden border border-[#3f3f46]">
          <div
            className="bg-gradient-to-r from-[#f97316] via-[#eab308] to-[#22c55e] h-full rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Items List */}
      <div className="flex flex-col gap-3">
        <span className="text-xs font-semibold text-white">Danh sách chi tiết từng video ({totalCount})</span>
        <div className="flex flex-col gap-2 max-h-96 overflow-y-auto pr-1">
          {batch.items?.map((item, idx) => {
            const projectObj =
              typeof item.projectId === 'object' && item.projectId !== null
                ? item.projectId
                : null;
            const projectIdStr =
              projectObj?._id || (typeof item.projectId === 'string' ? item.projectId : '');
            const status: string = projectObj?.status || item.status;

            return (
              <div
                key={idx}
                className="flex items-center justify-between rounded-xl border border-[#3f3f46] bg-[#09090b] p-3.5 text-xs transition-colors hover:border-[#f97316]/50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#27272a] text-xs font-mono font-bold text-white">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate max-w-xs sm:max-w-md">
                      {projectObj?.name || `Video #${idx + 1}`}
                    </p>
                    <p className="text-[11px] text-[#a1a1aa] truncate max-w-xs sm:max-w-md mt-0.5">
                      {projectObj?.script?.text || 'Đang tạo kịch bản...'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {status === 'done' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#22c55e]/15 px-2.5 py-0.5 text-xs font-semibold text-[#22c55e] border border-[#22c55e]/30">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Hoàn tất</span>
                    </span>
                  ) : status === 'rendering' || status === 'processing' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#eab308]/15 px-2.5 py-0.5 text-xs font-semibold text-[#eab308] border border-[#eab308]/30 animate-pulse">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Đang xử lý</span>
                    </span>
                  ) : status === 'error' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#ef4444]/15 px-2.5 py-0.5 text-xs font-semibold text-[#ef4444] border border-[#ef4444]/30">
                      <AlertCircle className="h-3 w-3" />
                      <span>Lỗi</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#71717a]/15 px-2.5 py-0.5 text-xs font-medium text-[#a1a1aa] border border-[#71717a]/30">
                      <Clock className="h-3 w-3" />
                      <span>Chờ xử lý</span>
                    </span>
                  )}

                  {projectIdStr && (
                    <Link
                      href={`/projects/${projectIdStr}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#3f3f46] bg-[#27272a] px-3 py-1 text-xs font-semibold text-white hover:bg-[#3f3f46] transition-colors"
                      title="Mở vào Studio Editor để chỉnh sửa thủ công"
                    >
                      <ExternalLink className="h-3 w-3 text-[#f97316]" />
                      <span>Mở Editor</span>
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
