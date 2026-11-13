'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Upload,
  Search,
  Layers,
  Film,
  Sparkles,
  ArrowUpDown,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { Header } from '@/components/layout/Header';
import { StatsOverview } from '@/components/dashboard/StatsOverview';
import { ProjectCard } from '@/components/dashboard/ProjectCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ProjectDTO } from '@/types';
import { useBatchStore } from '@/stores/batchStore';
import { MAX_VIDEO_UPLOAD_BYTES } from '@/lib/validation/schemas';

const STATUS_FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'draft', label: 'Bản nháp' },
  { value: 'scripted', label: 'Đã có kịch bản' },
  { value: 'voiced', label: 'Đã tạo giọng đọc' },
  { value: 'subtitled', label: 'Đã tạo phụ đề' },
  { value: 'rendering', label: 'Đang xuất video' },
  { value: 'done', label: 'Hoàn tất' },
  { value: 'error', label: 'Gặp lỗi' },
] as const;

const PAGE_SIZE = 12;

export default function DashboardPage() {
  const router = useRouter();
  const addBatchFiles = useBatchStore((s) => s.addFiles);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [projects, setProjects] = useState<ProjectDTO[]>([]);
  const [stats, setStats] = useState({ total: 0, today: 0, processing: 0 });
  const [loading, setLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFileName, setUploadingFileName] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'recent' | 'name'>('recent');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects');
      const json = (await res.json()) as {
        success: boolean;
        data?: {
          projects: ProjectDTO[];
          stats: { total: number; today: number; processing: number };
        };
      };
      if (json.success && json.data) {
        setProjects(json.data.projects);
        setStats(json.data.stats);
      }
    } catch {
      toast.error('Không thể tải danh sách dự án');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = projects.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (p.name || '').toLowerCase().includes(q) ||
        (p.script?.productName || '').toLowerCase().includes(q) ||
        (p.script?.text || '').toLowerCase().includes(q)
      );
    });

    if (sortBy === 'name') {
      return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'));
    }
    return list;
  }, [projects, searchQuery, statusFilter, sortBy]);

  const visibleProjects = useMemo(
    () => filteredProjects.slice(0, visibleCount),
    [filteredProjects, visibleCount]
  );

  const uploadSingleVideo = useCallback(
    (file: File) => {
      if (file.size <= 0) {
        toast.error('Tệp video bị rỗng.');
        return;
      }
      if (file.size > MAX_VIDEO_UPLOAD_BYTES) {
        toast.error('Video vượt quá giới hạn 500MB. Hãy nén nhẹ lại trước khi tải lên.');
        return;
      }

      setUploading(true);
      setUploadProgress(0);
      setUploadingFileName(file.name);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'video');

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload');

      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
        }
      };

      xhr.onload = () => {
        setUploading(false);
        try {
          const res = JSON.parse(xhr.responseText) as {
            success: boolean;
            data?: { project?: ProjectDTO };
            error?: string;
          };
          if (xhr.status >= 200 && xhr.status < 300 && res.success && res.data?.project?._id) {
            toast.success('Đã tải video lên, đang mở Studio...');
            router.push(`/projects/${res.data.project._id}`);
            return;
          }
          toast.error(res.error || 'Tải video lên thất bại');
        } catch {
          toast.error('Phản hồi máy chủ không hợp lệ');
        }
      };

      xhr.onerror = () => {
        setUploading(false);
        toast.error('Mất kết nối trong lúc tải video lên');
      };

      xhr.send(formData);
    },
    [router]
  );

  const handleSelectedFiles = useCallback(
    (fileList: FileList | File[]) => {
      const files = Array.from(fileList).filter((f) => {
        const ext = f.name.toLowerCase();
        return (
          f.type.startsWith('video/') ||
          ext.endsWith('.mp4') ||
          ext.endsWith('.mov') ||
          ext.endsWith('.webm') ||
          ext.endsWith('.m4v')
        );
      });

      if (files.length === 0) {
        toast.error('Vui lòng chọn tệp video định dạng MP4, MOV hoặc WebM.');
        return;
      }

      if (files.length === 1) {
        uploadSingleVideo(files[0]);
        return;
      }

      addBatchFiles(files);
      toast.success(`Đã thêm ${files.length} video vào danh sách xử lý hàng loạt`);
      router.push('/batch?new=1');
    },
    [addBatchFiles, router, uploadSingleVideo]
  );

  const handleDeleteProject = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Không thể xóa dự án');
        return;
      }
      toast.success('Đã xóa dự án');
      setProjects((prev) => prev.filter((p) => p._id !== id));
      setStats((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }));
    } catch {
      toast.error('Lỗi kết nối khi xóa dự án');
    }
  };

  const handleDuplicated = (newProject: ProjectDTO) => {
    setProjects((prev) => [newProject, ...prev]);
    setStats((prev) => ({
      total: prev.total + 1,
      today: prev.today + 1,
      processing: prev.processing,
    }));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) {
      handleSelectedFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-[#fafafa] flex flex-col">
      <Header />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 py-6 space-y-6">
        {/* Smart Dropzone */}
        <section
          aria-label="Tạo dự án nhanh"
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`relative rounded-xl border-2 border-dashed transition-colors p-6 sm:p-7 ${
            isDragging
              ? 'border-[#f97316] bg-[#f97316]/10'
              : 'border-white/[0.12] bg-[#111113] hover:border-white/[0.22]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm,.m4v"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) {
                handleSelectedFiles(e.target.files);
                e.target.value = '';
              }
            }}
          />

          <div className="flex flex-col md:flex-row items-center justify-between gap-5">
            <div className="flex items-center gap-4 text-center md:text-left flex-col md:flex-row">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#f97316]/15 border border-[#f97316]/30 text-[#f97316]">
                <Upload className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h1 className="text-base sm:text-lg font-bold text-[#fafafa]">
                  Tải video sản phẩm để bắt đầu lồng tiếng AI
                </h1>
                <p className="text-xs text-[#a1a1aa] max-w-xl leading-relaxed">
                  Kéo thả <span className="text-white font-medium">1 video</span> để mở ngay Studio biên tập, hoặc chọn{' '}
                  <span className="text-white font-medium">nhiều video</span> để xử lý hàng loạt tự động. Hỗ trợ MP4, MOV, WebM (tối đa 500MB).
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2.5 shrink-0">
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                size="lg"
                className="gap-2"
              >
                <Sparkles className="h-4 w-4" />
                <span>{uploading ? `Đang tải (${uploadProgress}%)` : 'Chọn video tải lên'}</span>
              </Button>
              <Link
                href="/batch?new=1"
                className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-white/[0.12] bg-[#18181b] px-4 text-xs font-semibold text-[#fafafa] transition-colors hover:bg-[#27272a]"
              >
                <Layers className="h-3.5 w-3.5 text-[#f97316]" />
                <span>Mở xử lý hàng loạt</span>
              </Link>
            </div>
          </div>

          {uploading && (
            <div className="mt-4 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-[#a1a1aa]">
                <span className="truncate">Đang tải lên: {uploadingFileName}</span>
                <span className="font-mono font-semibold text-[#f97316] tabular-nums">
                  {uploadProgress}%
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#27272a]">
                <div
                  className="h-full bg-[#f97316] transition-all duration-150"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </section>

        {/* Stats */}
        <StatsOverview stats={stats} />

        {/* Search, Filters & Project Library */}
        <section className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9ca3af]" />
              <Input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setVisibleCount(PAGE_SIZE);
                }}
                placeholder="Tìm theo tên dự án, sản phẩm hoặc kịch bản..."
                className="pl-9"
                aria-label="Tìm kiếm dự án"
              />
            </div>

            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-3.5 w-3.5 text-[#9ca3af] shrink-0" />
              <select
                aria-label="Sắp xếp dự án"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'recent' | 'name')}
                className="h-9 rounded-md border border-white/[0.1] bg-[#111113] px-3 text-xs text-[#fafafa] focus:outline-none focus:border-[#f97316]"
              >
                <option value="recent">Mới cập nhật</option>
                <option value="name">Tên dự án (A–Z)</option>
              </select>
            </div>
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {STATUS_FILTERS.map((f) => {
              const active = statusFilter === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => {
                    setStatusFilter(f.value);
                    setVisibleCount(PAGE_SIZE);
                  }}
                  className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                    active
                      ? 'border-[#f97316]/50 bg-[#f97316]/15 text-[#fb923c]'
                      : 'border-white/[0.08] bg-[#111113] text-[#a1a1aa] hover:border-white/[0.16] hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {/* Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-36 animate-pulse rounded-xl border border-white/[0.06] bg-[#111113]"
                />
              ))}
            </div>
          ) : visibleProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.08] bg-[#111113] py-14 px-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#18181b] text-[#9ca3af] mb-3">
                <Film className="h-6 w-6" />
              </div>
              <h2 className="text-sm font-semibold text-[#fafafa]">
                {projects.length === 0 ? 'Chưa có dự án nào' : 'Không tìm thấy dự án phù hợp'}
              </h2>
              <p className="mt-1 text-xs text-[#9ca3af] max-w-sm">
                {projects.length === 0
                  ? 'Hãy kéo thả hoặc chọn video sản phẩm ở khung phía trên để tạo video lồng tiếng đầu tiên.'
                  : 'Thử đổi từ khóa tìm kiếm hoặc chọn lại trạng thái lọc.'}
              </p>
              {(searchQuery || statusFilter !== 'all') && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 gap-1.5"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                  }}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Đặt lại bộ lọc</span>
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleProjects.map((project) => (
                  <ProjectCard
                    key={project._id}
                    project={project}
                    onDelete={handleDeleteProject}
                    onDuplicated={handleDuplicated}
                  />
                ))}
              </div>

              {filteredProjects.length > visibleCount && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                  >
                    Xem thêm ({filteredProjects.length - visibleCount} dự án còn lại)
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
