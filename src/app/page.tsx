'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { StatsOverview } from '@/components/dashboard/StatsOverview';
import { ProjectCard } from '@/components/dashboard/ProjectCard';
import { IProject } from '@/types';
import { Plus, Video, Sparkles, Layers, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<IProject[]>([]);
  const [stats, setStats] = useState({ total: 0, today: 0, processing: 0 });
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

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

  const handleProjectDeleted = (id: string) => {
    setProjects((prev) => prev.filter((p) => p._id !== id));
    setStats((prev) => ({
      ...prev,
      total: Math.max(0, prev.total - 1),
    }));
  };

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">
        {/* Top Header & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Studio Dự Án Video</h1>
            <p className="text-xs text-[#a1a1aa] mt-1">
              Tự động hóa lồng tiếng, tạo phụ đề karaoke động và biên tập video phục vụ TikTok Affiliate
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
              disabled={isCreating}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#f97316] px-4 py-2 text-xs font-bold text-black hover:bg-[#ea580c] transition-all shadow-md"
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

        {/* Project Grid */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Danh Sách Video Gần Đây</h2>
            <span className="text-xs text-[#71717a]">{projects.length} dự án</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-[#a1a1aa] text-sm">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Đang tải danh sách video...</span>
            </div>
          ) : projects.length === 0 ? (
            /* Empty State according to design guidelines */
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#3f3f46] p-12 text-center bg-[#18181b]/40">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#27272a] text-[#f97316] mb-3">
                <Video className="h-7 w-7" />
              </div>
              <h3 className="font-bold text-white text-base">Chưa có dự án nào</h3>
              <p className="text-xs text-[#a1a1aa] mt-1 max-w-sm">
                Tạo dự án đầu tiên hoặc kéo thả video để bắt đầu lồng tiếng và tạo phụ đề karaoke
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
                className="flex flex-col items-center justify-center min-h-56 rounded-xl border border-dashed border-[#3f3f46] hover:border-[#f97316] bg-[#18181b]/30 hover:bg-[#27272a]/50 text-[#a1a1aa] hover:text-[#f97316] transition-all group"
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
