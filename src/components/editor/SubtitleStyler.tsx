'use client';

import { useState } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { ISubtitleStyle } from '@/types';
import { Subtitles, Sparkles, Save, Loader2, AlignCenter, Sliders } from 'lucide-react';
import { toast } from 'sonner';

export function SubtitleStyler() {
  const { project, updateSubtitleStyle, updateProjectPartial, setActiveTab } = useEditorStore();
  const [isSaving, setIsSaving] = useState(false);

  const style: ISubtitleStyle = project?.subtitle?.style || {
    fontFamily: 'Be Vietnam Pro',
    fontSize: 64,
    fontWeight: 'bold',
    primaryColor: '#FFFFFF',
    outlineColor: '#000000',
    outlineWidth: 4,
    shadowColor: '#00000080',
    shadowDepth: 2,
    position: 'bottom',
    marginBottom: 120,
    alignment: 'center',
    highlightEnabled: true,
    highlightColor: '#FFD700',
    animation: 'none',
    maxCharsPerLine: 25,
    wordsPerGroup: 3,
  };

  const enabled = project?.subtitle?.enabled ?? true;

  const handleSaveSubtitles = async () => {
    if (!project?._id) return;
    try {
      setIsSaving(true);
      const res = await fetch(`/api/projects/${project._id}/subtitle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          style,
          words: project.subtitle.words,
        }),
      });

      const data = await res.json();
      if (data.success && data.data?.subtitle) {
        toast.success('Đã lưu cấu hình phụ đề karaoke thành công');
        updateProjectPartial({ subtitle: data.data.subtitle });
      } else {
        toast.error(data.error || 'Lưu phụ đề thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối khi lưu phụ đề');
    } finally {
      setIsSaving(false);
    }
  };

  const wordCount = project?.subtitle?.words?.length || 0;

  return (
    <div className="flex flex-col gap-5 p-4 text-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-white">Tùy Chỉnh Phụ Đề Karaoke Động</h3>
          <p className="text-xs text-[#a1a1aa] mt-0.5">
            Định dạng font chữ, màu sắc và hiệu ứng quét chữ Karaoke chuẩn ASS 1080p
          </p>
        </div>

        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-white">
          <span>Bật phụ đề</span>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) =>
              updateProjectPartial({
                subtitle: {
                  ...project?.subtitle,
                  enabled: e.target.checked,
                } as any,
              })
            }
            className="h-4 w-4 rounded border-[#3f3f46] bg-[#09090b] text-[#f97316] focus:ring-0"
          />
        </label>
      </div>

      {/* Style Controls Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Colors Section */}
        <div className="rounded-xl border border-[#3f3f46] bg-[#09090b] p-4 flex flex-col gap-3">
          <p className="font-semibold text-xs text-white">Màu Sắc & Karaoke</p>

          <div className="flex items-center justify-between text-xs">
            <span className="text-[#a1a1aa]">Chữ ban đầu</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={style.primaryColor}
                onChange={(e) => updateSubtitleStyle({ primaryColor: e.target.value })}
                className="h-7 w-7 rounded cursor-pointer border border-[#3f3f46] bg-transparent"
              />
              <span className="font-mono text-[11px] text-[#71717a]">{style.primaryColor}</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-[#a1a1aa]">Karaoke Highlight (Đọc tới)</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={style.highlightColor}
                onChange={(e) => updateSubtitleStyle({ highlightColor: e.target.value })}
                className="h-7 w-7 rounded cursor-pointer border border-[#3f3f46] bg-transparent"
              />
              <span className="font-mono text-[11px] text-[#71717a]">{style.highlightColor}</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-[#a1a1aa]">Màu viền chữ (Outline)</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={style.outlineColor}
                onChange={(e) => updateSubtitleStyle({ outlineColor: e.target.value })}
                className="h-7 w-7 rounded cursor-pointer border border-[#3f3f46] bg-transparent"
              />
              <span className="font-mono text-[11px] text-[#71717a]">{style.outlineColor}</span>
            </div>
          </div>

          <label className="flex items-center gap-2 mt-1 cursor-pointer text-xs text-[#a1a1aa]">
            <input
              type="checkbox"
              checked={style.highlightEnabled}
              onChange={(e) => updateSubtitleStyle({ highlightEnabled: e.target.checked })}
              className="h-3.5 w-3.5 rounded border-[#3f3f46] bg-[#18181b] text-[#f97316]"
            />
            <span>Bật hiệu ứng quét từng từ (Karaoke Word Highlight)</span>
          </label>
        </div>

        {/* Layout & Font Section */}
        <div className="rounded-xl border border-[#3f3f46] bg-[#09090b] p-4 flex flex-col gap-3">
          <p className="font-semibold text-xs text-white">Vị Trí & Cỡ Chữ</p>

          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-[#a1a1aa]">Cỡ chữ (Font Size)</span>
              <span className="font-mono text-white font-semibold">{style.fontSize}px</span>
            </div>
            <input
              type="range"
              min={40}
              max={90}
              step={2}
              value={style.fontSize}
              onChange={(e) => updateSubtitleStyle({ fontSize: parseInt(e.target.value, 10) })}
              className="w-full h-1.5 bg-[#27272a] rounded-lg appearance-none cursor-pointer accent-[#f97316]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-[#a1a1aa]">Số từ mỗi cụm (Words Per Group)</span>
              <span className="font-mono text-white font-semibold">{style.wordsPerGroup || 3}</span>
            </div>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={style.wordsPerGroup || 3}
              onChange={(e) => updateSubtitleStyle({ wordsPerGroup: parseInt(e.target.value, 10) })}
              className="w-full h-1.5 bg-[#27272a] rounded-lg appearance-none cursor-pointer accent-[#f97316]"
            />
          </div>

          <div>
            <span className="text-xs text-[#a1a1aa] block mb-1.5">Vị trí hiển thị</span>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {(['top', 'center', 'bottom'] as const).map((pos) => (
                <button
                  key={pos}
                  type="button"
                  onClick={() => updateSubtitleStyle({ position: pos })}
                  className={`rounded-lg border py-1.5 capitalize transition-all ${
                    style.position === pos
                      ? 'border-[#f97316] bg-[#431407] text-[#f97316] font-semibold'
                      : 'border-[#3f3f46] bg-[#18181b] text-[#a1a1aa] hover:bg-[#27272a]'
                  }`}
                >
                  {pos === 'top' ? 'Trên' : pos === 'center' ? 'Giữa' : 'Dưới'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Word Timestamps Preview */}
      <div className="rounded-xl border border-[#3f3f46] bg-[#09090b] p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-white">Danh Sách Nhịp Từ ({wordCount} từ)</span>
          <span className="text-[#71717a]">Tự động trích xuất từ TTS</span>
        </div>

        {wordCount > 0 ? (
          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1">
            {project?.subtitle?.words?.map((w, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 rounded bg-[#27272a] px-2 py-0.5 text-xs text-white"
              >
                <span>{w.word}</span>
                <span className="text-[10px] text-[#71717a] font-mono">
                  {Math.round(w.start / 100) / 10}s
                </span>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[#71717a] py-2">
            Chưa có nhịp từ. Hãy tạo giọng đọc ở tab "Giọng đọc" trước.
          </p>
        )}
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={handleSaveSubtitles}
          disabled={isSaving}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#3f3f46] bg-[#27272a] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#3f3f46] transition-colors"
        >
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          <span>Lưu cấu hình phụ đề</span>
        </button>

        <button
          type="button"
          onClick={() => {
            handleSaveSubtitles();
            setActiveTab('music');
          }}
          className="inline-flex items-center gap-1 rounded-lg bg-[#f97316] px-4 py-2 text-xs font-semibold text-black hover:bg-[#ea580c] transition-colors"
        >
          <span>Tiếp tục sang Nhạc nền →</span>
        </button>
      </div>
    </div>
  );
}
