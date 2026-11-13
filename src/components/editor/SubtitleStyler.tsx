'use client';

import React, { useState } from 'react';
import {
  Captions,
  ChevronDown,
  ChevronUp,
  Save,
  Loader2,
  Check,
  Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import { useEditorStore } from '@/stores/editorStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { DEFAULT_SUBTITLE_STYLE, SUBTITLE_PRESETS } from '@/lib/video/subtitle-presets';
import { BUNDLED_SUBTITLE_FONTS } from '@/lib/video/subtitle-layout';
import type { ISubtitleStyle, IWordTimestamp, ProjectDTO } from '@/types';

export function SubtitleStyler() {
  const {
    project,
    currentTime,
    updateProjectPartial,
    updateSubtitleStyle,
    updateWords,
    seekTo,
    setActiveTab,
  } = useEditorStore();

  const [openSection, setOpenSection] = useState<'font' | 'layout' | 'transcript' | null>('font');
  const [savingSub, setSavingSub] = useState(false);
  const [editingWordIdx, setEditingWordIdx] = useState<number | null>(null);
  const [editingWordText, setEditingWordText] = useState('');

  const enabled = project?.subtitle?.enabled ?? true;
  const style: ISubtitleStyle = {
    ...DEFAULT_SUBTITLE_STYLE,
    ...(project?.subtitle?.style || {}),
  };
  const words = project?.subtitle?.words || [];

  const handleApplyPreset = (presetStyle: Partial<ISubtitleStyle>) => {
    updateSubtitleStyle(presetStyle);
  };

  const handleSaveSubtitleFile = async () => {
    if (!project?._id) return;
    setSavingSub(true);
    try {
      const res = await fetch(`/api/projects/${project._id}/subtitle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          style,
          words: words.map((w) => ({ word: w.word, start: w.start, end: w.end })),
        }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: { project?: ProjectDTO };
        error?: string;
      };
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Không thể lưu tệp phụ đề');
        return;
      }
      if (json.data?.project) {
        updateProjectPartial(json.data.project, false);
      }
      toast.success('Đã lưu cấu hình & dữ liệu phụ đề');
    } catch {
      toast.error('Lỗi kết nối khi lưu phụ đề');
    } finally {
      setSavingSub(false);
    }
  };

  const commitWordEdit = (idx: number) => {
    const clean = editingWordText.trim();
    if (!clean) {
      setEditingWordIdx(null);
      return;
    }
    const nextWords: IWordTimestamp[] = words.map((w, i) =>
      i === idx ? { ...w, word: clean } : w
    );
    updateWords(nextWords);
    setEditingWordIdx(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-[#fafafa]">3. Phụ đề Karaoke</h2>
          <p className="text-[11px] text-[#9ca3af]">
            Áp dụng mẫu 1 chạm hoặc tinh chỉnh chi tiết hiển thị
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#a1a1aa]">{enabled ? 'Đang bật' : 'Đã tắt'}</span>
          <Switch
            checked={enabled}
            ariaLabel="Bật hoặc tắt phụ đề"
            onCheckedChange={(val) =>
              updateProjectPartial({
                subtitle: {
                  ...project?.subtitle,
                  enabled: val,
                  style,
                  words,
                },
              })
            }
          />
        </div>
      </div>

      {/* 5 Presets */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-[#d4d4d8]">Mẫu nhanh 1 chạm</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1.5">
          {SUBTITLE_PRESETS.map((preset) => {
            const isActive =
              style.fontFamily === preset.style.fontFamily &&
              style.highlightColor === preset.style.highlightColor &&
              style.animation === preset.style.animation;

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleApplyPreset(preset.style)}
                className={`flex items-center justify-between gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors cursor-pointer ${
                  isActive
                    ? 'border-[#f97316]/60 bg-[#f97316]/12'
                    : 'border-white/[0.08] bg-[#18181b] hover:border-white/[0.16]'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#fafafa]">
                    <span>{preset.name}</span>
                    {isActive && <Check className="h-3 w-3 text-[#f97316]" />}
                  </div>
                  <div className="text-[10px] text-[#9ca3af] truncate">{preset.description}</div>
                </div>
                <span
                  className="shrink-0 rounded px-2 py-0.5 text-[11px] font-bold border border-white/10"
                  style={{
                    backgroundColor: preset.previewBg,
                    color: preset.style.highlightColor || '#FFD700',
                    fontFamily: `"${preset.style.fontFamily}", sans-serif`,
                  }}
                >
                  Mẫu chữ
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Accordion 1: Kiểu chữ & Màu sắc */}
      <div className="rounded-lg border border-white/[0.08] bg-[#18181b] overflow-hidden">
        <button
          type="button"
          onClick={() => setOpenSection(openSection === 'font' ? null : 'font')}
          className="flex w-full items-center justify-between px-3 py-2.5 text-xs font-semibold text-[#fafafa] hover:bg-white/[0.03] cursor-pointer"
        >
          <span>Kiểu chữ & Màu sắc</span>
          {openSection === 'font' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {openSection === 'font' && (
          <div className="space-y-3 border-t border-white/[0.08] p-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] text-[#a1a1aa]">Phông chữ</label>
                <select
                  value={style.fontFamily}
                  onChange={(e) => updateSubtitleStyle({ fontFamily: e.target.value })}
                  className="h-8 w-full rounded-md border border-white/[0.1] bg-[#09090b] px-2 text-xs text-white"
                >
                  {BUNDLED_SUBTITLE_FONTS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-[#a1a1aa]">Độ đậm</label>
                <select
                  value={style.fontWeight}
                  onChange={(e) =>
                    updateSubtitleStyle({
                      fontWeight: e.target.value as ISubtitleStyle['fontWeight'],
                    })
                  }
                  className="h-8 w-full rounded-md border border-white/[0.1] bg-[#09090b] px-2 text-xs text-white"
                >
                  <option value="normal">Thường (Regular)</option>
                  <option value="bold">Đậm (Bold)</option>
                  <option value="black">Siêu đậm (Black)</option>
                </select>
              </div>
            </div>

            <Slider
              label="Cỡ chữ (chuẩn 1080p)"
              min={32}
              max={96}
              step={2}
              defaultResetValue={64}
              value={style.fontSize}
              valueDisplay={`${style.fontSize}px`}
              onChange={(val) => updateSubtitleStyle({ fontSize: val })}
            />

            <div className="grid grid-cols-3 gap-2">
              <label className="space-y-1 text-[11px] text-[#a1a1aa]">
                <span>Chữ gốc</span>
                <div className="flex items-center gap-1.5 rounded-md border border-white/[0.1] bg-[#09090b] p-1">
                  <input
                    type="color"
                    value={style.primaryColor}
                    onChange={(e) => updateSubtitleStyle({ primaryColor: e.target.value })}
                    className="h-5 w-6 rounded cursor-pointer bg-transparent border-0"
                  />
                  <span className="font-mono text-[10px] text-white uppercase truncate">
                    {style.primaryColor}
                  </span>
                </div>
              </label>

              <label className="space-y-1 text-[11px] text-[#a1a1aa]">
                <span>Quét Karaoke</span>
                <div className="flex items-center gap-1.5 rounded-md border border-white/[0.1] bg-[#09090b] p-1">
                  <input
                    type="color"
                    value={style.highlightColor}
                    onChange={(e) => updateSubtitleStyle({ highlightColor: e.target.value })}
                    className="h-5 w-6 rounded cursor-pointer bg-transparent border-0"
                  />
                  <span className="font-mono text-[10px] text-white uppercase truncate">
                    {style.highlightColor}
                  </span>
                </div>
              </label>

              <label className="space-y-1 text-[11px] text-[#a1a1aa]">
                <span>Viền chữ</span>
                <div className="flex items-center gap-1.5 rounded-md border border-white/[0.1] bg-[#09090b] p-1">
                  <input
                    type="color"
                    value={style.outlineColor}
                    onChange={(e) => updateSubtitleStyle({ outlineColor: e.target.value })}
                    className="h-5 w-6 rounded cursor-pointer bg-transparent border-0"
                  />
                  <span className="font-mono text-[10px] text-white uppercase truncate">
                    {style.outlineColor}
                  </span>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-[#d4d4d8]">Tô màu từng từ khi đọc tới</span>
              <Switch
                checked={style.highlightEnabled}
                onCheckedChange={(val) => updateSubtitleStyle({ highlightEnabled: val })}
                ariaLabel="Bật tô màu karaoke"
              />
            </div>

            <Slider
              label="Độ dày viền"
              min={0}
              max={10}
              step={1}
              defaultResetValue={4}
              value={style.outlineWidth}
              valueDisplay={`${style.outlineWidth}px`}
              onChange={(val) => updateSubtitleStyle({ outlineWidth: val })}
            />
          </div>
        )}
      </div>

      {/* Accordion 2: Bố cục & Hiệu ứng */}
      <div className="rounded-lg border border-white/[0.08] bg-[#18181b] overflow-hidden">
        <button
          type="button"
          onClick={() => setOpenSection(openSection === 'layout' ? null : 'layout')}
          className="flex w-full items-center justify-between px-3 py-2.5 text-xs font-semibold text-[#fafafa] hover:bg-white/[0.03] cursor-pointer"
        >
          <span>Bố cục & Hiệu ứng</span>
          {openSection === 'layout' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {openSection === 'layout' && (
          <div className="space-y-3 border-t border-white/[0.08] p-3">
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { value: 'top', label: 'Phía trên' },
                  { value: 'center', label: 'Chính giữa' },
                  { value: 'bottom', label: 'Phía dưới' },
                ] as const
              ).map((pos) => (
                <button
                  key={pos.value}
                  type="button"
                  onClick={() => updateSubtitleStyle({ position: pos.value })}
                  className={`rounded-md border py-1.5 text-[11px] font-medium cursor-pointer ${
                    style.position === pos.value
                      ? 'border-[#f97316]/60 bg-[#f97316]/15 text-[#fb923c]'
                      : 'border-white/[0.08] bg-[#09090b] text-[#a1a1aa] hover:text-white'
                  }`}
                >
                  {pos.label}
                </button>
              ))}
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-[#a1a1aa]">Hiệu ứng xuất hiện</label>
              <select
                value={style.animation}
                onChange={(e) =>
                  updateSubtitleStyle({
                    animation: e.target.value as ISubtitleStyle['animation'],
                  })
                }
                className="h-8 w-full rounded-md border border-white/[0.1] bg-[#09090b] px-2 text-xs text-white"
              >
                <option value="none">Mặc định (Hiện rõ ngay)</option>
                <option value="fade">Mờ dần mượt mà (Fade)</option>
                <option value="bounce">Nhún nảy nhẹ (Bounce)</option>
                <option value="typewriter">Hiện từng chữ (Typewriter)</option>
              </select>
            </div>

            <Slider
              label="Khoảng cách lề trên/dưới"
              min={40}
              max={380}
              step={10}
              defaultResetValue={140}
              value={style.marginBottom}
              valueDisplay={`${style.marginBottom}px`}
              onChange={(val) => updateSubtitleStyle({ marginBottom: val })}
            />

            <Slider
              label="Số từ mỗi lần hiển thị"
              min={1}
              max={6}
              step={1}
              defaultResetValue={3}
              value={style.wordsPerGroup}
              valueDisplay={`${style.wordsPerGroup} từ`}
              onChange={(val) => updateSubtitleStyle({ wordsPerGroup: val })}
            />

            <Slider
              label="Giới hạn ký tự mỗi dòng"
              min={12}
              max={40}
              step={1}
              defaultResetValue={25}
              value={style.maxCharsPerLine}
              valueDisplay={`${style.maxCharsPerLine} ký tự`}
              onChange={(val) => updateSubtitleStyle({ maxCharsPerLine: val })}
            />
          </div>
        )}
      </div>

      {/* Accordion 3: Interactive Transcript */}
      <div className="rounded-lg border border-white/[0.08] bg-[#18181b] overflow-hidden">
        <button
          type="button"
          onClick={() => setOpenSection(openSection === 'transcript' ? null : 'transcript')}
          className="flex w-full items-center justify-between px-3 py-2.5 text-xs font-semibold text-[#fafafa] hover:bg-white/[0.03] cursor-pointer"
        >
          <span>Sửa chính tả từng từ ({words.length} từ)</span>
          {openSection === 'transcript' ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>

        {openSection === 'transcript' && (
          <div className="border-t border-white/[0.08] p-3 space-y-2">
            {words.length === 0 ? (
              <p className="text-[11px] text-[#9ca3af] text-center py-3">
                Hãy tạo giọng đọc ở bước 2 để có mốc thời gian phụ đề.
              </p>
            ) : (
              <>
                <p className="text-[10px] text-[#9ca3af]">
                  Bấm vào từ để tua nhanh video tới giây đó, hoặc bấm biểu tượng bút để sửa chữ mà không cần tạo lại giọng đọc.
                </p>
                <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {words.map((w, idx) => {
                    const isCurrent =
                      currentTime * 1000 >= w.start && currentTime * 1000 <= w.end + 80;
                    if (editingWordIdx === idx) {
                      return (
                        <Input
                          key={`${idx}_${w.start}`}
                          value={editingWordText}
                          onChange={(e) => setEditingWordText(e.target.value)}
                          onBlur={() => commitWordEdit(idx)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitWordEdit(idx);
                            if (e.key === 'Escape') setEditingWordIdx(null);
                          }}
                          autoFocus
                          className="h-6 w-24 px-1.5 text-[11px]"
                        />
                      );
                    }
                    return (
                      <span
                        key={`${idx}_${w.start}`}
                        className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] transition-colors ${
                          isCurrent
                            ? 'border-[#f97316] bg-[#f97316]/20 text-[#fed7aa]'
                            : 'border-white/[0.08] bg-[#09090b] text-[#d4d4d8]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => seekTo(w.start / 1000)}
                          className="cursor-pointer hover:text-white"
                          title="Tua tới từ này"
                        >
                          {w.word}
                        </button>
                        <button
                          type="button"
                          aria-label={`Sửa từ ${w.word}`}
                          onClick={() => {
                            setEditingWordIdx(idx);
                            setEditingWordText(w.word);
                          }}
                          className="text-[#9ca3af] hover:text-[#f97316] cursor-pointer"
                        >
                          <Pencil className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          onClick={handleSaveSubtitleFile}
          disabled={savingSub}
          variant="accent"
          className="flex-1 gap-1.5"
        >
          {savingSub ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          <span>{savingSub ? 'Đang lưu phụ đề...' : 'Lưu cấu hình phụ đề'}</span>
        </Button>
        <Button onClick={() => setActiveTab('music')} variant="outline" className="gap-1.5">
          <Captions className="h-3.5 w-3.5" />
          <span>Bước tiếp</span>
        </Button>
      </div>
    </div>
  );
}
