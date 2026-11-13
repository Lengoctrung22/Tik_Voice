'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Layers, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Header } from '@/components/layout/Header';
import { BatchUploader } from '@/components/batch/BatchUploader';
import { BatchProgress } from '@/components/batch/BatchProgress';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { useBatchStore } from '@/stores/batchStore';
import type { IPopulatedBatchGroup } from '@/types';

function BatchStudioContent() {
  const searchParams = useSearchParams();
  const isNewQuery = searchParams.get('new') === '1';

  const { batches, activeBatch, setBatches, setActiveBatch } = useBatchStore();
  const [mode, setMode] = useState<'create' | 'view'>(isNewQuery ? 'create' : 'view');
  const [loadingList, setLoadingList] = useState(true);

  const loadBatches = useCallback(async () => {
    try {
      const res = await fetch('/api/batch');
      const json = (await res.json()) as {
        success: boolean;
        data?: IPopulatedBatchGroup[];
      };
      if (json.success && Array.isArray(json.data)) {
        setBatches(json.data);
        if (!isNewQuery && json.data.length > 0 && !useBatchStore.getState().activeBatch) {
          setActiveBatch(json.data[0]);
          setMode('view');
        } else if (json.data.length === 0) {
          setMode('create');
        }
      }
    } catch {
      toast.error('Không thể tải danh sách lô xử lý');
    } finally {
      setLoadingList(false);
    }
  }, [isNewQuery, setActiveBatch, setBatches]);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  useEffect(() => {
    if (isNewQuery) {
      setMode('create');
    }
  }, [isNewQuery]);

  const handleBatchCreated = (created: IPopulatedBatchGroup) => {
    setBatches([created, ...batches]);
    setActiveBatch(created);
    setMode('view');
  };

  const handleBatchUpdated = useCallback(
    (updated: IPopulatedBatchGroup) => {
      setActiveBatch(updated);
      setBatches(batches.map((b) => (b._id === updated._id ? updated : b)));
    },
    [batches, setActiveBatch, setBatches]
  );

  const handleBatchDeleted = (deletedId: string) => {
    const remaining = batches.filter((b) => b._id !== deletedId);
    setBatches(remaining);
    if (remaining.length > 0) {
      setActiveBatch(remaining[0]);
      setMode('view');
    } else {
      setActiveBatch(null);
      setMode('create');
    }
  };

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-[270px_minmax(0,1fr)] gap-6 items-start">
        {/* Left Sidebar: Batches History */}
        <aside className="rounded-xl border border-white/[0.08] bg-[#111113] p-3 space-y-3">
          <Button
            onClick={() => setMode('create')}
            className="w-full gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span>Tạo lô mới</span>
          </Button>

          <div className="space-y-1.5">
            <div className="px-1 text-[11px] font-semibold uppercase tracking-wider text-[#9ca3af]">
              Lịch sử lô ({batches.length})
            </div>

            {loadingList ? (
              <div className="space-y-2 py-2">
                <div className="h-14 animate-pulse rounded-lg bg-[#18181b]" />
                <div className="h-14 animate-pulse rounded-lg bg-[#18181b]" />
              </div>
            ) : batches.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-[#9ca3af]">
                Chưa có lô xử lý nào
              </p>
            ) : (
              <div className="space-y-1.5 max-h-[65vh] overflow-y-auto pr-0.5">
                {batches.map((b) => {
                  const selected = mode === 'view' && activeBatch?._id === b._id;
                  const doneCount = b.items.filter((i) => i.status === 'done').length;
                  return (
                    <button
                      key={b._id}
                      type="button"
                      onClick={() => {
                        setActiveBatch(b);
                        setMode('view');
                      }}
                      className={`w-full rounded-lg border p-2.5 text-left transition-colors cursor-pointer ${
                        selected
                          ? 'border-[#f97316]/60 bg-[#f97316]/10'
                          : 'border-white/[0.06] bg-[#18181b] hover:border-white/[0.15]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="truncate text-xs font-semibold text-[#fafafa]">
                          {b.name}
                        </span>
                        <StatusBadge status={b.status} />
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-[10px] text-[#9ca3af] tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          <Layers className="h-3 w-3" />
                          {doneCount}/{b.items.length} video
                        </span>
                        <span>
                          {new Date(b.createdAt).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* Main Workspace */}
        <section className="min-w-0">
          {mode === 'view' && activeBatch ? (
            <BatchProgress
              batch={activeBatch}
              onBatchUpdated={handleBatchUpdated}
              onBatchDeleted={handleBatchDeleted}
            />
          ) : (
            <BatchUploader onBatchCreated={handleBatchCreated} />
          )}
        </section>
      </div>
    </main>
  );
}

export default function BatchPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-[#fafafa] flex flex-col">
      <Header />
      <Suspense
        fallback={
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 py-8">
            <div className="h-64 animate-pulse rounded-xl bg-[#111113]" />
          </main>
        }
      >
        <BatchStudioContent />
      </Suspense>
    </div>
  );
}
