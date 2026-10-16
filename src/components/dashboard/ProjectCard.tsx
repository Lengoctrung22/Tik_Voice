'use client';

import Link from 'next/link';
import { IProject } from '@/types';
import { formatDuration, formatFileSize } from '@/lib/utils';
import { Play, Trash2, Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface ProjectCardProps {
  project: IProject;
  onDeleted?: (id: string) => void;
}

export function ProjectCard({ project, onDeleted }: ProjectCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'done':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#22c55e]/10 px-2 py-0.5 text-xs font-medium text-[#22c55e]">
            <CheckCircle2 className="h-3 w-3" />
            <span>Hoàn tất</span>
          </span>
        );
      case 'rendering':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#eab308]/10 px-2 py-0.5 text-xs font-medium text-[#eab308] animate-pulse">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Đang render</span>
          </span>
        );
      case 'voiced':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400">
            <span>Đã tạo giọng</span>
          </span>
        );
      case 'scripted':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 text-xs font-medium text-purple-400">
            <span>Có kịch bản</span>
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#ef4444]/10 px-2 py-0.5 text-xs font-medium text-[#ef4444]">
            <AlertCircle className="h-3 w-3" />
            <span>Lỗi</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#71717a]/10 px-2 py-0.5 text-xs font-medium text-[#a1a1aa]">
            <span>Bản nháp</span>
          </span>
        );
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm(`Bạn có chắc chắn muốn xóa dự án "${project.name}" không?`)) {
      return;
    }

    try {
      setIsDeleting(true);
      const res = await fetch(`/api/projects/${project._id}`, { method: 'DELETE' });
      const data = await res.json();

      if (data.success) {
        toast.success('Đã xóa dự án thành công');
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

  const durationSec = project.export?.path
    ? project.tts?.audioDuration || project.video?.duration || 0
    : project.video?.duration || 0;

  return (
    <Link
      href={`/projects/${project._id}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-[#3f3f46] bg-[#18181b] transition-all hover:border-[#f97316]/50 hover:bg-[#27272a]/60"
    >
      {/* 9:16 Video Thumbnail Container */}
      <div className="relative aspect-[9/16] w-full max-h-56 bg-black flex items-center justify-center overflow-hidden">
        {project.video?.path ? (
          <video
            src={`/api/files/uploads/${project._id}/${encodeURIComponent(
              project.video.path.split(/[\\/]/).pop() || ''
            )}#t=0.5`}
            preload="metadata"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-[#71717a]">
            <Play className="h-8 w-8 mb-1 opacity-40" />
            <span className="text-xs">Chưa có video</span>
          </div>
        )}

        <div className="absolute top-2 left-2">{getStatusBadge(project.status)}</div>

        {durationSec > 0 && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-mono text-white">
            <Clock className="h-3 w-3" />
            <span>{formatDuration(durationSec)}</span>
          </div>
        )}
      </div>

      {/* Info details */}
      <div className="flex flex-1 flex-col justify-between p-3.5">
        <div>
          <h3 className="font-semibold text-sm text-white line-clamp-1 group-hover:text-[#f97316] transition-colors">
            {project.name || 'Dự án chưa đặt tên'}
          </h3>
          <p className="mt-1 text-xs text-[#a1a1aa] line-clamp-2">
            {project.script?.text || 'Chưa có kịch bản...'}
          </p>
        </div>

        <div className="mt-3 pt-2.5 border-t border-[#3f3f46]/60 flex items-center justify-between text-[11px] text-[#71717a]">
          <span>{formatFileSize(project.export?.fileSize || project.video?.fileSize)}</span>

          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            title="Xóa dự án"
            className="p-1 text-[#71717a] hover:text-[#ef4444] transition-colors rounded hover:bg-[#3f3f46]/50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </Link>
  );
}
