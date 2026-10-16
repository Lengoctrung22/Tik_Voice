'use client';

import { useState } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { Music, Upload, Trash2, Volume2, Save, Loader2, Disc, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export const PRESET_MUSIC_TRACKS = [
  {
    path: 'public/music/lofi-chill.mp3',
    name: 'Lo-Fi Chill & Relax',
    desc: 'Êm dịu, nhẹ nhàng, tôn rõ giọng đọc sản phẩm',
  },
  {
    path: 'public/music/upbeat-tiktok.mp3',
    name: 'TikTok Upbeat Energy',
    desc: 'Năng động, cuốn hút, kích thích quyết định mua hàng',
  },
  {
    path: 'public/music/acoustic-warm.mp3',
    name: 'Acoustic Warm & Gentle',
    desc: 'Ấm áp, gần gũi, phù hợp storytelling và đời sống',
  },
];

export function BackgroundMusicPanel() {
  const { project, updateBgMusic, updateProjectPartial, setActiveTab } = useEditorStore();
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const bgMusic = project?.bgMusic || {
    path: '',
    name: '',
    volume: 0.12,
    fadeIn: 2,
    fadeOut: 3,
  };

  const handleSelectPreset = (preset: (typeof PRESET_MUSIC_TRACKS)[0]) => {
    updateBgMusic({
      path: preset.path,
      name: preset.name,
      volume: bgMusic.volume ?? 0.12,
      fadeIn: bgMusic.fadeIn ?? 2,
      fadeOut: bgMusic.fadeOut ?? 3,
    });
    toast.success(`Đã chọn nhạc nền: ${preset.name}`);
  };

  const handleMusicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !project?._id) return;

    try {
      setIsUploading(true);
      const toastId = toast.loading('Đang tải nhạc nền lên...');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'music');
      formData.append('projectId', project._id);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success && data.data) {
        toast.success('Tải nhạc nền lên thành công', { id: toastId });
        updateBgMusic({
          path: data.data.path,
          name: data.data.fileName,
          volume: bgMusic.volume ?? 0.12,
          fadeIn: bgMusic.fadeIn ?? 2,
          fadeOut: bgMusic.fadeOut ?? 3,
        });
      } else {
        toast.error(data.error || 'Tải nhạc thất bại', { id: toastId });
      }
    } catch {
      toast.error('Lỗi khi tải nhạc nền');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveMusic = async () => {
    if (!project?._id) return;
    try {
      await fetch(`/api/projects/${project._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bgMusic: null }),
      });
      updateBgMusic(undefined);
      toast.success('Đã gỡ nhạc nền khỏi dự án');
    } catch {
      toast.error('Lỗi khi gỡ nhạc nền');
    }
  };

  const handleSaveMusicConfig = async () => {
    if (!project?._id) return;
    try {
      setIsSaving(true);
      const res = await fetch(`/api/projects/${project._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bgMusic }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        updateProjectPartial(data.data);
        toast.success('Đã lưu cấu hình nhạc nền thành công');
      } else {
        toast.error(data.error || 'Lưu nhạc nền thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối khi lưu cấu hình');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 p-4 text-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-white">Nhạc Nền (Background Music)</h3>
          <p className="text-xs text-[#a1a1aa] mt-0.5">
            Tự động lặp (loop) và hạ âm lượng (audio ducking) để tôn giọng đọc rõ ràng
          </p>
        </div>

        {bgMusic.path && (
          <button
            type="button"
            onClick={handleRemoveMusic}
            className="inline-flex items-center gap-1 rounded-lg border border-[#ef4444]/40 px-2.5 py-1 text-xs text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors"
          >
            <Trash2 className="h-3 w-3" />
            <span>Gỡ nhạc</span>
          </button>
        )}
      </div>

      {/* Preset Music Selector */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-[#a1a1aa]">Kho nhạc nền có sẵn chuẩn TikTok</label>
        <div className="flex flex-col gap-2">
          {PRESET_MUSIC_TRACKS.map((track) => {
            const isSelected = bgMusic.path === track.path;
            return (
              <button
                key={track.path}
                type="button"
                onClick={() => handleSelectPreset(track)}
                className={`flex items-center justify-between rounded-xl border p-3 text-left transition-all ${
                  isSelected
                    ? 'border-[#f97316] bg-[#431407]/40 shadow-sm'
                    : 'border-[#3f3f46] bg-[#09090b] hover:bg-[#27272a]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      isSelected ? 'bg-[#f97316] text-black' : 'bg-[#27272a] text-[#a1a1aa]'
                    }`}
                  >
                    <Disc className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-xs text-white">{track.name}</p>
                    <p className="text-[11px] text-[#a1a1aa]">{track.desc}</p>
                  </div>
                </div>

                {isSelected && (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-[#f97316]">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Đang dùng</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Or Upload Custom MP3 */}
      <div className="rounded-xl border border-[#3f3f46] bg-[#09090b] p-4 flex flex-col items-center justify-center text-center gap-2.5">
        <div className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-[#f97316]" />
          <span className="text-xs font-semibold text-white">Hoặc tải lên tệp nhạc của bạn</span>
        </div>

        {bgMusic.name && !PRESET_MUSIC_TRACKS.some((p) => p.path === bgMusic.path) && (
          <p className="text-xs text-[#22c55e] font-medium">Tệp hiện tại: {bgMusic.name}</p>
        )}

        <label className="cursor-pointer inline-flex items-center gap-2 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] border border-[#3f3f46] px-4 py-2 text-xs font-semibold text-white transition-all">
          {isUploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5 text-[#f97316]" />
          )}
          <span>Tải tệp MP3 từ máy tính</span>
          <input
            type="file"
            accept="audio/mp3,audio/wav,audio/mpeg"
            onChange={handleMusicUpload}
            className="hidden"
          />
        </label>
      </div>

      {/* Sliders: Volume, Fade In, Fade Out */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-xl border border-[#3f3f46] bg-[#09090b] p-4">
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-[#a1a1aa]">Âm lượng (Volume)</span>
            <span className="font-mono text-white font-semibold">
              {Math.round((bgMusic.volume ?? 0.12) * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0.02}
            max={0.35}
            step={0.01}
            value={bgMusic.volume ?? 0.12}
            onChange={(e) =>
              updateBgMusic({
                volume: parseFloat(e.target.value),
              })
            }
            className="w-full h-1.5 bg-[#27272a] rounded-lg appearance-none cursor-pointer accent-[#f97316]"
          />
          <p className="text-[10px] text-[#71717a] mt-1 font-mono">Khuyên dùng 10% - 15%</p>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-[#a1a1aa]">Lớn dần (Fade In)</span>
            <span className="font-mono text-white font-semibold">{bgMusic.fadeIn ?? 2}s</span>
          </div>
          <input
            type="range"
            min={0}
            max={5}
            step={0.5}
            value={bgMusic.fadeIn ?? 2}
            onChange={(e) =>
              updateBgMusic({
                fadeIn: parseFloat(e.target.value),
              })
            }
            className="w-full h-1.5 bg-[#27272a] rounded-lg appearance-none cursor-pointer accent-[#f97316]"
          />
          <p className="text-[10px] text-[#71717a] mt-1 font-mono">Mặc định 2 giây</p>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-[#a1a1aa]">Nhỏ dần (Fade Out)</span>
            <span className="font-mono text-white font-semibold">{bgMusic.fadeOut ?? 3}s</span>
          </div>
          <input
            type="range"
            min={0}
            max={6}
            step={0.5}
            value={bgMusic.fadeOut ?? 3}
            onChange={(e) =>
              updateBgMusic({
                fadeOut: parseFloat(e.target.value),
              })
            }
            className="w-full h-1.5 bg-[#27272a] rounded-lg appearance-none cursor-pointer accent-[#f97316]"
          />
          <p className="text-[10px] text-[#71717a] mt-1 font-mono">Mặc định 3 giây</p>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={handleSaveMusicConfig}
          disabled={isSaving}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#3f3f46] bg-[#27272a] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#3f3f46] transition-colors"
        >
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          <span>Lưu cấu hình nhạc</span>
        </button>

        <button
          type="button"
          onClick={() => {
            handleSaveMusicConfig();
            setActiveTab('export');
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#f97316] px-4 py-2 text-xs font-bold text-black hover:bg-[#ea580c] transition-colors shadow-sm"
        >
          <span>Tiếp tục sang Xuất video →</span>
        </button>
      </div>
    </div>
  );
}
