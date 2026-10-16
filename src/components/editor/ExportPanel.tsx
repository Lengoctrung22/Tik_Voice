'use client';

import { useState, useEffect } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import {
  Rocket,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Tv,
  Sparkles,
  FileVideo,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatFileSize } from '@/lib/utils';

export function ExportPanel() {
  const {
    project,
    updateProjectPartial,
    isRendering,
    setIsRendering,
    renderProgress,
    setRenderProgress,
    activeJobId,
    setActiveJobId,
    setPreviewMode,
  } = useEditorStore();

  const [quality, setQuality] = useState<'fast' | 'balanced' | 'high'>(
    project?.export?.quality || 'balanced'
  );
  const [resolution, setResolution] = useState<string>(
    project?.export?.resolution || '1080x1920'
  );



  const handleStartRender = async () => {
    if (!project?._id) return;

    if (!project.video?.path) {
      toast.error('Chưa có video gốc. Hãy tải lên video ở tab Kịch bản.');
      return;
    }

    if (!project.tts?.audioPath) {
      toast.error('Chưa có giọng đọc TTS. Hãy tạo giọng đọc ở tab Giọng đọc.');
      return;
    }

    try {
      setIsRendering(true);
      setRenderProgress(5);

      const res = await fetch(`/api/projects/${project._id}/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quality, resolution }),
      });

      const data = await res.json();
      if (data.success && data.data?.jobId) {
        setActiveJobId(data.data.jobId);
        toast.info('Đã đưa tác vụ render FFmpeg vào hàng đợi BullMQ...');
      } else {
        setIsRendering(false);
        toast.error(data.error || 'Khởi động render thất bại');
      }
    } catch {
      setIsRendering(false);
      toast.error('Lỗi kết nối khi kích hoạt render');
    }
  };

  const isDone = project?.status === 'done' && Boolean(project.export?.path);

  return (
    <div className="flex flex-col gap-5 p-4 text-sm">
      <div>
        <h3 className="font-semibold text-white">Xuất Bản & Render Video (FFmpeg)</h3>
        <p className="text-xs text-[#a1a1aa] mt-0.5">
          Tự động ghép video chuẩn 9:16, mix nhạc nền, burn phụ đề karaoke và nén chuẩn H.264
        </p>
      </div>

      {/* Resolution Selection */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-[#a1a1aa]">Độ phân giải đầu ra</label>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            {
              id: '1080x1920',
              label: '1080 x 1920 (FHD 9:16)',
              desc: 'Chuẩn TikTok, Reels, Shorts',
            },
            {
              id: '720x1280',
              label: '720 x 1280 (HD 9:16)',
              desc: 'Tối ưu dung lượng nhẹ',
            },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={isRendering}
              onClick={() => setResolution(item.id)}
              className={`rounded-xl border p-3 text-left transition-all ${
                resolution === item.id
                  ? 'border-[#f97316] bg-[#431407]/40 shadow-sm'
                  : 'border-[#3f3f46] bg-[#09090b] hover:bg-[#27272a]'
              }`}
            >
              <p className="font-semibold text-xs text-white">{item.label}</p>
              <p className="text-[11px] text-[#a1a1aa] mt-0.5">{item.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Quality Options */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-[#a1a1aa]">Chất lượng nén video</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {[
            {
              id: 'fast',
              label: 'Nhanh (Fast)',
              desc: 'Ultrafast - Nhanh nhất',
            },
            {
              id: 'balanced',
              label: 'Cân bằng (Balanced)',
              desc: 'Medium CRF 23 - Chuẩn TikTok',
            },
            {
              id: 'high',
              label: 'Cao cấp (High)',
              desc: 'Slow CRF 18 - Nét căng',
            },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={isRendering}
              onClick={() => setQuality(item.id as any)}
              className={`rounded-xl border p-3 text-left transition-all ${
                quality === item.id
                  ? 'border-[#f97316] bg-[#431407]/40 shadow-sm'
                  : 'border-[#3f3f46] bg-[#09090b] hover:bg-[#27272a]'
              }`}
            >
              <p className="font-semibold text-xs text-white">{item.label}</p>
              <p className="text-[11px] text-[#a1a1aa] mt-0.5">{item.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Pipeline Summary */}
      <div className="rounded-xl border border-[#3f3f46] bg-[#09090b] p-4 text-xs flex flex-col gap-2.5">
        <p className="font-semibold text-white">Quy trình xử lý tự động:</p>
        <div className="grid grid-cols-2 gap-y-2 text-[#a1a1aa]">
          <div>
            • Video gốc: <span className="text-white">{project?.video?.fileName || 'Chưa có'}</span>
          </div>
          <div>
            • Giọng đọc: <span className="text-white">{project?.tts?.voice || 'Chưa tạo'}</span>
          </div>
          <div>
            • Phụ đề karaoke:{' '}
            <span className="text-white">
              {project?.subtitle?.enabled
                ? `Bật (${project.subtitle.words?.length || 0} từ ASS)`
                : 'Tắt'}
            </span>
          </div>
          <div>
            • Nhạc nền:{' '}
            <span className="text-white">
              {project?.bgMusic?.path
                ? `Có (${Math.round((project.bgMusic.volume ?? 0.12) * 100)}% vol)`
                : 'Không'}
            </span>
          </div>
        </div>
      </div>

      {/* Render Progress or Status Box */}
      {isRendering ? (
        <div className="rounded-xl border border-[#eab308]/50 bg-[#eab308]/10 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 font-bold text-[#eab308]">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>FFmpeg đang render video...</span>
            </span>
            <span className="font-mono text-white font-bold">{renderProgress}%</span>
          </div>

          <div className="w-full h-2 bg-[#27272a] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#eab308] to-[#f97316] transition-all duration-300 rounded-full"
              style={{ width: `${renderProgress}%` }}
            />
          </div>

          <p className="text-[11px] text-[#a1a1aa]">
            Tác vụ đang chạy ngầm trong Worker BullMQ. Vui lòng giữ trang trong khi hoàn tất.
          </p>
        </div>
      ) : isDone ? (
        <div className="rounded-xl border border-[#22c55e]/40 bg-[#22c55e]/10 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#22c55e]/20 text-[#22c55e]">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-white text-xs">Video đã render hoàn tất!</p>
              <p className="text-xs text-[#a1a1aa] mt-0.5">
                Dung lượng: {formatFileSize(project.export?.fileSize)} • Độ phân giải: {project.export?.resolution || resolution}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPreviewMode('export')}
              className="inline-flex items-center gap-1 rounded-lg border border-[#3f3f46] bg-[#27272a] px-3 py-2 text-xs font-semibold text-white hover:bg-[#3f3f46] transition-colors"
            >
              <Tv className="h-3.5 w-3.5 text-[#f97316]" />
              <span>Xem trực tiếp</span>
            </button>

            <a
              href={`/api/projects/${project._id}/export`}
              download
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#22c55e] px-4 py-2 text-xs font-bold text-black hover:bg-[#16a34a] transition-colors shadow-md"
            >
              <Download className="h-4 w-4" />
              <span>Tải Video (.mp4)</span>
            </a>
          </div>
        </div>
      ) : null}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <span className="text-xs text-[#71717a]">
          {project?.video?.path && project?.tts?.audioPath
            ? 'Đã sẵn sàng để render'
            : 'Cần tải video gốc và tạo giọng đọc trước khi render'}
        </span>

        <button
          type="button"
          onClick={handleStartRender}
          disabled={isRendering || !project?.video?.path || !project?.tts?.audioPath}
          className="inline-flex items-center gap-2 rounded-xl bg-[#f97316] px-6 py-2.5 text-xs font-bold text-black hover:bg-[#ea580c] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
        >
          {isRendering ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Đang render...</span>
            </>
          ) : (
            <>
              <Rocket className="h-4 w-4" />
              <span>{isDone ? 'Render lại video mới' : 'Bắt đầu Render Video'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
