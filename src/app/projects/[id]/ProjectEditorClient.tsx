'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BookmarkCheck,
  BookmarkPlus,
  ChevronDown,
  ChevronUp,
  Cloud,
  CloudAlert,
  Download,
  Loader2,
  Pencil,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useEditorStore, type EditorTab } from '@/stores/editorStore';
import { Sidebar } from '@/components/editor/Sidebar';
import { VideoPlayer } from '@/components/editor/VideoPlayer';
import { Timeline } from '@/components/editor/Timeline';
import { ScriptEditor } from '@/components/editor/ScriptEditor';
import { TTSPanel } from '@/components/editor/TTSPanel';
import { SubtitleStyler } from '@/components/editor/SubtitleStyler';
import { BackgroundMusicPanel } from '@/components/editor/BackgroundMusicPanel';
import { ExportPanel } from '@/components/editor/ExportPanel';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import type { BrandPresetDTO, ProjectDTO } from '@/types';

interface ProjectEditorClientProps {
  id?: string;
  initialProject?: ProjectDTO;
}

export function ProjectEditorClient({ id, initialProject }: ProjectEditorClientProps) {
  const {
    project,
    activeTab,
    saveStatus,
    dirtyVersion,
    savedVersion,
    setProject,
    updateProjectPartial,
    applyBrandPreset,
    syncProject,
    setActiveTab,
  } = useEditorStore();

  const [loadingProject, setLoadingProject] = useState(!initialProject);
  const [loadError, setLoadError] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(initialProject?.name || '');
  const [mobilePreviewCollapsed, setMobilePreviewCollapsed] = useState(false);

  const [presets, setPresets] = useState<BrandPresetDTO[]>([]);
  const [presetMenuOpen, setPresetMenuOpen] = useState(false);
  const [savePresetOpen, setSavePresetOpen] = useState(false);
  const [presetNameDraft, setPresetNameDraft] = useState('');
  const [savingPreset, setSavingPreset] = useState(false);

  const debounceRef = useRef<number | null>(null);
  const presetDropdownRef = useRef<HTMLDivElement>(null);

  const loadProjectById = useCallback(
    async (projectId: string) => {
      setLoadingProject(true);
      setLoadError('');
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        const json = (await res.json()) as {
          success: boolean;
          data?: ProjectDTO;
          error?: string;
        };
        if (!res.ok || !json.success || !json.data) {
          setLoadError(json.error || 'Không tìm thấy dự án này.');
          return;
        }
        setProject(json.data);
        setNameDraft(json.data.name || '');
      } catch {
        setLoadError('Không thể tải dữ liệu dự án từ máy chủ.');
      } finally {
        setLoadingProject(false);
      }
    },
    [setProject]
  );

  useEffect(() => {
    if (initialProject) {
      setProject(initialProject);
      setNameDraft(initialProject.name || '');
      setLoadingProject(false);
    } else if (id) {
      loadProjectById(id);
    }
  }, [id, initialProject, loadProjectById, setProject]);

  // Fetch brand presets
  useEffect(() => {
    fetch('/api/presets')
      .then((r) => r.json())
      .then((json: { success: boolean; data?: BrandPresetDTO[] }) => {
        if (json.success && Array.isArray(json.data)) {
          setPresets(json.data);
        }
      })
      .catch(() => {});
  }, []);

  // Close preset dropdown on outside click
  useEffect(() => {
    if (!presetMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (
        presetDropdownRef.current &&
        !presetDropdownRef.current.contains(e.target as Node)
      ) {
        setPresetMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [presetMenuOpen]);

  // Debounced auto-save (700ms)
  useEffect(() => {
    if (!project?._id || dirtyVersion === 0 || dirtyVersion <= savedVersion) return;

    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }

    debounceRef.current = window.setTimeout(() => {
      syncProject();
    }, 700);

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [dirtyVersion, project?._id, savedVersion, syncProject]);

  const flushSave = useCallback(async (): Promise<boolean> => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    const state = useEditorStore.getState();
    if (state.dirtyVersion > state.savedVersion) {
      return await syncProject();
    }
    return true;
  }, [syncProject]);

  // Ctrl+S / Cmd+S shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        flushSave().then((ok) => {
          if (ok) toast.success('Đã lưu thay đổi');
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [flushSave]);

  // Flush pending edits when switching editor tabs from either Sidebar or panel CTAs
  useEffect(() => {
    flushSave();
  }, [activeTab, flushSave]);

  const handleSelectTab = async (nextTab: EditorTab) => {
    await flushSave();
    setActiveTab(nextTab);
  };

  const commitNameEdit = async () => {
    const trimmed = nameDraft.trim();
    setEditingName(false);
    if (!trimmed || !project || trimmed === project.name) {
      setNameDraft(project?.name || '');
      return;
    }
    updateProjectPartial({ name: trimmed });
    await syncProject({ name: trimmed });
  };

  const handleSaveAsPreset = async () => {
    const activeProj = useEditorStore.getState().project;
    if (!activeProj || !presetNameDraft.trim()) {
      toast.error('Vui lòng nhập tên cấu hình mẫu.');
      return;
    }

    setSavingPreset(true);
    try {
      const res = await fetch('/api/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: presetNameDraft.trim(),
          engine: activeProj.tts?.engine || 'edge',
          voice: activeProj.tts?.voice || 'vi-VN-HoaiMyNeural',
          speed: activeProj.tts?.speed ?? 1.0,
          pitch: activeProj.tts?.pitch ?? 0,
          aspectMode: activeProj.video?.aspectMode || 'contain',
          originalVolume: activeProj.video?.originalVolume ?? 0,
          subtitleEnabled: activeProj.subtitle?.enabled ?? true,
          subtitleStyle: activeProj.subtitle?.style || {},
          bgMusic: activeProj.bgMusic?.path
            ? {
                path: activeProj.bgMusic.path,
                name: activeProj.bgMusic.name || 'Nhạc nền',
                volume: activeProj.bgMusic.volume ?? 0.12,
                fadeIn: activeProj.bgMusic.fadeIn ?? 2,
                fadeOut: activeProj.bgMusic.fadeOut ?? 3,
                ducking: activeProj.bgMusic.ducking ?? true,
              }
            : undefined,
          exportResolution:
            activeProj.export?.resolution === '720x1280' ? '720x1280' : '1080x1920',
          exportQuality: activeProj.export?.quality || 'balanced',
        }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: BrandPresetDTO;
        error?: string;
      };
      if (!res.ok || !json.success || !json.data) {
        toast.error(json.error || 'Không thể lưu cấu hình mẫu');
        return;
      }
      setPresets((prev) => [json.data!, ...prev]);
      setPresetNameDraft('');
      setSavePresetOpen(false);
      toast.success('Đã lưu cấu hình mẫu thương hiệu mới');
    } catch {
      toast.error('Lỗi kết nối khi lưu cấu hình mẫu');
    } finally {
      setSavingPreset(false);
    }
  };

  const handleDeletePreset = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/presets/${id}`, { method: 'DELETE' });
      const json = (await res.json()) as { success: boolean };
      if (json.success) {
        setPresets((prev) => prev.filter((p) => p._id !== id));
        toast.success('Đã xóa cấu hình mẫu');
      }
    } catch {
      toast.error('Không thể xóa cấu hình mẫu');
    }
  };

  const currentProject = project || initialProject;

  if (loadingProject) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center gap-3 text-[#a1a1aa]">
        <Loader2 className="h-7 w-7 animate-spin text-[#f97316]" />
        <p className="text-xs">Đang mở không gian làm việc...</p>
      </div>
    );
  }

  if (loadError || !currentProject) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center gap-4 p-4 text-center">
        <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-6 max-w-sm w-full space-y-4">
          <p className="text-sm font-semibold text-[#fafafa]">
            {loadError || 'Không tìm thấy dự án'}
          </p>
          <div className="flex items-center justify-center gap-2">
            {id && (
              <Button size="sm" variant="outline" onClick={() => loadProjectById(id)}>
                Thử lại
              </Button>
            )}
            <Link
              href="/"
              className="inline-flex h-8 items-center rounded-md bg-[#f97316] px-3 text-xs font-semibold text-black hover:bg-[#ea580c]"
            >
              Về trang chủ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden flex flex-col bg-[#09090b] text-[#fafafa]">
      {/* Top Studio Header Bar (48px) */}
      <header className="h-12 shrink-0 border-b border-white/[0.08] bg-[#111113] px-3 sm:px-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link
            href="/"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-[#18181b] text-[#a1a1aa] hover:text-white hover:bg-[#27272a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f97316]"
            aria-label="Quay về danh sách dự án"
            title="Quay về danh sách dự án"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          {editingName ? (
            <Input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitNameEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitNameEdit();
                if (e.key === 'Escape') {
                  setNameDraft(currentProject.name);
                  setEditingName(false);
                }
              }}
              autoFocus
              className="h-8 w-44 sm:w-64 text-xs font-semibold"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setNameDraft(currentProject.name);
                setEditingName(true);
              }}
              className="group flex items-center gap-1.5 rounded-md px-2 py-1 text-left hover:bg-white/[0.05] min-w-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f97316]"
              title="Bấm để đổi tên dự án"
            >
              <span className="truncate max-w-[160px] sm:max-w-[260px] text-xs sm:text-sm font-semibold text-[#fafafa]">
                {currentProject.name}
              </span>
              <Pencil className="h-3 w-3 text-[#9ca3af] opacity-0 group-hover:opacity-100 shrink-0" />
            </button>
          )}

          <StatusBadge status={currentProject.status} className="hidden sm:inline-flex" />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Auto-save indicator */}
          <div className="hidden md:flex items-center gap-1.5 text-[11px] text-[#9ca3af]">
            {saveStatus === 'saving' ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin text-[#f97316]" />
                <span className="text-[#d4d4d8]">Đang lưu...</span>
              </>
            ) : saveStatus === 'error' ? (
              <button
                type="button"
                onClick={() => flushSave()}
                className="inline-flex items-center gap-1 text-red-400 hover:underline cursor-pointer"
              >
                <CloudAlert className="h-3.5 w-3.5" />
                <span>Lỗi lưu — Thử lại</span>
              </button>
            ) : saveStatus === 'saved' ? (
              <>
                <Cloud className="h-3.5 w-3.5 text-emerald-400" />
                <span>Đã lưu tự động</span>
              </>
            ) : null}
          </div>

          {/* Brand Presets Dropdown */}
          <div className="relative" ref={presetDropdownRef}>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPresetMenuOpen(!presetMenuOpen)}
              className="gap-1.5"
            >
              <BookmarkCheck className="h-3.5 w-3.5 text-[#f97316]" />
              <span className="hidden sm:inline">Cấu hình mẫu</span>
              <ChevronDown className="h-3 w-3" />
            </Button>

            {presetMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-64 rounded-lg border border-white/[0.12] bg-[#18181b] p-1.5 shadow-2xl z-50">
                <button
                  type="button"
                  onClick={() => {
                    setPresetMenuOpen(false);
                    setSavePresetOpen(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-semibold text-[#fb923c] hover:bg-[#f97316]/12 cursor-pointer"
                >
                  <BookmarkPlus className="h-3.5 w-3.5" />
                  <span>Lưu cấu hình hiện tại làm mẫu...</span>
                </button>

                <div className="my-1 border-t border-white/[0.08]" />

                {presets.length === 0 ? (
                  <div className="px-2.5 py-2 text-[11px] text-[#9ca3af]">
                    Chưa có cấu hình mẫu nào được lưu.
                  </div>
                ) : (
                  <div className="max-h-56 overflow-y-auto space-y-0.5">
                    {presets.map((p) => (
                      <div
                        key={p._id}
                        className="flex items-center justify-between gap-1 rounded-md hover:bg-white/[0.06] pr-1"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            applyBrandPreset(p);
                            setPresetMenuOpen(false);
                            toast.success(`Đã áp dụng mẫu "${p.name}"`);
                          }}
                          className="flex-1 truncate px-2.5 py-1.5 text-left text-xs text-[#fafafa] cursor-pointer"
                        >
                          {p.name}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeletePreset(p._id, e)}
                          aria-label={`Xóa mẫu ${p.name}`}
                          className="rounded p-1 text-[#9ca3af] hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {currentProject.status === 'done' && currentProject.export?.path && (
            <a
              href={`/api/projects/${currentProject._id}/export`}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-emerald-500/15 border border-emerald-500/35 px-2.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/25"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Tải MP4</span>
            </a>
          )}
        </div>
      </header>

      {/* Main Studio Body */}
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
        <Sidebar
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          project={currentProject}
        />

        {/* Video Stage + Timeline */}
        <section className="flex flex-1 min-h-0 flex-col bg-[#09090b]">
          {/* Mobile collapse bar */}
          <div className="flex lg:hidden items-center justify-between border-b border-white/[0.08] bg-[#111113] px-3 py-1.5">
            <span className="text-[11px] font-medium text-[#a1a1aa]">
              Khung xem trước 9:16
            </span>
            <button
              type="button"
              onClick={() => setMobilePreviewCollapsed(!mobilePreviewCollapsed)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#f97316] cursor-pointer"
            >
              <span>{mobilePreviewCollapsed ? 'Mở video' : 'Thu gọn'}</span>
              {mobilePreviewCollapsed ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronUp className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          <div className={`${mobilePreviewCollapsed ? 'hidden lg:flex' : 'flex'} flex-1 min-h-0 flex-col`}>
            <VideoPlayer />
            <Timeline />
          </div>
        </section>

        {/* Right Properties Inspector */}
        <aside className="w-full lg:w-[390px] xl:w-[420px] shrink-0 border-t lg:border-t-0 lg:border-l border-white/[0.08] bg-[#111113] lg:overflow-y-auto p-4">
          {activeTab === 'script' && <ScriptEditor />}
          {activeTab === 'voice' && <TTSPanel />}
          {activeTab === 'subtitle' && <SubtitleStyler />}
          {activeTab === 'music' && <BackgroundMusicPanel />}
          {activeTab === 'export' && <ExportPanel onFlushSave={flushSave} />}
        </aside>
      </div>

      {/* Save Brand Preset Dialog */}
      <Dialog
        open={savePresetOpen}
        onOpenChange={setSavePresetOpen}
        title="Lưu cấu hình thành mẫu thương hiệu"
        description="Lưu lại giọng đọc, kiểu phụ đề, nhạc nền và chế độ khung hình để áp dụng nhanh cho video sau."
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="preset-name-input" className="text-xs font-medium text-[#d4d4d8]">
              Tên cấu hình mẫu
            </label>
            <Input
              id="preset-name-input"
              value={presetNameDraft}
              onChange={(e) => setPresetNameDraft(e.target.value)}
              placeholder="VD: Kênh Review Mỹ Phẩm Hoài My"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSavePresetOpen(false)}
              disabled={savingPreset}
            >
              Hủy
            </Button>
            <Button
              size="sm"
              onClick={handleSaveAsPreset}
              disabled={savingPreset || !presetNameDraft.trim()}
            >
              {savingPreset ? 'Đang lưu...' : 'Lưu mẫu'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

export default ProjectEditorClient;
