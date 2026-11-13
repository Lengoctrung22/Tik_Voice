'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Archive,
  Download,
  ExternalLink,
  RefreshCw,
  RotateCcw,
  Trash2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { StatusBadge } from '@/components/ui/status-badge';
import type { IPopulatedBatchGroup, IProject } from '@/types';

interface BatchProgressProps {
  batch: IPopulatedBatchGroup;
  onBatchUpdated: (batch: IPopulatedBatchGroup) => void;
  onBatchDeleted: (batchId: string) => void;
}

export function BatchProgress({
  batch,
  onBatchUpdated,
  onBatchDeleted,
}: BatchProgressProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const hasActiveItems = batch.items.some(
    (item) => item.status === 'processing' || item.status === 'pending'
  );
  const shouldPoll = batch.status === 'processing' || (batch.status === 'pending' && hasActiveItems);

  const fetchLatest = useCallback(async () => {
    try {
      const res = await fetch(`/api/batch/${batch._id}`);
      const json = (await res.json()) as {
        success: boolean;
        data?: IPopulatedBatchGroup;
      };
      if (json.success && json.data) {
        onBatchUpdated(json.data);
      }
    } catch {
      // Ignore transient network errors
    }
  }, [batch._id, onBatchUpdated]);

  // Chỉ poll khi lô đang chạy; dừng hẳn khi terminal (done/error và không còn item processing)
  useEffect(() => {
    if (!shouldPoll) return;
    const timer = window.setInterval(fetchLatest, 2500);
    return () => window.clearInterval(timer);
  }, [fetchLatest, shouldPoll]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await fetchLatest();
    setRefreshing(false);
  };

  const handleRetryErrors = async () => {
    setRetrying(true);
    try {
      const res = await fetch(`/api/batch/${batch._id}/retry`, { method: 'POST' });
      const json = (await res.json()) as {
        success: boolean;
        data?: IPopulatedBatchGroup;
        message?: string;
        error?: string;
      };
      if (!res.ok || !json.success || !json.data) {
        toast.error(json.error || 'Thử lại thất bại');
        return;
      }
      onBatchUpdated(json.data);
      toast.success(json.message || 'Đã đưa các mục lỗi vào hàng đợi xử lý lại');
    } catch {
      toast.error('Lỗi kết nối khi thử lại');
    } finally {
      setRetrying(false);
    }
  };

  const handleDeleteBatch = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/batch/${batch._id}`, { method: 'DELETE' });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Không thể xóa lô video');
        return;
      }
      setConfirmDeleteOpen(false);
      toast.success('Đã xóa lô xử lý hàng loạt');
      onBatchDeleted(batch._id);
    } catch {
      toast.error('Lỗi kết nối khi xóa lô');
    } finally {
      setDeleting(false);
    }
  };

  const totalCount = batch.items.length;
  const doneCount = batch.items.filter((i) => i.status === 'done').length;
  const errorCount = batch.items.filter((i) => i.status === 'error').length;
  const progressPct = totalCount > 0 ? Math.round(((doneCount + errorCount) / totalCount) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base font-bold text-[#fafafa]">{batch.name}</h2>
              <StatusBadge status={batch.status} />
            </div>
            <p className="mt-1 text-xs text-[#a1a1aa] tabular-nums">
              Hoàn tất {doneCount}/{totalCount} video
              {errorCount > 0 ? ` | ${errorCount} mục gặp lỗi` : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </Button>

            {errorCount > 0 && (
              <Button
                size="sm"
                variant="accent"
                onClick={handleRetryErrors}
                disabled={retrying}
                className="gap-1.5"
              >
                {retrying ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" />
                )}
                <span>Thử lại mục lỗi ({errorCount})</span>
              </Button>
            )}

            {doneCount > 0 && (
              <a
                href={`/api/batch/${batch._id}/export`}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-emerald-500 px-3 text-[11px] font-bold text-black hover:bg-emerald-400 transition-colors"
              >
                <Archive className="h-3.5 w-3.5" />
                <span>Tải tất cả (.ZIP)</span>
              </a>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmDeleteOpen(true)}
              aria-label="Xóa lô này"
              className="text-[#9ca3af] hover:text-red-400 hover:border-red-500/30"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Batch Overall Progress Bar */}
        <div className="space-y-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#18181b]">
            <div
              className={`h-full transition-all duration-300 ${
                errorCount > 0 && doneCount === 0
                  ? 'bg-red-500'
                  : doneCount === totalCount && totalCount > 0
                  ? 'bg-emerald-500'
                  : 'bg-[#f97316]'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Item List */}
      <div className="space-y-2.5">
        {batch.items.map((item, idx) => {
          const proj =
            typeof item.projectId === 'object' && item.projectId !== null
              ? (item.projectId as IProject)
              : null;
          const projId = proj?._id || (typeof item.projectId === 'string' ? item.projectId : '');
          const projName = proj?.name || `Video #${idx + 1}`;

          return (
            <div
              key={`${projId}_${idx}`}
              className="rounded-xl border border-white/[0.08] bg-[#111113] p-3.5 space-y-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#18181b] font-mono text-[11px] font-bold text-[#a1a1aa]">
                    {idx + 1}
                  </span>
                  <span className="truncate text-xs font-semibold text-[#fafafa]">
                    {projName}
                  </span>
                  <StatusBadge status={item.status} />
                </div>

                {projId && (
                  <div className="flex items-center gap-1.5">
                    {item.status === 'done' && (
                      <a
                        href={`/api/projects/${projId}/export`}
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/12 px-2.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/25"
                      >
                        <Download className="h-3 w-3" />
                        <span>Tải MP4</span>
                      </a>
                    )}
                    <Link
                      href={`/projects/${projId}`}
                      className="inline-flex h-7 items-center gap-1 rounded-md border border-white/[0.1] bg-[#18181b] px-2.5 text-[11px] font-medium text-[#d4d4d8] hover:text-white hover:bg-[#27272a]"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span>Mở Studio</span>
                    </Link>
                  </div>
                )}
              </div>

              {item.status === 'error' && item.error && (
                <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-300">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{item.error}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Dialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Xóa lô xử lý hàng loạt?"
        description="Thao tác này chỉ xóa danh sách lô, các dự án đã tạo vẫn được giữ lại ở trang Dự án."
      >
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmDeleteOpen(false)}
            disabled={deleting}
          >
            Giữ lại
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDeleteBatch}
            disabled={deleting}
          >
            {deleting ? 'Đang xóa...' : 'Xác nhận xóa'}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
