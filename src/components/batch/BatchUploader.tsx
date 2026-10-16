'use client';

import { useState } from 'react';
import { Upload, Film, Trash2, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export interface BatchUploadItem {
  id: string;
  file: File;
  productName: string;
  scriptText: string;
}

interface BatchUploaderProps {
  onBatchCreated: (batchId: string) => void;
}

export function BatchUploader({ onBatchCreated }: BatchUploaderProps) {
  const [items, setItems] = useState<BatchUploadItem[]>([]);
  const [batchName, setBatchName] = useState('');
  const [sharedVoice, setSharedVoice] = useState('vi-VN-HoaiMyNeural');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const newItems: BatchUploadItem[] = files.map((f, i) => ({
      id: `${Date.now()}_${i}`,
      file: f,
      productName: f.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
      scriptText: '',
    }));

    setItems((prev) => [...prev, ...newItems]);
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateItem = (id: string, field: 'productName' | 'scriptText', value: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleSubmitBatch = async () => {
    if (items.length === 0) {
      toast.error('Vui lòng tải lên ít nhất một video');
      return;
    }

    try {
      setIsSubmitting(true);
      const toastId = toast.loading('Đang khởi tạo các video trong lô...');

      // 1. Upload each video and create project
      const createdProjectIds: string[] = [];
      for (const item of items) {
        const formData = new FormData();
        formData.append('file', item.file);
        formData.append('type', 'video');

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        const uploadData = await uploadRes.json();

        if (uploadData.success && uploadData.data?.project) {
          const project = uploadData.data.project;
          createdProjectIds.push(project._id);

          // Update script/product info if provided
          if (item.scriptText || item.productName) {
            await fetch(`/api/projects/${project._id}/script`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: item.scriptText,
                productName: item.productName,
              }),
            });
          }
        }
      }

      // 2. Create BatchGroup in MongoDB
      const batchRes = await fetch('/api/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: batchName || `Lô ${items.length} video (${new Date().toLocaleDateString('vi-VN')})`,
          projectIds: createdProjectIds,
          sharedConfig: {
            voice: sharedVoice,
          },
        }),
      });

      const batchData = await batchRes.json();
      if (batchData.success && batchData.data?._id) {
        toast.success(`Đã khởi tạo lô ${items.length} video thành công!`, { id: toastId });
        onBatchCreated(batchData.data._id);
      } else {
        toast.error('Tạo lô batch thất bại', { id: toastId });
      }
    } catch {
      toast.error('Lỗi kết nối khi tạo lô hàng loạt');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 p-4 bg-[#18181b] rounded-2xl border border-[#3f3f46]">
      <div>
        <h3 className="font-bold text-white text-base">Tải Lên Video Hàng Loạt (Batch Upload)</h3>
        <p className="text-xs text-[#a1a1aa] mt-0.5">
          Kéo thả nhiều video sản phẩm cùng lúc, cấu hình chung giọng đọc và xử lý tự động
        </p>
      </div>

      {/* Drag & Drop Zone */}
      <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-[#3f3f46] hover:border-[#f97316] rounded-2xl bg-[#09090b] cursor-pointer transition-colors group">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#27272a] group-hover:bg-[#431407] text-[#a1a1aa] group-hover:text-[#f97316] transition-colors mb-3">
          <Upload className="h-6 w-6" />
        </div>
        <p className="font-semibold text-white text-sm">Kéo thả các video vào đây hoặc nhấn để chọn tệp</p>
        <p className="text-xs text-[#71717a] mt-1">Hỗ trợ MP4, MOV, WebM — Tối đa 20 video mỗi đợt</p>
        <input
          type="file"
          multiple
          accept="video/mp4,video/quicktime,video/webm"
          onChange={handleFilesSelected}
          className="hidden"
        />
      </label>

      {/* Shared Config Header */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-[#3f3f46] bg-[#09090b] p-4 text-xs">
        <div>
          <label className="block font-medium text-[#a1a1aa] mb-1">Tên lô video</label>
          <input
            type="text"
            value={batchName}
            onChange={(e) => setBatchName(e.target.value)}
            placeholder="Ví dụ: Chiến dịch Tết 2026 - Thời trang nữ..."
            className="w-full rounded-lg border border-[#3f3f46] bg-[#18181b] p-2 text-white placeholder-[#71717a] focus:border-[#f97316] focus:outline-none"
          />
        </div>

        <div>
          <label className="block font-medium text-[#a1a1aa] mb-1">Giọng đọc chung cho cả lô</label>
          <select
            value={sharedVoice}
            onChange={(e) => setSharedVoice(e.target.value)}
            className="w-full rounded-lg border border-[#3f3f46] bg-[#18181b] p-2 text-white focus:border-[#f97316] focus:outline-none"
          >
            <option value="vi-VN-HoaiMyNeural">Hoài My (Nữ Bắc - Truyền cảm)</option>
            <option value="vi-VN-NamMinhNeural">Nam Minh (Nam Bắc - Dứt khoát)</option>
          </select>
        </div>
      </div>

      {/* Items Table List */}
      {items.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-semibold text-white">
            <span>Danh sách video trong lô ({items.length})</span>
            <button
              type="button"
              onClick={() => setItems([])}
              className="text-[#ef4444] hover:underline text-[11px]"
            >
              Xóa tất cả
            </button>
          </div>

          <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-[#3f3f46] bg-[#09090b] p-3 text-xs"
              >
                <div className="flex items-center gap-2 min-w-40 truncate">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[#27272a] text-[11px] font-mono text-[#a1a1aa]">
                    {idx + 1}
                  </span>
                  <Film className="h-4 w-4 text-[#f97316] shrink-0" />
                  <span className="font-medium text-white truncate" title={item.file.name}>
                    {item.file.name}
                  </span>
                </div>

                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={item.productName}
                    onChange={(e) => handleUpdateItem(item.id, 'productName', e.target.value)}
                    placeholder="Tên sản phẩm..."
                    className="rounded-lg border border-[#3f3f46] bg-[#18181b] px-2.5 py-1.5 text-white placeholder-[#71717a] focus:border-[#f97316] focus:outline-none"
                  />
                  <input
                    type="text"
                    value={item.scriptText}
                    onChange={(e) => handleUpdateItem(item.id, 'scriptText', e.target.value)}
                    placeholder="Kịch bản (để trống nếu tạo sau)..."
                    className="rounded-lg border border-[#3f3f46] bg-[#18181b] px-2.5 py-1.5 text-white placeholder-[#71717a] focus:border-[#f97316] focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveItem(item.id)}
                  className="p-1.5 text-[#71717a] hover:text-[#ef4444] rounded hover:bg-[#27272a] self-end sm:self-center transition-colors"
                  title="Xóa tệp khỏi lô"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submit Button */}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={handleSubmitBatch}
          disabled={isSubmitting || items.length === 0}
          className="inline-flex items-center gap-2 rounded-xl bg-[#f97316] px-6 py-2.5 text-xs font-bold text-black hover:bg-[#ea580c] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Đang tải lên và khởi tạo...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 fill-current" />
              <span>Tạo lô {items.length > 0 ? `(${items.length} video)` : ''}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
