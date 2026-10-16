'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { BatchUploader } from '@/components/batch/BatchUploader';
import { BatchProgress } from '@/components/batch/BatchProgress';
import { IBatchGroup } from '@/types';
import { Layers, Plus, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

export default function BatchPage() {
  const [batches, setBatches] = useState<IBatchGroup[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  const fetchBatches = async () => {
    try {
      const res = await fetch('/api/batch');
      const data = await res.json();
      if (data.success && data.data) {
        setBatches(data.data);
        if (data.data.length > 0 && !selectedBatchId) {
          setSelectedBatchId(data.data[0]._id);
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const handleBatchCreated = (newBatchId: string) => {
    setSelectedBatchId(newBatchId);
    setIsCreatingNew(false);
    fetchBatches();
  };

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col text-white">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Layers className="h-6 w-6 text-[#f97316]" />
              <span>Không Gian Xử Lý Lô Video (Batch Studio)</span>
            </h1>
            <p className="text-xs text-[#a1a1aa] mt-1">
              Tạo hàng loạt video TikTok Affiliate với 1 giọng đọc và style phụ đề duy nhất
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsCreatingNew(!isCreatingNew)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#f97316] px-4 py-2 text-xs font-bold text-black hover:bg-[#ea580c] transition-all shadow-md self-start sm:self-auto"
          >
            <Plus className="h-4 w-4 stroke-[3]" />
            <span>{isCreatingNew ? 'Xem danh sách lô' : 'Tạo lô video mới'}</span>
          </button>
        </div>

        {isCreatingNew ? (
          <BatchUploader onBatchCreated={handleBatchCreated} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left list of batches */}
            <div className="flex flex-col gap-3 lg:col-span-1">
              <span className="text-xs font-semibold text-[#a1a1aa]">Các lô đã tạo</span>

              {batches.length === 0 ? (
                <div className="rounded-xl border border-[#3f3f46] bg-[#18181b] p-6 text-center text-xs text-[#71717a]">
                  Chưa có lô video nào. Nhấn "Tạo lô video mới" để bắt đầu.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {batches.map((b) => {
                    const isSelected = selectedBatchId === b._id;
                    const doneCount = b.items?.filter((i) => (i.projectId as any)?.status === 'done').length || 0;
                    const totalCount = b.items?.length || 0;

                    return (
                      <button
                        key={b._id}
                        type="button"
                        onClick={() => setSelectedBatchId(b._id)}
                        className={`rounded-xl border p-3 text-left transition-all ${
                          isSelected
                            ? 'border-[#f97316] bg-[#431407]/40 shadow-sm'
                            : 'border-[#3f3f46] bg-[#18181b] hover:bg-[#27272a]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-semibold text-xs text-white truncate max-w-[160px]">
                            {b.name || 'Lô video'}
                          </p>
                          <span className="text-[10px] text-[#71717a]">
                            {doneCount}/{totalCount}
                          </span>
                        </div>
                        <div className="w-full bg-[#27272a] h-1 rounded-full overflow-hidden mt-2">
                          <div
                            className="bg-[#22c55e] h-full"
                            style={{
                              width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Active Batch Progress */}
            <div className="lg:col-span-3">
              {selectedBatchId ? (
                <BatchProgress batchId={selectedBatchId} />
              ) : (
                <div className="rounded-2xl border border-[#3f3f46] bg-[#18181b] p-12 text-center text-xs text-[#a1a1aa]">
                  Chọn một lô video ở danh sách bên trái hoặc tạo lô mới để theo dõi tiến độ
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
