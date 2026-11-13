'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Film,
  Mic,
  Trash2,
  Copy,
  Download,
  ExternalLink,
  Clock,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { ProjectDTO } from '@/types';
import { formatDuration, resolveMediaUrl } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { StatusBadge } from '@/components/ui/status-badge';
import { getVoiceById } from '@/lib/tts/voices';

interface ProjectCardProps {
  project: ProjectDTO;
  onDelete: (id: string) => Promise<void>;
  onDuplicated?: (newProject: ProjectDTO) => void;
}

export function ProjectCard({ project, onDelete, onDuplicated }: ProjectCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);

  const rawThumbPath = project.export?.thumbnailPath || project.video?.thumbnailPath;
  const thumbUrl = !thumbFailed ? resolveMediaUrl(rawThumbPath) : '';

  const voiceInfo = project.tts?.voice ? getVoiceById(project.tts.voice) : undefined;
  const voiceLabel = project.tts?.isCustomAudio
    ? 'Giọng tự thu âm'
    : voiceInfo?.name || 'Hoài My';

  const durationSeconds = project.tts?.audioDuration || project.video?.duration || 0;

  const updatedLabel = (() => {
    try {
      return new Date(project.updatedAt).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  })();

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(project._id);
      setConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleDuplicate = async () => {
    setDuplicating(true);
    try {
      const res = await fetch(`/api/projects/${project._id}/duplicate`, {
        method: 'POST',
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: ProjectDTO;
        error?: string;
      };
      if (!res.ok || !json.success || !json.data) {
        toast.error(json.error || 'Không thể nhân bản dự án');
        return;
      }
      toast.success('Đã nhân bản dự án thành công');
      onDuplicated?.(json.data);
    } catch {
      toast.error('Lỗi kết nối khi nhân bản dự án');
    } finally {
      setDuplicating(false);
    }
  };

  return (
    <>
      <article className="group flex gap-3.5 rounded-xl border border-white/[0.08] bg-[#111113] p-3 transition-colors hover:border-white/[0.16] hover:bg-[#141417]">
        {/* Thumbnail 9:16 nhẹ (JPEG static - không load video nặng) */}
        <Link
          href={`/projects/${project._id}`}
          className="relative aspect-[9/16] w-[74px] shrink-0 overflow-hidden rounded-lg bg-[#18181b] border border-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f97316]"
        >
          {thumbUrl ? (
            <img
              src={thumbUrl}
              alt={project.name}
              loading="lazy"
              onError={() => setThumbFailed(true)}
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[#9ca3af]">
              <Film className="h-5 w-5" />
              <span className="text-[9px] font-medium">9:16</span>
            </div>
          )}

          {durationSeconds > 0 && (
            <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 py-0.5 font-mono text-[10px] font-semibold text-white tabular-nums backdrop-blur-sm">
              {formatDuration(durationSeconds)}
            </span>
          )}
        </Link>

        {/* Nội dung & thao tác */}
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
          <div className="space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <Link
                href={`/projects/${project._id}`}
                className="truncate text-sm font-semibold text-[#fafafa] hover:text-[#f97316] transition-colors focus-visible:outline-none focus-visible:underline"
                title={project.name}
              >
                {project.name}
              </Link>
              <StatusBadge status={project.status} />
            </div>

            {project.script?.text ? (
              <p className="line-clamp-2 text-[11px] leading-relaxed text-[#a1a1aa]">
                {project.script.text}
              </p>
            ) : (
              <p className="text-[11px] italic text-[#9ca3af]">
                Chưa có kịch bản lồng tiếng
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#9ca3af]">
              <span className="inline-flex items-center gap-1">
                <Mic className="h-3 w-3 text-[#a1a1aa]" />
                {voiceLabel}
              </span>
              {updatedLabel && (
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Clock className="h-3 w-3" />
                  {updatedLabel}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 pt-1 border-t border-white/[0.06]">
              <Link
                href={`/projects/${project._id}`}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-[#27272a] px-2.5 py-1.5 text-[11px] font-semibold text-[#fafafa] transition-colors hover:bg-[#3f3f46] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f97316]"
              >
                <ExternalLink className="h-3 w-3" />
                <span>Mở Studio</span>
              </Link>

              {project.status === 'done' && project.export?.path && (
                <a
                  href={`/api/projects/${project._id}/export`}
                  title="Tải video đã xuất"
                  aria-label="Tải video đã xuất"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/12 text-emerald-300 transition-colors hover:bg-emerald-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f97316]"
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
              )}

              <button
                type="button"
                onClick={handleDuplicate}
                disabled={duplicating}
                title="Nhân bản dự án"
                aria-label={`Nhân bản ${project.name}`}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.08] bg-[#18181b] text-[#a1a1aa] transition-colors hover:bg-[#27272a] hover:text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f97316]"
              >
                {duplicating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                title="Xóa dự án"
                aria-label={`Xóa ${project.name}`}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.08] bg-[#18181b] text-[#9ca3af] transition-colors hover:border-red-500/30 hover:bg-red-500/12 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f97316]"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </article>

      <Dialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Xóa dự án này?"
        description="Hành động này sẽ xóa dự án cùng toàn bộ tệp video, giọng đọc và phụ đề đi kèm."
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-white/[0.08] bg-[#09090b] px-3 py-2.5 text-xs text-[#d4d4d8]">
            Dự án: <span className="font-semibold text-white">{project.name}</span>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmOpen(false)}
              disabled={deleting}
            >
              Giữ lại
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              disabled={deleting}
            >
              {deleting ? 'Đang xóa...' : 'Xác nhận xóa'}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
