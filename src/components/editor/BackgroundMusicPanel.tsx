'use client';

import { useState } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { Music, Upload, Trash2, Volume2, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function BackgroundMusicPanel() {
  const { project, updateProjectPartial, setActiveTab } = useEditorStore();
  const [isSaving, setIsSaving] = useState(false);

  const bgMusic = project?.bgMusic || {
    path: '',
    name: '',
    volume: 0.12,
    fadeIn: 2,
    fadeOut: 3,
  };

  const handleMusicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !project?._id) return;

    const toastId = toast.loading('Đang tải nhạc nền lên...');
    try {
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
        updateProjectPartial({
          bgMusic: {
            path: data.data.path,
            name: data.data.fileName,
            volume: 0.12,
            fadeIn: 2,
            fadeOut: 3,
          },
        });
      } else {
        toast.error(data.error || 'Tải nhạc thất bại', { id: toastId });
      }
    } catch {
      toast.error('Lỗi khi tải nhạc nền', { id: toastId });
    }
  };

  const handleRemoveMusic = async () => {
    if (!project?._id) return;
    try {
      await fetch(`/api/projects/${project._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bgMusic: undefined }),
      });
      updateProjectPartial({ bgMusic: undefined });
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
      if (data.success) {
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
            Tự động lặp (loop) và giảm nhỏ âm lượng để tôn giọng đọc sản phẩm rõ ràng
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

      {/* Music Upload Box */}
      <div className="rounded-xl border border-[#3f3f46] bg-[#09090b] p-4 flex flex-col items-center justify-center text-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#27272a] text-[#f97316]">
          <Music className="h-6 w-6" />
        </div>

        {bgMusic.name ? (
          <div>
            <p className="font-semibold text-white text-sm">{bgMusic.name}</p>
            <p className="text-xs text-[#22c55e] mt-0.5">Đã sẵn sàng ghép vào video</p>
          </div>
        ) : (
          <div>
            <p className="font-medium text-white text-xs">Chưa có nhạc nền</p>
            <p className="text-xs text-[#71717a] mt-0.5">Tải lên tệp âm thanh định dạng MP3, WAV</p>
          </div>
        )}

        <label className="cursor-pointer inline-flex items-center gap-2 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] border border-[#3f3f46] px-4 py-2 text-xs font-semibold text-white transition-all">
          <Upload className="h-3.5 w-3.5 text-[#f97316]" />
          <span>{bgMusic.name ? 'Thay đổi bài nhạc khác' : 'Tải nhạc nền lên'}</span>
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
              updateProjectPartial({
                bgMusic: { ...bgMusic, volume: parseFloat(e.target.value) },
              })
            }
            className="w-full h-1.5 bg-[#27272a] rounded-lg appearance-none cursor-pointer accent-[#f97316]"
          />
          <p className="text-[10px] text-[#71717a] mt-1">Khuyên dùng 10% - 15%</p>
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
              updateProjectPartial({
                bgMusic: { ...bgMusic, fadeIn: parseFloat(e.target.value) },
              })
            }
            className="w-full h-1.5 bg-[#27272a] rounded-lg appearance-none cursor-pointer accent-[#f97316]"
          />
          <p className="text-[10px] text-[#71717a] mt-1">Mặc định 2 giây</p>
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
              updateProjectPartial({
                bgMusic: { ...bgMusic, fadeOut: parseFloat(e.target.value) },
              })
            }
            className="w-full h-1.5 bg-[#27272a] rounded-lg appearance-none cursor-pointer accent-[#f97316]"
          />
          <p className="text-[10px] text-[#71717a] mt-1">Mặc định 3 giây</p>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={handleSaveMusicConfig}
          disabled={isSaving}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#3f3f46] bg-[#27272a] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#3f3f46] transition-colors"
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
          className="inline-flex items-center gap-1 rounded-lg bg-[#f97316] px-4 py-2 text-xs font-semibold text-black hover:bg-[#ea580c] transition-colors"
        >
          <span>Tiếp tục sang Xuất video →</span>
        </button>
      </div>
    </div>
  );
}
