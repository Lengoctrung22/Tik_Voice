'use client';

import { useState } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { ISubtitleStyle } from '@/types';
import { Subtitles, Sparkles, Save, Loader2, Type, Sliders, Palette, Layout } from 'lucide-react';
import { toast } from 'sonner';

export const FONT_FAMILIES = [
  'Be Vietnam Pro',
  'Montserrat',
  'Inter',
  'Roboto',
];

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
          words: project?.subtitle?.words || [],
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
            Thay đổi hiển thị thời gian thực và tự động dịch sang mã FFmpeg ASS 1080p
          </p>
        </div>

        {/* Enable Subtitles Toggle */}
        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-white bg-[#27272a] px-3 py-1.5 rounded-lg border border-[#3f3f46]">
          <span>Bật phụ đề</span>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) =>
              updateProjectPartial({
                subtitle: {
                  ...project?.subtitle,
                  enabled: e.target.checked,
                  style,
                  words: project?.subtitle?.words || [],
                },
              })
            }
            className="h-4 w-4 rounded border-[#3f3f46] bg-[#09090b] text-[#f97316] accent-[#f97316] cursor-pointer"
          />
        </label>
      </div>

      {/* Main Controls Grid */}
      <div className="flex flex-col gap-4">
        {/* Font Family & Weight */}
        <div className="rounded-xl border border-[#3f3f46] bg-[#09090b] p-4 flex flex-col gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
            <Type className="h-4 w-4 text-[#f97316]" />
            <span>Phông Chữ & Kiểu Chữ (Font)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-[11px] text-[#a1a1aa] block mb-1">Font chữ</label>
              <select
                value={style.fontFamily || 'Be Vietnam Pro'}
                onChange={(e) => updateSubtitleStyle({ fontFamily: e.target.value })}
                className="w-full rounded-lg border border-[#3f3f46] bg-[#18181b] p-2 text-xs text-white focus:border-[#f97316] focus:outline-none"
              >
                {FONT_FAMILIES.map((f) => (
                  <option key={f} value={f}>
                    {f} {f === 'Be Vietnam Pro' ? '(Khuyên dùng - Chuẩn Tiếng Việt)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] text-[#a1a1aa] block mb-1">Độ đậm (Font Weight)</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['normal', 'bold', 'black'] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => updateSubtitleStyle({ fontWeight: w })}
                    className={`py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                      style.fontWeight === w
                        ? 'border-[#f97316] bg-[#431407] text-[#f97316]'
                        : 'border-[#3f3f46] bg-[#18181b] text-[#a1a1aa] hover:bg-[#27272a]'
                    }`}
                  >
                    {w === 'normal' ? 'Thường' : w === 'bold' ? 'Đậm' : 'Siêu Đậm'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Colors & Karaoke Highlight */}
        <div className="rounded-xl border border-[#3f3f46] bg-[#09090b] p-4 flex flex-col gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
            <Palette className="h-4 w-4 text-[#f97316]" />
            <span>Màu Sắc & Hiệu Ứng Karaoke</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5 text-xs">
              <span className="text-[#a1a1aa]">Chữ ban đầu</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={style.primaryColor || '#FFFFFF'}
                  onChange={(e) => updateSubtitleStyle({ primaryColor: e.target.value })}
                  className="h-7 w-7 rounded cursor-pointer border border-[#3f3f46] bg-transparent"
                />
                <span className="font-mono text-[11px] text-white">{style.primaryColor}</span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 text-xs">
              <span className="text-[#a1a1aa]">Karaoke Highlight</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={style.highlightColor || '#FFD700'}
                  onChange={(e) => updateSubtitleStyle({ highlightColor: e.target.value })}
                  className="h-7 w-7 rounded cursor-pointer border border-[#3f3f46] bg-transparent"
                />
                <span className="font-mono text-[11px] text-[#ffd700]">{style.highlightColor}</span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 text-xs">
              <span className="text-[#a1a1aa]">Màu viền (Outline)</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={style.outlineColor || '#000000'}
                  onChange={(e) => updateSubtitleStyle({ outlineColor: e.target.value })}
                  className="h-7 w-7 rounded cursor-pointer border border-[#3f3f46] bg-transparent"
                />
                <span className="font-mono text-[11px] text-white">{style.outlineColor}</span>
              </div>
            </div>
          </div>

          {/* Karaoke Highlight Toggle */}
          <label className="flex items-center gap-2 mt-1 cursor-pointer text-xs text-white">
            <input
              type="checkbox"
              checked={style.highlightEnabled ?? true}
              onChange={(e) => updateSubtitleStyle({ highlightEnabled: e.target.checked })}
              className="h-4 w-4 rounded border-[#3f3f46] bg-[#18181b] text-[#f97316] accent-[#f97316]"
            />
            <span className="font-medium">
              Bật hiệu ứng quét màu từng từ khi đọc tới (Karaoke Dynamic Highlight)
            </span>
          </label>
        </div>

        {/* Layout, Position & Sliders */}
        <div className="rounded-xl border border-[#3f3f46] bg-[#09090b] p-4 flex flex-col gap-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
            <Layout className="h-4 w-4 text-[#f97316]" />
            <span>Kích Thước, Vị Trí & Bố Cục</span>
          </div>

          {/* Position Top / Center / Bottom */}
          <div>
            <label className="text-[11px] text-[#a1a1aa] block mb-1.5">Vị trí hiển thị trên màn hình</label>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {(['top', 'center', 'bottom'] as const).map((pos) => (
                <button
                  key={pos}
                  type="button"
                  onClick={() => updateSubtitleStyle({ position: pos })}
                  className={`rounded-lg border py-2 capitalize font-semibold transition-all ${
                    style.position === pos
                      ? 'border-[#f97316] bg-[#431407] text-[#f97316]'
                      : 'border-[#3f3f46] bg-[#18181b] text-[#a1a1aa] hover:bg-[#27272a]'
                  }`}
                >
                  {pos === 'top' ? 'Ở Trên' : pos === 'center' ? 'Ở Giữa' : 'Ở Dưới (Chuẩn TikTok)'}
                </button>
              ))}
            </div>
          </div>

          {/* Alignment Left / Center / Right */}
          <div>
            <label className="text-[11px] text-[#a1a1aa] block mb-1.5">Căn lề phụ đề (Text Alignment)</label>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {(['left', 'center', 'right'] as const).map((align) => (
                <button
                  key={align}
                  type="button"
                  onClick={() => updateSubtitleStyle({ alignment: align })}
                  className={`rounded-lg border py-1.5 capitalize font-semibold transition-all ${
                    (style.alignment || 'center') === align
                      ? 'border-[#f97316] bg-[#431407] text-[#f97316]'
                      : 'border-[#3f3f46] bg-[#18181b] text-[#a1a1aa] hover:bg-[#27272a]'
                  }`}
                >
                  {align === 'left' ? 'Căn Trái' : align === 'center' ? 'Căn Giữa' : 'Căn Phải'}
                </button>
              ))}
            </div>
          </div>

          {/* Sliders Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Font size */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-[#a1a1aa]">Cỡ chữ (Font Size)</span>
                <span className="font-mono text-white font-semibold">{style.fontSize}px</span>
              </div>
              <input
                type="range"
                min={40}
                max={96}
                step={2}
                value={style.fontSize ?? 64}
                onChange={(e) => updateSubtitleStyle({ fontSize: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-[#27272a] rounded-lg appearance-none cursor-pointer accent-[#f97316]"
              />
              <span className="text-[10px] text-[#71717a]">Chuẩn 64px trên độ phân giải 1080p</span>
            </div>

            {/* Outline Width */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-[#a1a1aa]">Độ dày viền (Outline Width)</span>
                <span className="font-mono text-white font-semibold">{style.outlineWidth ?? 4}px</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={style.outlineWidth ?? 4}
                onChange={(e) => updateSubtitleStyle({ outlineWidth: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-[#27272a] rounded-lg appearance-none cursor-pointer accent-[#f97316]"
              />
              <span className="text-[10px] text-[#71717a]">Viền đen chống chìm trên nền video</span>
            </div>

            {/* Words Per Group */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-[#a1a1aa]">Số từ mỗi cụm (Words Per Group)</span>
                <span className="font-mono text-white font-semibold">{style.wordsPerGroup ?? 3} từ</span>
              </div>
              <input
                type="range"
                min={1}
                max={6}
                step={1}
                value={style.wordsPerGroup ?? 3}
                onChange={(e) => updateSubtitleStyle({ wordsPerGroup: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-[#27272a] rounded-lg appearance-none cursor-pointer accent-[#f97316]"
              />
              <span className="text-[10px] text-[#71717a]">Khuyên dùng 2 - 4 từ cho video nhanh</span>
            </div>

            {/* Margin Bottom */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-[#a1a1aa]">Khoảng cách đáy (Margin Bottom)</span>
                <span className="font-mono text-white font-semibold">{style.marginBottom ?? 120}px</span>
              </div>
              <input
                type="range"
                min={40}
                max={300}
                step={10}
                value={style.marginBottom ?? 120}
                onChange={(e) => updateSubtitleStyle({ marginBottom: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-[#27272a] rounded-lg appearance-none cursor-pointer accent-[#f97316]"
              />
              <span className="text-[10px] text-[#71717a]">Tránh bị che bởi nút TikTok / giỏ hàng</span>
            </div>

            {/* Max chars per line */}
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-[#a1a1aa]">Số ký tự tối đa một dòng (Max Chars)</span>
                <span className="font-mono text-white font-semibold">{style.maxCharsPerLine ?? 25} ký tự</span>
              </div>
              <input
                type="range"
                min={15}
                max={40}
                step={1}
                value={style.maxCharsPerLine ?? 25}
                onChange={(e) => updateSubtitleStyle({ maxCharsPerLine: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-[#27272a] rounded-lg appearance-none cursor-pointer accent-[#f97316]"
              />
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
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1">
              {project?.subtitle?.words?.map((w, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 rounded bg-[#27272a] px-2 py-0.5 text-xs text-white"
                >
                  <span>{w.word}</span>
                  <span className="text-[10px] text-[#f97316] font-mono">
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
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={handleSaveSubtitles}
          disabled={isSaving}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#3f3f46] bg-[#27272a] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#3f3f46] transition-colors"
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
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#f97316] px-4 py-2 text-xs font-bold text-black hover:bg-[#ea580c] transition-colors shadow-sm"
        >
          <span>Tiếp tục sang Nhạc nền →</span>
        </button>
      </div>
    </div>
  );
}
