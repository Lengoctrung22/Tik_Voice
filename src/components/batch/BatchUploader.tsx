'use client';

import { useState, useEffect, useRef } from 'react';
import { useBatchStore, BatchUploadItem } from '@/stores/batchStore';
import {
  Upload,
  Film,
  Trash2,
  Loader2,
  Sparkles,
  Music,
  Subtitles,
  Mic,
  Settings,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { SCRIPT_TEMPLATES } from '@/components/editor/ScriptEditor';
import { PRESET_MUSIC_TRACKS } from '@/components/editor/BackgroundMusicPanel';
import { Voice } from '@/types';
import { SUPPORTED_VOICES } from '@/lib/tts/voices';

interface BatchUploaderProps {
  onBatchCreated: (batchId: string) => void;
}

export function BatchUploader({ onBatchCreated }: BatchUploaderProps) {
  const {
    items,
    addFiles,
    removeItem,
    updateItem,
    clearItems,
    batchName,
    setBatchName,
    sharedConfig,
    updateSharedConfig,
    isSubmitting,
    setIsSubmitting,
    resetBatchForm,
  } = useBatchStore();

  const [voices, setVoices] = useState<Voice[]>(SUPPORTED_VOICES);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/tts/voices')
      .then((res) => res.json())
      .then((res) => {
        if (res.success && res.data && res.data.length > 0) {
          setVoices(res.data);
        }
      })
      .catch(() => {});
  }, []);

  const handleFiles = (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    const validFiles = Array.from(files).filter((f) => f.type.startsWith('video/'));
    if (validFiles.length === 0) {
      toast.error('Vui lòng chỉ chọn tệp định dạng video (MP4, MOV, WebM)');
      return;
    }
    addFiles(validFiles);
    toast.success(`Đã thêm ${validFiles.length} video vào lô`);
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleSubmitBatch = async () => {
    if (items.length === 0) {
      toast.error('Vui lòng tải lên ít nhất một video');
      return;
    }

    try {
      setIsSubmitting(true);
      const toastId = toast.loading('Đang khởi tạo các video và cấu hình lô...');

      const createdProjectIds: string[] = [];

      // 1. Upload each video file sequentially to establish project records
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        updateItem(item.id, { status: 'uploading' });

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

          // Configure individual script, product info, and shared configs
          const scriptPayload: Record<string, any> = {
            productName: item.productName,
            productInfo: item.productInfo,
            templateId: sharedConfig.templateId,
          };

          if (item.scriptText) {
            scriptPayload.text = item.scriptText;
          } else if (item.productName) {
            scriptPayload.generateWithAI = true;
          }

          const scriptRes = await fetch(`/api/projects/${project._id}/script`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(scriptPayload),
          });
          const scriptData = await scriptRes.json();

          // Apply shared subtitle style
          await fetch(`/api/projects/${project._id}/subtitle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              enabled: true,
              style: sharedConfig.subtitleStyle,
            }),
          });

          // Apply shared background music and TTS settings
          await fetch(`/api/projects/${project._id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              bgMusic: sharedConfig.bgMusic?.path ? sharedConfig.bgMusic : undefined,
              tts: {
                voice: sharedConfig.voice,
                engine: sharedConfig.engine,
                speed: sharedConfig.speed,
                pitch: sharedConfig.pitch,
              },
            }),
          });

          // Generate TTS speech so audio and words timestamps exist for preview and render
          const textForTts = scriptData?.data?.script?.text || item.scriptText;
          if (textForTts) {
            await fetch(`/api/projects/${project._id}/tts`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: textForTts,
                voice: sharedConfig.voice,
                engine: sharedConfig.engine,
                speed: sharedConfig.speed,
                pitch: sharedConfig.pitch,
              }),
            });
          }

          updateItem(item.id, { status: 'done', projectId: project._id });
        } else {
          updateItem(item.id, { status: 'error', error: uploadData.error });
        }
      }

      if (createdProjectIds.length === 0) {
        toast.error('Không có video nào tải lên thành công để khởi tạo lô', { id: toastId });
        return;
      }

      // 2. Create the BatchGroup in MongoDB
      const finalBatchName =
        batchName.trim() ||
        `Lô ${items.length} video (${new Date().toLocaleDateString('vi-VN')})`;

      const batchRes = await fetch('/api/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: finalBatchName,
          projectIds: createdProjectIds,
          sharedConfig,
        }),
      });

      const batchData = await batchRes.json();
      if (batchData.success && batchData.data?._id) {
        toast.success(`Đã khởi tạo lô ${createdProjectIds.length} video thành công!`, {
          id: toastId,
        });
        resetBatchForm();
        onBatchCreated(batchData.data._id);
      } else {
        toast.error('Tạo lô batch thất bại', { id: toastId });
      }
    } catch (err: any) {
      toast.error('Lỗi khi xử lý tải lên hàng loạt: ' + (err?.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 bg-[#18181b] rounded-2xl border border-[#3f3f46]">
      <div>
        <h3 className="font-bold text-white text-base">Tải Lên Video Hàng Loạt (Batch Studio)</h3>
        <p className="text-xs text-[#a1a1aa] mt-0.5">
          Kéo thả nhiều video sản phẩm, cài đặt chung giọng đọc AI, style phụ đề và nhạc nền
        </p>
      </div>

      {/* Drag & Drop Zone */}
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-2xl cursor-pointer transition-all group ${
          isDragging
            ? 'border-[#f97316] bg-[#431407]/40 scale-[1.01]'
            : 'border-[#3f3f46] hover:border-[#f97316] bg-[#09090b]'
        }`}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#27272a] group-hover:bg-[#431407] text-[#a1a1aa] group-hover:text-[#f97316] transition-colors mb-3">
          <Upload className="h-6 w-6" />
        </div>
        <p className="font-semibold text-white text-sm">
          Kéo thả nhiều video vào đây hoặc nhấn để duyệt tệp
        </p>
        <p className="text-xs text-[#71717a] mt-1">Hỗ trợ MP4, MOV, WebM — Không giới hạn số lượng</p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="video/mp4,video/quicktime,video/webm"
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
      </label>

      {/* Shared Configuration Box (Giọng đọc, Kịch bản, Style phụ đề, Nhạc nền) */}
      <div className="rounded-xl border border-[#3f3f46] bg-[#09090b] p-5 flex flex-col gap-4 text-xs">
        <div className="flex items-center gap-2 border-b border-[#3f3f46]/80 pb-3">
          <Settings className="h-4 w-4 text-[#f97316]" />
          <h4 className="font-bold text-white text-sm">Cấu Hình Chung Áp Dụng Cho Cả Lô (Shared Config)</h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Batch Name */}
          <div>
            <label className="block font-medium text-[#a1a1aa] mb-1">Tên lô video</label>
            <input
              type="text"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              placeholder="VD: Chiến dịch Son Môi Tháng 10..."
              className="w-full rounded-lg border border-[#3f3f46] bg-[#18181b] p-2 text-white placeholder-[#71717a] focus:border-[#f97316] focus:outline-none"
            />
          </div>

          {/* Shared Voice */}
          <div>
            <label className="block font-medium text-[#a1a1aa] mb-1 flex items-center gap-1">
              <Mic className="h-3 w-3 text-[#f97316]" />
              <span>Giọng đọc TTS</span>
            </label>
            <select
              value={sharedConfig.voice}
              onChange={(e) => updateSharedConfig({ voice: e.target.value })}
              className="w-full rounded-lg border border-[#3f3f46] bg-[#18181b] p-2 text-white focus:border-[#f97316] focus:outline-none"
            >
              {voices.length > 0 ? (
                voices.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.displayName}
                  </option>
                ))
              ) : (
                <>
                  <option value="vi-VN-HoaiMyNeural">Hoài My (Nữ Bắc - Chuẩn)</option>
                  <option value="vi-VN-NamMinhNeural">Nam Minh (Nam Bắc - Dứt khoát)</option>
                </>
              )}
            </select>
          </div>

          {/* Shared Script Template */}
          <div>
            <label className="block font-medium text-[#a1a1aa] mb-1 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-[#f97316]" />
              <span>Mẫu kịch bản AI</span>
            </label>
            <select
              value={sharedConfig.templateId}
              onChange={(e) => updateSharedConfig({ templateId: e.target.value })}
              className="w-full rounded-lg border border-[#3f3f46] bg-[#18181b] p-2 text-white focus:border-[#f97316] focus:outline-none"
            >
              {SCRIPT_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Shared Background Music */}
          <div>
            <label className="block font-medium text-[#a1a1aa] mb-1 flex items-center gap-1">
              <Music className="h-3 w-3 text-[#f97316]" />
              <span>Nhạc nền chung</span>
            </label>
            <select
              value={sharedConfig.bgMusic?.path || ''}
              onChange={(e) => {
                const found = PRESET_MUSIC_TRACKS.find((p) => p.path === e.target.value);
                if (found) {
                  updateSharedConfig({
                    bgMusic: {
                      path: found.path,
                      name: found.name,
                      volume: 0.12,
                    },
                  });
                } else {
                  updateSharedConfig({ bgMusic: undefined });
                }
              }}
              className="w-full rounded-lg border border-[#3f3f46] bg-[#18181b] p-2 text-white focus:border-[#f97316] focus:outline-none"
            >
              <option value="">Không dùng nhạc nền</option>
              {PRESET_MUSIC_TRACKS.map((t) => (
                <option key={t.path} value={t.path}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Subtitle Style Quick Presets */}
        <div className="pt-2 border-t border-[#3f3f46]/50 flex flex-wrap items-center gap-4 text-xs">
          <span className="text-[#a1a1aa] flex items-center gap-1">
            <Subtitles className="h-3.5 w-3.5 text-[#f97316]" />
            <span>Phụ đề karaoke:</span>
          </span>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#71717a]">Chữ:</span>
            <input
              type="color"
              value={sharedConfig.subtitleStyle.primaryColor || '#FFFFFF'}
              onChange={(e) =>
                updateSharedConfig({
                  subtitleStyle: { primaryColor: e.target.value },
                })
              }
              className="h-6 w-6 rounded cursor-pointer border border-[#3f3f46] bg-transparent"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#71717a]">Highlight:</span>
            <input
              type="color"
              value={sharedConfig.subtitleStyle.highlightColor || '#FFD700'}
              onChange={(e) =>
                updateSharedConfig({
                  subtitleStyle: { highlightColor: e.target.value },
                })
              }
              className="h-6 w-6 rounded cursor-pointer border border-[#3f3f46] bg-transparent"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#71717a]">Số từ/cụm:</span>
            <select
              value={sharedConfig.subtitleStyle.wordsPerGroup || 3}
              onChange={(e) =>
                updateSharedConfig({
                  subtitleStyle: { wordsPerGroup: parseInt(e.target.value, 10) },
                })
              }
              className="rounded border border-[#3f3f46] bg-[#18181b] px-2 py-1 text-white text-xs"
            >
              <option value={2}>2 từ</option>
              <option value={3}>3 từ (Khuyên dùng)</option>
              <option value={4}>4 từ</option>
            </select>
          </div>
        </div>
      </div>

      {/* Items Table List */}
      {items.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs font-semibold text-white">
            <span>Danh sách video trong lô ({items.length})</span>
            <button
              type="button"
              onClick={clearItems}
              className="text-[#ef4444] hover:underline text-[11px]"
            >
              Xóa tất cả
            </button>
          </div>

          <div className="flex flex-col gap-2.5 max-h-96 overflow-y-auto pr-1">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-[#3f3f46] bg-[#09090b] p-3 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-44 truncate">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[#27272a] text-[11px] font-mono text-[#a1a1aa]">
                    {idx + 1}
                  </span>
                  <Film className="h-4 w-4 text-[#f97316] shrink-0" />
                  <span className="font-semibold text-white truncate" title={item.file.name}>
                    {item.file.name}
                  </span>
                </div>

                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={item.productName}
                    onChange={(e) => updateItem(item.id, { productName: e.target.value })}
                    placeholder="Tên sản phẩm *"
                    className="rounded-lg border border-[#3f3f46] bg-[#18181b] px-2.5 py-1.5 text-xs text-white placeholder-[#71717a] focus:border-[#f97316] focus:outline-none"
                  />
                  <input
                    type="text"
                    value={item.productInfo}
                    onChange={(e) => updateItem(item.id, { productInfo: e.target.value })}
                    placeholder="Thông tin / ưu điểm..."
                    className="rounded-lg border border-[#3f3f46] bg-[#18181b] px-2.5 py-1.5 text-xs text-white placeholder-[#71717a] focus:border-[#f97316] focus:outline-none"
                  />
                  <input
                    type="text"
                    value={item.scriptText}
                    onChange={(e) => updateItem(item.id, { scriptText: e.target.value })}
                    placeholder="Kịch bản (để trống để AI tự viết)..."
                    className="rounded-lg border border-[#3f3f46] bg-[#18181b] px-2.5 py-1.5 text-xs text-white placeholder-[#71717a] focus:border-[#f97316] focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
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
      <div className="flex items-center justify-between pt-2">
        <span className="text-xs text-[#71717a]">
          {items.length > 0
            ? `Sẵn sàng khởi tạo ${items.length} video với cấu hình chung đã chọn`
            : 'Hãy kéo thả ít nhất 1 video để bắt đầu'}
        </span>

        <button
          type="button"
          onClick={handleSubmitBatch}
          disabled={isSubmitting || items.length === 0}
          className="inline-flex items-center gap-2 rounded-xl bg-[#f97316] px-6 py-2.5 text-xs font-bold text-black hover:bg-[#ea580c] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Đang tải lên và cấu hình...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 fill-current" />
              <span>Khởi tạo lô {items.length > 0 ? `(${items.length} video)` : ''}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
