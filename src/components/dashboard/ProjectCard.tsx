'use client';

import { useState } from 'react';
import Link from 'next/link';
import { IProject } from '@/types';
import { formatDuration, formatFileSize } from '@/lib/utils';
import {
  Play,
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Subtitles,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog } from '@/components/ui/dialog';

interface ProjectCardProps {
  project: IProject;
  onDeleted?: (id: string) => void;
}

export function ProjectCard({ project, onDeleted }: ProjectCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'done':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#22c55e]/15 px-2 py-0.5 text-xs font-semibold text-[#22c55e] border border-[#22c55e]/30">
            <CheckCircle2 className="h-3 w-3" />
            <span>Hoàn tất</span>
          </span>
        );
      case 'rendering':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#eab308]/15 px-2 py-0.5 text-xs font-semibold text-[#eab308] border border-[#eab308]/30 animate-pulse">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Đang render</span>
          </span>
        );
      case 'subtitled':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 px-2 py-0.5 text-xs font-medium text-cyan-400 border border-cyan-500/30">
            <Subtitles className="h-3 w-3" />
            <span>Đã có phụ đề</span>
          </span>
        );
      case 'voiced':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-400 border border-blue-500/30">
            <span>Đã tạo giọng</span>
          </span>
        );
      case 'scripted':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/15 px-2 py-0.5 text-xs font-medium text-purple-400 border border-purple-500/30">
            <span>Có kịch bản</span>
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#ef4444]/15 px-2 py-0.5 text-xs font-medium text-[#ef4444] border border-[#ef4444]/30">
            <AlertCircle className="h-3 w-3" />
            <span>Lỗi</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#71717a]/15 px-2 py-0.5 text-xs font-medium text-[#a1a1aa] border border-[#71717a]/30">
            <span>Bản nháp</span>
          </span>
        );
    }
  };

  const handleConfirmDelete = async () => {
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/projects/${project._id}`, { method: 'DELETE' });
      const data = await res.json();

      if (data.success) {
        toast.success('Đã xóa dự án thành công');
        setShowDeleteModal(false);
        onDeleted?.(project._id);
      } else {
        toast.error(data.error || 'Xóa dự án thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối khi xóa dự án');
    } finally {
      setIsDeleting(false);
    }
  };

  const durationSec = Math.max(
    project.tts?.audioDuration || 0,
    project.video?.duration || 0
  );

  // Video source for thumbnail preview
  const previewSrc = project.export?.path
    ? `/api/files/exports/${project._id}/${encodeURIComponent(
        project.export.path.split(/[\\/]/).pop() || ''
      )}#t=0.5`
    : project.video?.path
    ? `/api/files/uploads/${project._id}/${encodeURIComponent(
        project.video.path.split(/[\\/]/).pop() || ''
      )}#t=0.5`
    : '';

  return (
    <>
      <div className="group relative flex flex-col overflow-hidden rounded-xl border border-[#3f3f46] bg-[#18181b] transition-all hover:border-[#f97316]/60 hover:bg-[#27272a]/60 shadow-sm">
        {/* 9:16 Video Thumbnail Container */}
        <Link
          href={`/projects/${project._id}`}
          className="relative aspect-[9/16] w-full max-h-56 bg-black flex items-center justify-center overflow-hidden cursor-pointer"
        >
          {previewSrc ? (
            <video
              src={previewSrc}
              preload="metadata"
              muted
              playsInline
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-[#71717a] p-4 text-center">
              <Play className="h-8 w-8 mb-1 opacity-30" />
              <span className="text-[11px]">Chưa tải video</span>
            </div>
          )}

          <div className="absolute top-2 left-2 z-10">{getStatusBadge(project.status)}</div>

          {durationSec > 0 && (
            <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/80 px-1.5 py-0.5 text-[11px] font-mono text-white backdrop-blur-sm">
              <Clock className="h-3 w-3 text-[#f97316]" />
              <span>{formatDuration(durationSec)}</span>
            </div>
          )}
        </Link>

        {/* Info details */}
        <div className="flex flex-1 flex-col justify-between p-3">
          <div>
            <Link
              href={`/projects/${project._id}`}
              className="font-semibold text-xs text-white line-clamp-1 group-hover:text-[#f97316] transition-colors"
              title={project.name || 'Dự án chưa đặt tên'}
            >
              {project.name || 'Dự án chưa đặt tên'}
            </Link>
            <p className="mt-1 text-[11px] text-[#a1a1aa] line-clamp-2">
              {project.script?.text || 'Chưa soạn thảo kịch bản...'}
            </p>
          </div>

          <div className="mt-3 pt-2 border-t border-[#3f3f46]/60 flex items-center justify-between text-[11px] text-[#71717a]">
            <span>{formatFileSize(project.export?.fileSize || project.video?.fileSize)}</span>

            <div className="flex items-center gap-1">
              <Link
                href={`/projects/${project._id}`}
                className="p-1.5 text-[#a1a1aa] hover:text-[#f97316] hover:bg-[#3f3f46]/50 rounded transition-colors"
                title="Mở Studio Editor"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowDeleteModal(true);
                }}
                disabled={isDeleting}
                title="Xóa dự án"
                className="p-1.5 text-[#71717a] hover:text-[#ef4444] hover:bg-[#3f3f46]/50 rounded transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        title="Xác nhận xóa dự án"
        description="Thao tác này sẽ xóa vĩnh viễn video, âm thanh và phụ đề của dự án."
      >
        <div className="flex flex-col gap-4 text-xs">
          <p className="text-[#a1a1aa]">
            Bạn có chắc chắn muốn xóa dự án{' '}
            <strong className="text-white">"{project.name}"</strong> không?
          </p>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#3f3f46]/80">
            <button
              type="button"
              onClick={() => setShowDeleteModal(false)}
              disabled={isDeleting}
              className="rounded-lg border border-[#3f3f46] px-4 py-2 text-xs font-semibold text-[#a1a1aa] hover:bg-[#27272a] hover:text-white transition-colors"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#ef4444] px-4 py-2 text-xs font-bold text-white hover:bg-[#dc2626] transition-colors shadow-sm"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Đang xóa...</span>
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Xóa vĩnh viễn</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
