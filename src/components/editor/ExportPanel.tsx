'use client';

import { useState, useEffect } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { Rocket, Download, CheckCircle2, AlertCircle, Loader2, Play } from 'lucide-react';
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
  } = useEditorStore();

  const [quality, setQuality] = useState<'fast' | 'balanced' | 'high'>(
    project?.export?.quality || 'balanced'
  );

  // Poll BullMQ Job status if currently rendering
  useEffect(() => {
    if (!activeJobId || !isRendering) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${activeJobId}`);
        const data = await res.json();
        if (data.success && data.data) {
          const job = data.data;
          setRenderProgress(job.progress || 0);

          if (job.status === 'done') {
            setIsRendering(false);
            setRenderProgress(100);
            setActiveJobId(null);
            toast.success('Render video hoàn tất! Bạn có thể xem và tải xuống.');

            // Refresh project details
            if (project?._id) {
              const pRes = await fetch(`/api/projects/${project._id}`);
              const pData = await pRes.json();
              if (pData.success && pData.data) {
                updateProjectPartial(pData.data);
              }
            }
          } else if (job.status === 'error') {
            setIsRendering(false);
            setActiveJobId(null);
            toast.error(job.error || 'Quá trình render thất bại');
          }
        }
      } catch {
        // network polling retry
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [activeJobId, isRendering, project?._id, setIsRendering, setRenderProgress, setActiveJobId, updateProjectPartial]);

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
        body: JSON.stringify({ quality }),
      });

      const data = await res.json();
      if (data.success && data.data?.jobId) {
        setActiveJobId(data.data.jobId);
        toast.info('Đã đưa tác vụ render vào hàng đợi BullMQ...');
      } else {
        setIsRendering(false);
        toast.error(data.error || 'Khởi động render thất bại');
      }
    } catch {
      setIsRendering(false);
      toast.error('Lỗi kết nối khi kích hoạt render');
    }
  };

  const isDone = project?.status === 'done' && project.export?.path;

  return (
    <div className="flex flex-col gap-5 p-4 text-sm">
      <div>
        <h3 className="font-semibold text-white">Xuất Bản & Render Video (FFmpeg)</h3>
        <p className="text-xs text-[#a1a1aa] mt-0.5">
          Tự động ghép video chuẩn 1080x1920, mix nhạc nền, burn phụ đề karaoke và nén H.264
        </p>
      </div>

      {/* Quality Options */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-[#a1a1aa]">Chất lượng xuất</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              id: 'fast',
              label: 'Nhanh (Fast)',
              desc: 'Ultrafast - Phù hợp test',
            },
            {
              id: 'balanced',
              label: 'Cân bằng (Balanced)',
              desc: 'Medium CRF 23 - Chuẩn TikTok',
            },
            {
              id: 'high',
              label: 'Cao cấp (High)',
              desc: 'Slow CRF 18 - Độ nét cao',
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

      {/* Video Specifications Overview */}
      <div className="rounded-xl border border-[#3f3f46] bg-[#09090b] p-4 text-xs flex flex-col gap-2.5">
        <p className="font-semibold text-white">Thông số video đầu ra:</p>
        <div className="grid grid-cols-2 gap-y-2 text-[#a1a1aa]">
          <div>• Độ phân giải: <span className="text-white">1080 x 1920 (9:16 dọc)</span></div>
          <div>• Mã hóa video: <span className="text-white">H.264 / AAC 192kbps</span></div>
          <div>• Phụ đề: <span className="text-white">{project?.subtitle?.enabled ? 'ASS Burn-in Karaoke' : 'Tắt'}</span></div>
          <div>• Nhạc nền: <span className="text-white">{project?.bgMusic?.path ? 'Có (Loop + Ducking)' : 'Không'}</span></div>
        </div>
      </div>

      {/* Render Progress or Status */}
      {isRendering ? (
        <div className="rounded-xl border border-[#eab308]/40 bg-[#eab308]/5 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 font-semibold text-[#eab308]">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Đang render video...</span>
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
            Tiến trình FFmpeg đang chạy trong hàng đợi BullMQ. Không tắt trình duyệt trong khi render.
          </p>
        </div>
      ) : isDone ? (
        <div className="rounded-xl border border-[#22c55e]/40 bg-[#22c55e]/5 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#22c55e]/20 text-[#22c55e]">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-white text-xs">Video đã render hoàn tất!</p>
              <p className="text-xs text-[#a1a1aa] mt-0.5">
                Kích thước tệp: {formatFileSize(project.export?.fileSize)}
              </p>
            </div>
          </div>

          <a
            href={`/api/projects/${project._id}/export`}
            download
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#22c55e] px-4 py-2 text-xs font-semibold text-black hover:bg-[#16a34a] transition-colors shadow-md"
          >
            <Download className="h-4 w-4" />
            <span>Tải video MP4</span>
          </a>
        </div>
      ) : null}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <span className="text-xs text-[#71717a]">
          {project?.video?.path && project?.tts?.audioPath
            ? 'Đã đủ điều kiện render'
            : 'Cần tải video gốc và tạo audio trước khi render'}
        </span>

        <button
          type="button"
          onClick={handleStartRender}
          disabled={isRendering || !project?.video?.path || !project?.tts?.audioPath}
          className="inline-flex items-center gap-2 rounded-lg bg-[#f97316] px-6 py-2.5 text-xs font-bold text-black hover:bg-[#ea580c] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
        >
          {isRendering ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Đang tiến hành...</span>
            </>
          ) : (
            <>
              <Rocket className="h-4 w-4" />
              <span>{isDone ? 'Render lại video' : 'Bắt đầu Render Video'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
