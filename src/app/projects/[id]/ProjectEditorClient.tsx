'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useEditorStore } from '@/stores/editorStore';
import { Sidebar } from '@/components/layout/Sidebar';
import { VideoPlayer } from '@/components/editor/VideoPlayer';
import { Timeline } from '@/components/editor/Timeline';
import { ScriptEditor } from '@/components/editor/ScriptEditor';
import { TTSPanel } from '@/components/editor/TTSPanel';
import { SubtitleStyler } from '@/components/editor/SubtitleStyler';
import { BackgroundMusicPanel } from '@/components/editor/BackgroundMusicPanel';
import { ExportPanel } from '@/components/editor/ExportPanel';
import {
  ArrowLeft,
  Rocket,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileEdit,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  id: string;
}

export default function ProjectEditorClient({ id }: Props) {
  const {
    project,
    setProject,
    activeTab,
    setActiveTab,
    isRendering,
    setIsRendering,
    renderProgress,
    setRenderProgress,
    activeJobId,
    setActiveJobId,
  } = useEditorStore();

  const [loading, setLoading] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [projectName, setProjectName] = useState('');

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then((res) => res.json())
      .then((res) => {
        if (res.success && res.data) {
          setProject(res.data);
          setProjectName(res.data.name || '');
        } else {
          toast.error(res.error || 'Không tải được dự án');
        }
      })
      .catch(() => {
        toast.error('Lỗi kết nối khi tải dự án');
      })
      .finally(() => {
        setLoading(false);
      });

    return () => {
      setProject(null);
      useEditorStore.getState().setIsPlaying(false);
      useEditorStore.getState().setCurrentTime(0);
      useEditorStore.getState().setActiveJobId(null);
      useEditorStore.getState().setIsRendering(false);
      useEditorStore.getState().setRenderProgress(0);
    };
  }, [id, setProject]);

  // Persistent BullMQ Job Polling across all tabs
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
            toast.success('Render video hoàn tất! Bạn có thể xem ngay trên màn hình hoặc tải về.');

            // Refresh project details from database
            const pRes = await fetch(`/api/projects/${id}`);
            const pData = await pRes.json();
            if (pData.success && pData.data) {
              setProject(pData.data);
              useEditorStore.getState().setPreviewMode('export');
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
  }, [
    activeJobId,
    isRendering,
    id,
    setProject,
    setIsRendering,
    setRenderProgress,
    setActiveJobId,
  ]);

  const handleSaveName = async () => {
    setIsEditingName(false);
    if (!projectName.trim() || projectName === project?.name) return;

    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: projectName }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setProject(data.data);
        toast.success('Đã đổi tên dự án');
      }
    } catch {
      toast.error('Lỗi khi đổi tên dự án');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-white text-sm">
        <Loader2 className="h-6 w-6 animate-spin mr-2 text-[#f97316]" />
        <span>Đang mở Studio Editor...</span>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center text-white gap-4">
        <p className="text-base font-semibold">Không tìm thấy dự án</p>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#27272a] px-4 py-2 text-xs text-white hover:bg-[#3f3f46]"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Quay lại Dashboard</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col text-white">
      {/* Top Studio Bar */}
      <header className="h-14 border-b border-[#3f3f46] bg-[#18181b] px-4 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-lg p-1.5 text-[#a1a1aa] hover:bg-[#27272a] hover:text-white transition-colors"
            title="Quay lại danh sách"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-xs hidden sm:inline">Quay lại</span>
          </Link>

          <div className="h-4 w-px bg-[#3f3f46] hidden sm:block" />

          {/* Project Name (Editable) */}
          {isEditingName ? (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                autoFocus
                className="rounded border border-[#f97316] bg-[#09090b] px-2 py-1 text-sm font-semibold text-white focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSaveName}
                className="p-1 text-[#22c55e] hover:bg-[#27272a] rounded"
              >
                <Save className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div
              onClick={() => setIsEditingName(true)}
              className="flex items-center gap-1.5 cursor-pointer group"
            >
              <h1 className="font-semibold text-sm text-white group-hover:text-[#f97316] transition-colors truncate max-w-xs sm:max-w-md">
                {project.name || 'Dự án chưa đặt tên'}
              </h1>
              <FileEdit className="h-3.5 w-3.5 text-[#71717a] group-hover:text-[#f97316] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )}

          {/* Status Badge */}
          <span className="hidden md:inline-flex items-center gap-1 rounded-full bg-[#27272a] px-2.5 py-0.5 text-[11px] font-medium text-[#a1a1aa]">
            {project.status === 'done' ? (
              <span className="text-[#22c55e] flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Hoàn tất
              </span>
            ) : project.status === 'rendering' ? (
              <span className="text-[#eab308] flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Đang render
              </span>
            ) : project.status === 'subtitled' ? (
              <span className="text-cyan-400">Đã có phụ đề</span>
            ) : project.status === 'voiced' ? (
              <span className="text-blue-400">Đã tạo giọng</span>
            ) : project.status === 'scripted' ? (
              <span className="text-purple-400">Có kịch bản</span>
            ) : project.status === 'error' ? (
              <span className="text-[#ef4444] flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Lỗi
              </span>
            ) : (
              <span>Bản nháp</span>
            )}
          </span>
        </div>

        {/* Right CTA */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              activeTab === 'export'
                ? 'bg-[#f97316] text-black shadow-md'
                : 'border border-[#3f3f46] bg-[#27272a] text-white hover:bg-[#3f3f46]'
            }`}
          >
            <Rocket className="h-3.5 w-3.5" />
            <span>Xuất video</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Vertical Sidebar (5 tabs) */}
        <Sidebar />

        {/* Center: Stage with Video Player */}
        <section className="flex-1 bg-[#09090b] flex flex-col items-center justify-center p-4 overflow-y-auto">
          <VideoPlayer />
        </section>

        {/* Right: Active Tab Tool Panel */}
        <section className="w-full sm:w-[420px] md:w-[480px] lg:w-[520px] border-l border-[#3f3f46] bg-[#18181b] flex flex-col overflow-y-auto shrink-0 shadow-lg">
          {activeTab === 'script' && <ScriptEditor />}
          {activeTab === 'voice' && <TTSPanel />}
          {activeTab === 'subtitle' && <SubtitleStyler />}
          {activeTab === 'music' && <BackgroundMusicPanel />}
          {activeTab === 'export' && <ExportPanel />}
        </section>
      </div>

      {/* Bottom Timeline */}
      <Timeline />

      {/* Persistent Bottom Render Progress Bar */}
      {isRendering && (
        <div className="h-8 bg-[#eab308]/15 border-t border-[#eab308]/40 px-4 flex items-center justify-between text-xs text-[#eab308] z-30 animate-pulse">
          <span className="flex items-center gap-2 font-medium">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Hệ thống đang render video...</span>
          </span>
          <span className="font-mono font-bold text-white">{renderProgress}%</span>
        </div>
      )}
    </div>
  );
}
