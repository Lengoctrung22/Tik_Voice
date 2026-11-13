'use client';

import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  Download,
  Loader2,
  Play,
  Sparkles,
  Copy,
  Check,
  XCircle,
  Film,
} from 'lucide-react';
import { toast } from 'sonner';
import { useEditorStore } from '@/stores/editorStore';
import { Button } from '@/components/ui/button';
import { formatFileSize } from '@/lib/utils';
import type { ExportResolution, ProjectDTO } from '@/types';

interface ExportPanelProps {
  onFlushSave: () => Promise<boolean>;
}

interface JobPollResponse {
  success: boolean;
  data?: {
    _id: string;
    status: 'queued' | 'processing' | 'done' | 'error' | 'cancelled';
    progress: number;
    error?: string;
  };
}

export function ExportPanel({ onFlushSave }: ExportPanelProps) {
  const {
    project,
    renderProgress,
    isRendering,
    activeJobId,
    setRenderProgress,
    setIsRendering,
    setActiveJobId,
    setPreviewMode,
    updateProjectPartial,
  } = useEditorStore();

  const resolution: ExportResolution =
    project?.export?.resolution === '720x1280' ? '720x1280' : '1080x1920';
  const quality: 'fast' | 'balanced' | 'high' = project?.export?.quality || 'balanced';
  const [starting, setStarting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [renderStartTime, setRenderStartTime] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  const [generatingCaption, setGeneratingCaption] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);

  const hasVideo = Boolean(project?.video?.path);
  const hasVoice = Boolean(project?.tts?.audioPath);
  const subtitleEnabled = project?.subtitle?.enabled !== false;
  const subtitleOk = !subtitleEnabled || Boolean(project?.subtitle?.words?.length);
  const isDesynced = Boolean(
    project?.tts?.audioPath &&
      !project?.tts?.isCustomAudio &&
      project?.tts?.sourceText &&
      project?.script?.text &&
      project.tts.sourceText.trim() !== project.script.text.trim()
  );

  // Elapsed timer during active render
  useEffect(() => {
    if (!isRendering) {
      setRenderStartTime(null);
      setElapsedSec(0);
      return;
    }
    const start = renderStartTime || Date.now();
    if (!renderStartTime) setRenderStartTime(start);
    const t = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => window.clearInterval(t);
  }, [isRendering, renderStartTime]);

  // Poll job status
  useEffect(() => {
    if (!isRendering || !activeJobId || !project?._id) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/jobs/${activeJobId}`);
        const json = (await res.json()) as JobPollResponse;
        if (cancelled || !json.success || !json.data) return;

        const job = json.data;
        setRenderProgress(job.progress || 0);

        if (job.status === 'done') {
          setIsRendering(false);
          setActiveJobId(null);
          const projRes = await fetch(`/api/projects/${project._id}`);
          const projJson = (await projRes.json()) as {
            success: boolean;
            data?: ProjectDTO;
          };
          if (projJson.success && projJson.data) {
            updateProjectPartial(projJson.data, false);
          }
          setPreviewMode('export');
          toast.success('Xuất video hoàn tất! Bạn có thể tải xuống ngay.');
        } else if (job.status === 'error' || job.status === 'cancelled') {
          setIsRendering(false);
          setActiveJobId(null);
          const projRes = await fetch(`/api/projects/${project._id}`);
          const projJson = (await projRes.json()) as {
            success: boolean;
            data?: ProjectDTO;
          };
          if (projJson.success && projJson.data) {
            updateProjectPartial(projJson.data, false);
          }
          if (job.status === 'error') {
            toast.error(job.error || 'Quá trình xuất video gặp lỗi');
          } else {
            toast.info('Đã hủy tiến trình xuất video');
          }
        }
      } catch {
        // Ignore transient network poll error
      }
    };

    poll();
    const timer = window.setInterval(poll, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    activeJobId,
    isRendering,
    project?._id,
    setActiveJobId,
    setIsRendering,
    setPreviewMode,
    setRenderProgress,
    updateProjectPartial,
  ]);

  const handleStartRender = async () => {
    if (!project?._id) return;
    if (!hasVideo || !hasVoice) {
      toast.error('Cần có video gốc và giọng đọc trước khi xuất.');
      return;
    }

    setStarting(true);
    try {
      const saved = await onFlushSave();
      if (!saved) {
        toast.error('Không thể lưu cấu hình hiện tại trước khi xuất video.');
        return;
      }

      // Đảm bảo tệp phụ đề mới nhất được sinh nếu bật phụ đề
      if (project.subtitle?.enabled && project.subtitle.words?.length > 0) {
        const subRes = await fetch(`/api/projects/${project._id}/subtitle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            enabled: true,
            style: project.subtitle.style,
            words: project.subtitle.words.map((w) => ({
              word: w.word,
              start: w.start,
              end: w.end,
            })),
          }),
        });
        if (!subRes.ok) {
          const subErr = (await subRes.json().catch(() => ({}))) as { error?: string };
          toast.error(subErr.error || 'Không thể tạo tệp phụ đề trước khi render');
          return;
        }
      }

      const res = await fetch(`/api/projects/${project._id}/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quality, resolution }),
      });

      const json = (await res.json()) as {
        success: boolean;
        data?: { jobId?: string };
        error?: string;
      };

      if (res.status === 409 && json.data?.jobId) {
        setActiveJobId(json.data.jobId);
        setIsRendering(true);
        toast.info('Video đang trong hàng đợi xử lý, đã kết nối lại tiến trình.');
        return;
      }

      if (!res.ok || !json.success || !json.data?.jobId) {
        toast.error(json.error || 'Không thể bắt đầu xuất video');
        return;
      }

      setRenderStartTime(Date.now());
      setRenderProgress(0);
      setActiveJobId(json.data.jobId);
      setIsRendering(true);
      toast.success('Đã đưa video vào hàng đợi xuất bản hoàn chỉnh!');
    } catch {
      toast.error('Lỗi kết nối máy chủ khi xuất video');
    } finally {
      setStarting(false);
    }
  };

  const handleCancelRender = async () => {
    if (!activeJobId) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/jobs/${activeJobId}/cancel`, { method: 'POST' });
      const json = (await res.json()) as {
        success: boolean;
        data?: { project?: ProjectDTO };
        error?: string;
      };
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Không thể hủy tiến trình');
        return;
      }
      setIsRendering(false);
      setActiveJobId(null);
      setRenderProgress(0);
      if (json.data?.project) {
        updateProjectPartial(json.data.project, false);
      }
      toast.success('Đã hủy xuất video');
    } catch {
      toast.error('Lỗi kết nối khi hủy render');
    } finally {
      setCancelling(false);
    }
  };

  const handleGenerateCaption = async () => {
    if (!project?._id) return;
    setGeneratingCaption(true);
    try {
      const res = await fetch(`/api/projects/${project._id}/marketing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'caption',
          productName: project.script?.productName || project.name,
          scriptText: project.script?.text,
        }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: { caption?: string; hashtags?: string[]; project?: ProjectDTO };
        error?: string;
      };
      if (!res.ok || !json.success || !json.data) {
        toast.error(json.error || 'Không thể tạo caption lúc này');
        return;
      }
      if (json.data.project) {
        updateProjectPartial(json.data.project, false);
      }
      toast.success('Đã tạo caption và hashtag chuẩn TikTok!');
    } catch {
      toast.error('Lỗi kết nối khi tạo caption');
    } finally {
      setGeneratingCaption(false);
    }
  };

  const fullCaptionCopy = [
    project?.script?.captionText || '',
    (project?.script?.hashtags || []).join(' '),
  ]
    .filter(Boolean)
    .join('\n\n');

  const handleCopyCaption = async () => {
    if (!fullCaptionCopy) return;
    try {
      await navigator.clipboard.writeText(fullCaptionCopy);
      setCopiedCaption(true);
      toast.success('Đã sao chép nội dung đăng bài!');
      window.setTimeout(() => setCopiedCaption(false), 1800);
    } catch {
      toast.error('Không thể sao chép tự động');
    }
  };

  const etaSeconds =
    renderProgress >= 10 && elapsedSec > 1
      ? Math.max(1, Math.round((elapsedSec / renderProgress) * (100 - renderProgress)))
      : null;

  const isDone = project?.status === 'done' && Boolean(project?.export?.path);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-bold text-[#fafafa]">5. Xuất video hoàn chỉnh</h2>
        <p className="text-[11px] text-[#9ca3af]">
          Kiểm tra các thành phần và kết xuất tệp MP4 dọc chuẩn TikTok
        </p>
      </div>

      {/* Checklist */}
      <div className="rounded-lg border border-white/[0.08] bg-[#18181b] p-3 space-y-2">
        <div className="text-[11px] font-semibold text-[#d4d4d8]">Kiểm tra trước khi xuất</div>
        {[
          { ok: hasVideo, label: 'Video gốc', detail: project?.video?.fileName || 'Chưa tải lên' },
          {
            ok: hasVoice,
            label: 'Giọng đọc',
            detail: project?.tts?.isCustomAudio
              ? 'Giọng tự thu âm'
              : hasVoice
              ? 'Đã tạo xong'
              : 'Chưa tạo giọng đọc',
          },
          {
            ok: subtitleOk,
            label: 'Phụ đề Karaoke',
            detail: subtitleEnabled
              ? `${project?.subtitle?.words?.length || 0} từ đồng bộ`
              : 'Đang tắt',
          },
          {
            ok: true,
            label: 'Nhạc nền & Logo',
            detail: [
              project?.bgMusic?.name || 'Không nhạc nền',
              project?.watermark?.enabled ? 'Có logo' : null,
            ]
              .filter(Boolean)
              .join(' | '),
          },
        ].map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-2 text-[11px]">
            <span className="flex items-center gap-1.5 text-[#fafafa]">
              {item.ok ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              ) : (
                <CircleAlert className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              )}
              <span>{item.label}</span>
            </span>
            <span className="truncate max-w-[170px] text-[#a1a1aa]">{item.detail}</span>
          </div>
        ))}

        {isDesynced && (
          <div className="mt-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-200">
            Lưu ý: Nội dung kịch bản khác với giọng đọc hiện tại. Video sẽ dùng file giọng đọc đang có.
          </div>
        )}
      </div>

      {/* Resolution & Quality */}
      <div className="space-y-3 rounded-lg border border-white/[0.08] bg-[#18181b] p-3">
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-[#d4d4d8]">Độ phân giải</label>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { value: '1080x1920', title: '1080 × 1920', desc: 'Full HD (Khuyên dùng)' },
                { value: '720x1280', title: '720 × 1280', desc: 'HD Nhanh & nhẹ' },
              ] as Array<{ value: ExportResolution; title: string; desc: string }>
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  updateProjectPartial({
                    export: {
                      ...(project?.export || { path: '', quality: 'balanced' }),
                      resolution: opt.value,
                    },
                  })
                }
                className={`rounded-md border px-2.5 py-2 text-left cursor-pointer ${
                  resolution === opt.value
                    ? 'border-[#f97316]/60 bg-[#f97316]/12 text-white'
                    : 'border-white/[0.08] bg-[#09090b] text-[#a1a1aa]'
                }`}
              >
                <div className="font-mono text-xs font-semibold">{opt.title}</div>
                <div className="text-[10px] text-[#9ca3af]">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-[#d4d4d8]">Chất lượng mã hóa</label>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { value: 'fast', label: 'Nhanh' },
                { value: 'balanced', label: 'Cân bằng' },
                { value: 'high', label: 'Cao nhất' },
              ] as const
            ).map((q) => (
              <button
                key={q.value}
                type="button"
                onClick={() =>
                  updateProjectPartial({
                    export: {
                      ...(project?.export || { path: '', resolution: '1080x1920' }),
                      quality: q.value,
                    },
                  })
                }
                className={`rounded-md border py-1.5 text-[11px] font-medium cursor-pointer ${
                  quality === q.value
                    ? 'border-[#f97316]/60 bg-[#f97316]/15 text-[#fb923c]'
                    : 'border-white/[0.08] bg-[#09090b] text-[#a1a1aa]'
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Progress / Render CTA */}
      {isRendering ? (
        <div className="space-y-3 rounded-lg border border-[#f97316]/40 bg-[#f97316]/10 p-3.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 font-semibold text-[#fb923c]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang kết xuất video...
            </span>
            <span className="font-mono font-bold text-white tabular-nums">{renderProgress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-black/50">
            <div
              className="h-full bg-[#f97316] transition-all duration-300"
              style={{ width: `${renderProgress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#d4d4d8]">
            <span>Đã chạy: {elapsedSec}s</span>
            <span>{etaSeconds ? `Còn khoảng ~${etaSeconds}s` : 'Đang ước lượng thời gian...'}</span>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleCancelRender}
            disabled={cancelling}
            className="w-full gap-1.5"
          >
            <XCircle className="h-3.5 w-3.5" />
            <span>{cancelling ? 'Đang hủy...' : 'Hủy xuất video'}</span>
          </Button>
        </div>
      ) : (
        <Button
          onClick={handleStartRender}
          disabled={starting || !hasVideo || !hasVoice}
          className="w-full h-10 gap-2 text-xs font-bold"
        >
          {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
          <span>{isDone ? 'Xuất lại phiên bản mới' : 'Bắt đầu xuất video MP4'}</span>
        </Button>
      )}

      {/* Download & Post Marketing */}
      {isDone && project?._id && (
        <div className="space-y-3 rounded-lg border border-emerald-500/35 bg-emerald-500/10 p-3.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-emerald-300">Video đã sẵn sàng!</span>
            <span className="font-mono text-[11px] text-emerald-200">
              {project.export?.resolution} | {formatFileSize(project.export?.fileSize)}
            </span>
          </div>
          <div className="flex gap-2">
            <a
              href={`/api/projects/${project._id}/export`}
              className="flex-1 inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-emerald-500 px-3 text-xs font-bold text-black hover:bg-emerald-400 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Tải về MP4</span>
            </a>
            <Button
              variant="outline"
              onClick={() => setPreviewMode('export')}
              className="gap-1.5"
            >
              <Play className="h-3.5 w-3.5" />
              <span>Xem thử</span>
            </Button>
          </div>
        </div>
      )}

      {/* AI TikTok Caption & Hashtags */}
      <div className="space-y-2.5 rounded-lg border border-white/[0.08] bg-[#18181b] p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-[#fafafa] flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-[#f97316]" />
            <span>Caption & Hashtag đăng TikTok</span>
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={generatingCaption}
            onClick={handleGenerateCaption}
            className="h-7 px-2.5 text-[11px]"
          >
            {generatingCaption ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : null}
            {project?.script?.captionText ? 'Tạo lại' : 'Tạo bằng AI'}
          </Button>
        </div>

        {project?.script?.captionText ? (
          <div className="space-y-2">
            <div className="rounded-md border border-white/[0.08] bg-[#09090b] p-2.5 text-xs text-[#e4e4e7] whitespace-pre-wrap leading-relaxed">
              {fullCaptionCopy}
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleCopyCaption}
              className="w-full gap-1.5"
            >
              {copiedCaption ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span>{copiedCaption ? 'Đã sao chép vào khay nhớ tạm' : 'Sao chép Caption + Hashtag'}</span>
            </Button>
          </div>
        ) : (
          <p className="text-[11px] text-[#9ca3af]">
            Tạo nhanh mô tả thu hút kèm 4–6 hashtag liên quan để đăng kèm video TikTok Shop.
          </p>
        )}
      </div>
    </div>
  );
}
