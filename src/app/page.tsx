'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { StatsOverview } from '@/components/dashboard/StatsOverview';
import { ProjectCard } from '@/components/dashboard/ProjectCard';
import { IProject } from '@/types';
import { Plus, Video, Layers, Upload, Loader2, Sparkles, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<IProject[]>([]);
  const [stats, setStats] = useState({ total: 0, today: 0, processing: 0 });
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (data.success && data.data) {
        setProjects(data.data.projects);
        setStats(data.data.stats);
      }
    } catch {
      toast.error('Lỗi kết nối khi tải danh sách dự án');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreateNewProject = async () => {
    try {
      setIsCreating(true);
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Video TikTok #${projects.length + 1} (${new Date().toLocaleDateString('vi-VN')})`,
        }),
      });
      const data = await res.json();
      if (data.success && data.data?._id) {
        toast.success('Đã tạo dự án mới!');
        router.push(`/projects/${data.data._id}`);
      } else {
        toast.error(data.error || 'Tạo dự án thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối khi tạo dự án');
    } finally {
      setIsCreating(false);
    }
  };

  const handleQuickUpload = async (file: File) => {
    if (!file) return;

    try {
      setIsUploading(true);
      const toastId = toast.loading(`Đang tải lên "${file.name}"...`);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'video');

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success && data.data?.project?._id) {
        toast.success('Tải video lên thành công!', { id: toastId });
        router.push(`/projects/${data.data.project._id}`);
      } else {
        toast.error(data.error || 'Tải video thất bại', { id: toastId });
      }
    } catch {
      toast.error('Lỗi khi tải video lên');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleQuickUpload(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('video/')) {
      handleQuickUpload(file);
    } else {
      toast.error('Vui lòng chỉ kéo thả tệp định dạng video (MP4, MOV, WebM)');
    }
  };

  const handleProjectDeleted = (id: string) => {
    setProjects((prev) => {
      const remaining = prev.filter((p) => p._id !== id);
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      setStats({
        total: remaining.length,
        today: remaining.filter((p) => new Date(p.createdAt) >= startOfToday).length,
        processing: remaining.filter((p) => p.status === 'rendering').length,
      });
      return remaining;
    });
  };

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">
        {/* Top Header & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <span>Studio Dự Án Video</span>
              <span className="text-xs font-normal text-[#f97316] bg-[#431407] px-2.5 py-0.5 rounded-full border border-[#f97316]/30">
                TikTok Affiliate
              </span>
            </h1>
            <p className="text-xs text-[#a1a1aa] mt-1">
              Tự động hóa lồng tiếng AI, phụ đề karaoke động chuẩn ASS và render video 9:16
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/batch"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#3f3f46] bg-[#18181b] px-4 py-2 text-xs font-semibold text-white hover:bg-[#27272a] transition-all"
            >
              <Layers className="h-4 w-4 text-[#f97316]" />
              <span>Xử lý lô hàng loạt</span>
            </Link>

            <button
              type="button"
              onClick={handleCreateNewProject}
              disabled={isCreating || isUploading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#f97316] px-4 py-2 text-xs font-bold text-black hover:bg-[#ea580c] transition-all shadow-md disabled:opacity-50"
            >
              {isCreating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 stroke-[3]" />
              )}
              <span>Tạo dự án mới</span>
            </button>
          </div>
        </div>

        {/* Stats Overview */}
        <StatsOverview stats={stats} />

        {/* Quick Upload Drag & Drop Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative rounded-2xl border-2 border-dashed p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4 cursor-pointer transition-all ${
            isDragging
              ? 'border-[#f97316] bg-[#431407]/30 scale-[1.01]'
              : 'border-[#3f3f46] hover:border-[#f97316]/70 bg-[#18181b]/50 hover:bg-[#18181b]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            onChange={handleFileInputChange}
            className="hidden"
          />

          <div className="flex items-center gap-4 text-center sm:text-left">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#27272a] text-[#f97316] group-hover:scale-110 transition-transform">
              {isUploading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Upload className="h-6 w-6" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">
                {isUploading ? 'Đang tải lên và phân tích video...' : 'Kéo thả video vào đây để bắt đầu ngay'}
              </h3>
              <p className="text-xs text-[#a1a1aa] mt-0.5">
                Hỗ trợ tệp MP4, MOV, WebM (Chuẩn dọc 9:16). Tự động tạo dự án và chuyển sang Studio.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-xl bg-[#27272a] px-3.5 py-2 text-xs font-semibold text-white border border-[#3f3f46]">
              <span>Chọn tệp từ máy tính</span>
              <ArrowRight className="h-3.5 w-3.5 text-[#f97316]" />
            </span>
          </div>
        </div>

        {/* Project Grid */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Danh Sách Video Gần Đây</h2>
            <span className="text-xs text-[#71717a]">{projects.length} dự án</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-[#a1a1aa] text-sm">
              <Loader2 className="h-6 w-6 animate-spin mr-2 text-[#f97316]" />
              <span>Đang tải danh sách video...</span>
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#3f3f46] p-12 text-center bg-[#18181b]/40">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#27272a] text-[#f97316] mb-3">
                <Video className="h-7 w-7" />
              </div>
              <h3 className="font-bold text-white text-base">Chưa có dự án nào</h3>
              <p className="text-xs text-[#a1a1aa] mt-1 max-w-sm">
                Tạo dự án đầu tiên hoặc kéo thả video ở khung trên để bắt đầu lồng tiếng và tạo phụ đề karaoke
              </p>
              <button
                type="button"
                onClick={handleCreateNewProject}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#f97316] px-5 py-2.5 text-xs font-bold text-black hover:bg-[#ea580c] transition-all shadow-md"
              >
                <Plus className="h-4 w-4 stroke-[3]" />
                <span>Tạo dự án đầu tiên</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {/* Card Create New */}
              <button
                type="button"
                onClick={handleCreateNewProject}
                disabled={isCreating}
                className="flex flex-col items-center justify-center min-h-56 rounded-xl border border-dashed border-[#3f3f46] hover:border-[#f97316] bg-[#18181b]/30 hover:bg-[#27272a]/50 text-[#a1a1aa] hover:text-[#f97316] transition-all group cursor-pointer"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#27272a] group-hover:bg-[#431407] text-[#a1a1aa] group-hover:text-[#f97316] transition-colors mb-2">
                  <Plus className="h-5 w-5" />
                </div>
                <span className="text-xs font-semibold">Tạo mới</span>
              </button>

              {projects.map((p) => (
                <ProjectCard key={p._id} project={p} onDeleted={handleProjectDeleted} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
