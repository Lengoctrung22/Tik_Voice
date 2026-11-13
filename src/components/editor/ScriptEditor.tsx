'use client';

import React, { useMemo, useRef, useState } from 'react';
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  ImagePlus,
  X,
  Wand2,
  AlertTriangle,
  Film,
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  Volume2,
  Loader2,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { useEditorStore } from '@/stores/editorStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { SCRIPT_TEMPLATE_LIST } from '@/lib/ai/templates';
import { formatDuration } from '@/lib/utils';
import { MAX_IMAGE_UPLOAD_BYTES, MAX_VIDEO_UPLOAD_BYTES } from '@/lib/validation/schemas';
import type { ProjectDTO, VideoAspectMode } from '@/types';

export function ScriptEditor() {
  const { project, updateProjectPartial, setActiveTab } = useEditorStore();

  const [aiOpen, setAiOpen] = useState(!project?.script?.text?.trim());
  const [generatingAi, setGeneratingAi] = useState(false);
  const [generatingHooks, setGeneratingHooks] = useState(false);
  const [uploadingClip, setUploadingClip] = useState(false);

  const [productImagePreview, setProductImagePreview] = useState<string>('');
  const [productImageBase64, setProductImageBase64] = useState<string>('');
  const [productImageMimeType, setProductImageMimeType] = useState<string>('');

  const imageInputRef = useRef<HTMLInputElement>(null);
  const clipInputRef = useRef<HTMLInputElement>(null);

  const scriptText = project?.script?.text || '';
  const productName = project?.script?.productName || '';
  const productInfo = project?.script?.productInfo || '';
  const templateId = project?.script?.templateId || 'quick_review';
  const customInstructions = project?.script?.customInstructions || '';
  const hookVariants = project?.script?.hookVariants || [];

  const wordCount = useMemo(() => {
    const trimmed = scriptText.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }, [scriptText]);

  const estimatedSpeechSec = useMemo(() => {
    if (wordCount === 0) return 0;
    const speed = project?.tts?.speed || 1.0;
    return Math.round(wordCount / (3.2 * speed));
  }, [project?.tts?.speed, wordCount]);

  const videoDuration = project?.video?.duration || 0;
  const isDesynced = Boolean(
    project?.tts?.audioPath &&
      !project?.tts?.isCustomAudio &&
      project?.tts?.sourceText &&
      scriptText.trim() &&
      project.tts.sourceText.trim() !== scriptText.trim()
  );

  const clips = useMemo(() => {
    if (project?.video?.clips && project.video.clips.length > 0) {
      return project.video.clips;
    }
    if (project?.video?.path) {
      return [
        {
          path: project.video.path,
          fileName: project.video.fileName,
          duration: project.video.duration,
          width: project.video.width,
          height: project.video.height,
          fileSize: project.video.fileSize,
          hasAudio: project.video.hasAudio,
        },
      ];
    }
    return [];
  }, [project?.video]);

  const handleSelectProductImage = (file: File) => {
    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      toast.error('Ảnh sản phẩm quá lớn (tối đa 15MB).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      if (commaIdx > 0) {
        setProductImagePreview(result);
        setProductImageBase64(result.slice(commaIdx + 1));
        setProductImageMimeType(file.type || 'image/jpeg');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateScript = async () => {
    if (!project?._id) return;
    if (!productName.trim()) {
      toast.error('Vui lòng nhập tên sản phẩm để AI viết kịch bản.');
      return;
    }

    setGeneratingAi(true);
    try {
      const res = await fetch(`/api/projects/${project._id}/script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: productName.trim(),
          productInfo,
          templateId,
          customInstructions,
          generateWithAI: true,
          ...(productImageBase64
            ? {
                productImageBase64,
                productImageMimeType,
              }
            : {}),
        }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: { text?: string; project?: ProjectDTO };
        error?: string;
      };
      if (!res.ok || !json.success || !json.data) {
        toast.error(json.error || 'AI không tạo được kịch bản');
        return;
      }
      if (json.data.project) {
        updateProjectPartial(json.data.project, false);
      } else if (json.data.text) {
        updateProjectPartial({ script: { ...project.script, text: json.data.text } }, false);
      }
      toast.success('Đã tạo kịch bản lồng tiếng thành công');
    } catch {
      toast.error('Lỗi kết nối khi gọi Gemini AI');
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleGenerateHooks = async () => {
    if (!project?._id) return;
    if (!productName.trim() && !project.name?.trim()) {
      toast.error('Vui lòng nhập tên sản phẩm trước.');
      return;
    }
    setGeneratingHooks(true);
    try {
      const res = await fetch(`/api/projects/${project._id}/marketing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'hooks',
          productName: productName.trim() || project.name,
          productInfo,
          scriptText,
        }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: { hookVariants?: string[]; project?: ProjectDTO };
        error?: string;
      };
      if (!res.ok || !json.success || !json.data) {
        toast.error(json.error || 'Không thể gợi ý câu mở đầu');
        return;
      }
      if (json.data.project) {
        updateProjectPartial(json.data.project, false);
      } else {
        updateProjectPartial(
          { script: { ...project.script, text: scriptText, hookVariants: json.data.hookVariants || [] } },
          false
        );
      }
      toast.success('Đã gợi ý 3 câu mở đầu (Hook) giữ chân người xem');
    } catch {
      toast.error('Lỗi kết nối khi tạo câu mở đầu');
    } finally {
      setGeneratingHooks(false);
    }
  };

  const applyHookToScript = (hook: string) => {
    const cleanHook = hook.trim();
    if (!cleanHook) return;
    const trimmedScript = scriptText.trim();
    if (!trimmedScript) {
      updateProjectPartial({ script: { ...project?.script, text: cleanHook } });
      return;
    }
    const paragraphs = trimmedScript.split(/\n+/);
    paragraphs[0] = cleanHook;
    updateProjectPartial({
      script: { ...project?.script, text: paragraphs.join('\n\n') },
    });
    toast.success('Đã thay thế câu mở đầu vào kịch bản');
  };

  const handleAddBrollClip = async (file: File) => {
    if (!project?._id) return;
    if (clips.length >= 5) {
      toast.error('Tối đa 5 clip B-roll cho mỗi video.');
      return;
    }
    if (file.size > MAX_VIDEO_UPLOAD_BYTES) {
      toast.error('Video clip vượt quá 500MB.');
      return;
    }

    setUploadingClip(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', 'clip');
      fd.append('projectId', project._id);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = (await res.json()) as {
        success: boolean;
        data?: { project?: ProjectDTO };
        error?: string;
      };
      if (!res.ok || !json.success || !json.data?.project) {
        toast.error(json.error || 'Thêm clip B-roll thất bại');
        return;
      }
      updateProjectPartial(json.data.project, false);
      toast.success('Đã thêm clip B-roll mới');
    } catch {
      toast.error('Lỗi kết nối khi tải clip');
    } finally {
      setUploadingClip(false);
    }
  };

  const reorderClip = (idx: number, dir: -1 | 1) => {
    if (!project?.video) return;
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= clips.length) return;
    const nextClips = [...clips];
    const [moved] = nextClips.splice(idx, 1);
    nextClips.splice(nextIdx, 0, moved);
    const totalDur = nextClips.reduce((s, c) => s + (c.duration || 0), 0);
    updateProjectPartial({
      video: {
        ...project.video,
        clips: nextClips,
        duration: Math.round(totalDur * 100) / 100,
      },
    });
  };

  const removeClip = (idx: number) => {
    if (!project?.video || clips.length <= 1) return;
    const nextClips = clips.filter((_, i) => i !== idx);
    const totalDur = nextClips.reduce((s, c) => s + (c.duration || 0), 0);
    updateProjectPartial({
      video: {
        ...project.video,
        clips: nextClips,
        duration: Math.round(totalDur * 100) / 100,
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-[#fafafa]">1. Kịch bản & Video nguồn</h2>
          <p className="text-[11px] text-[#9ca3af]">
            Tạo kịch bản tự nhiên hoặc chỉnh trực tiếp lời thoại
          </p>
        </div>
      </div>

      {/* Collapsible AI Script Assistant */}
      <div className="rounded-lg border border-white/[0.08] bg-[#18181b] overflow-hidden">
        <button
          type="button"
          onClick={() => setAiOpen(!aiOpen)}
          className="flex w-full items-center justify-between px-3 py-2.5 text-left text-xs font-semibold text-[#fafafa] hover:bg-white/[0.03] cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-[#f97316]" />
            <span>Trợ lý AI viết kịch bản</span>
          </span>
          {aiOpen ? (
            <ChevronUp className="h-4 w-4 text-[#9ca3af]" />
          ) : (
            <ChevronDown className="h-4 w-4 text-[#9ca3af]" />
          )}
        </button>

        {aiOpen && (
          <div className="space-y-3 border-t border-white/[0.08] p-3">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[#d4d4d8]">Tên sản phẩm</label>
              <Input
                value={productName}
                onChange={(e) =>
                  updateProjectPartial({
                    script: { ...project?.script, text: scriptText, productName: e.target.value },
                  })
                }
                placeholder="VD: Serum dưỡng ẩm B5 phục hồi da"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[#d4d4d8]">
                Điểm nổi bật / Ưu đãi / Giá bán
              </label>
              <Textarea
                rows={2}
                value={productInfo}
                onChange={(e) =>
                  updateProjectPartial({
                    script: { ...project?.script, text: scriptText, productInfo: e.target.value },
                  })
                }
                placeholder="VD: Thấm nhanh 3 giây, giá 199k, mua 1 tặng 1 hôm nay..."
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-[#d4d4d8]">Phong cách kịch bản</label>
              <div className="grid grid-cols-2 gap-1.5">
                {SCRIPT_TEMPLATE_LIST.map((tpl) => {
                  const selected = templateId === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() =>
                        updateProjectPartial({
                          script: { ...project?.script, text: scriptText, templateId: tpl.id },
                        })
                      }
                      className={`rounded-md border px-2.5 py-1.5 text-left transition-colors cursor-pointer ${
                        selected
                          ? 'border-[#f97316]/60 bg-[#f97316]/12 text-[#fafafa]'
                          : 'border-white/[0.08] bg-[#09090b] text-[#a1a1aa] hover:border-white/[0.18]'
                      }`}
                    >
                      <div className="text-[11px] font-semibold truncate">{tpl.name}</div>
                      <div className="text-[10px] text-[#9ca3af] truncate">{tpl.estimatedDuration}s | tối đa {tpl.maxWords} từ</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[#d4d4d8]">
                Ghi chú riêng cho AI (tuỳ chọn)
              </label>
              <Input
                value={customInstructions}
                onChange={(e) =>
                  updateProjectPartial({
                    script: {
                      ...project?.script,
                      text: scriptText,
                      customInstructions: e.target.value,
                    },
                  })
                }
                placeholder="VD: Giọng xưng mình - bạn, tập trung cho da nhạy cảm"
              />
            </div>

            {/* Multimodal Product Image */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-[#d4d4d8]">
                  Ảnh nhãn sản phẩm (AI tự đọc thông số)
                </label>
                {productImagePreview && (
                  <button
                    type="button"
                    onClick={() => {
                      setProductImagePreview('');
                      setProductImageBase64('');
                      setProductImageMimeType('');
                    }}
                    className="inline-flex items-center gap-0.5 text-[10px] text-red-400 hover:underline cursor-pointer"
                  >
                    <X className="h-3 w-3" /> Bỏ ảnh
                  </button>
                )}
              </div>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleSelectProductImage(f);
                  e.target.value = '';
                }}
              />
              {productImagePreview ? (
                <div className="flex items-center gap-2.5 rounded-md border border-white/[0.08] bg-[#09090b] p-2">
                  <img
                    src={productImagePreview}
                    alt="Ảnh sản phẩm đính kèm"
                    className="h-12 w-12 rounded object-cover border border-white/[0.1]"
                  />
                  <div className="text-[11px] text-[#a1a1aa]">
                    AI sẽ đọc thông tin trên bao bì để viết chính xác hơn.
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-white/[0.14] bg-[#09090b] py-2 text-[11px] text-[#a1a1aa] hover:border-white/[0.25] hover:text-white cursor-pointer"
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                  <span>Đính kèm ảnh sản phẩm / bảng thành phần</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button
                onClick={handleGenerateScript}
                disabled={generatingAi}
                className="flex-1 gap-1.5"
              >
                {generatingAi ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Wand2 className="h-3.5 w-3.5" />
                )}
                <span>{generatingAi ? 'Đang viết kịch bản...' : 'Tạo kịch bản bằng AI'}</span>
              </Button>
              <Button
                variant="outline"
                onClick={handleGenerateHooks}
                disabled={generatingHooks}
                title="Gợi ý 3 câu mở đầu thu hút 3 giây đầu"
                className="gap-1.5"
              >
                {generatingHooks ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 text-[#f97316]" />
                )}
                <span>3 Hook A/B</span>
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* 3 Hook A/B Selector */}
      {hookVariants.length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-white/[0.08] bg-[#18181b] p-3">
          <div className="text-[11px] font-semibold text-[#fafafa]">
            Gợi ý câu mở đầu (chọn để thay câu đầu tiên):
          </div>
          <div className="space-y-1.5">
            {hookVariants.map((hook, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => applyHookToScript(hook)}
                className="w-full rounded-md border border-white/[0.08] bg-[#09090b] px-2.5 py-2 text-left text-[11px] text-[#d4d4d8] hover:border-[#f97316]/50 hover:text-white transition-colors cursor-pointer"
              >
                <span className="font-semibold text-[#f97316] mr-1.5">Hook {idx + 1}:</span>
                {hook}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Desync warning */}
      {isDesynced && (
        <div className="flex items-start justify-between gap-2.5 rounded-lg border border-amber-500/35 bg-amber-500/10 p-3">
          <div className="flex items-start gap-2 text-[11px] text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
            <span>
              Kịch bản đã thay đổi so với file giọng đọc hiện tại. Hãy tạo lại giọng đọc để khớp âm thanh và phụ đề.
            </span>
          </div>
          <Button
            size="sm"
            variant="accent"
            onClick={() => setActiveTab('voice')}
            className="shrink-0"
          >
            Tạo lại giọng
          </Button>
        </div>
      )}

      {/* Script Textarea + metrics */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-[#fafafa]">Lời thoại lồng tiếng</span>
          <span className="font-mono text-[#a1a1aa] tabular-nums">
            {wordCount} từ | ~{estimatedSpeechSec}s đọc
          </span>
        </div>

        <Textarea
          rows={7}
          value={scriptText}
          onChange={(e) =>
            updateProjectPartial({
              script: { ...project?.script, text: e.target.value },
            })
          }
          placeholder="Nhập hoặc dán lời thoại review sản phẩm tại đây. Không cần chèn emoji để giọng AI đọc tự nhiên nhất."
          className="text-xs leading-relaxed"
        />

        {videoDuration > 0 && estimatedSpeechSec > 0 && (
          <div className="flex items-center justify-between rounded-md bg-[#18181b] border border-white/[0.06] px-2.5 py-1.5 text-[11px] text-[#a1a1aa]">
            <span>Video gốc: {formatDuration(videoDuration)}</span>
            <span className="font-medium text-[#d4d4d8]">
              {estimatedSpeechSec > videoDuration
                ? `Video sẽ tự lặp ${Math.ceil(estimatedSpeechSec / videoDuration)} lần để khớp lời đọc`
                : 'Độ dài vừa khớp video gốc'}
            </span>
          </div>
        )}
      </div>

      {/* Video Framing, Original Volume & Multi-clip B-roll */}
      <div className="space-y-3 rounded-lg border border-white/[0.08] bg-[#18181b] p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#fafafa] flex items-center gap-1.5">
            <Film className="h-3.5 w-3.5 text-[#f97316]" />
            <span>Khung hình & Ghép clip (B-roll)</span>
          </span>
          <span className="text-[10px] text-[#9ca3af]">{clips.length}/5 clip</span>
        </div>

        {/* Aspect Mode */}
        <div className="space-y-1.5">
          <label className="text-[11px] text-[#a1a1aa]">Chế độ khung dọc 9:16</label>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { value: 'contain', label: 'Vừa khung' },
                { value: 'blur', label: 'Nền mờ' },
                { value: 'cover', label: 'Lấp đầy' },
              ] as Array<{ value: VideoAspectMode; label: string }>
            ).map((opt) => {
              const active = (project?.video?.aspectMode || 'contain') === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    project?.video &&
                    updateProjectPartial({
                      video: { ...project.video, aspectMode: opt.value },
                    })
                  }
                  className={`flex items-center justify-center gap-1 rounded-md border py-1.5 text-[11px] font-medium cursor-pointer ${
                    active
                      ? 'border-[#f97316]/60 bg-[#f97316]/15 text-[#fb923c]'
                      : 'border-white/[0.08] bg-[#09090b] text-[#a1a1aa] hover:text-white'
                  }`}
                >
                  {active && <Check className="h-3 w-3" />}
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Original Video Volume */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] text-[#a1a1aa]">
            <Volume2 className="h-3.5 w-3.5" />
            <span>Âm lượng gốc của video</span>
            {project?.video && project.video.hasAudio === false && (
              <span className="text-[10px] text-amber-400">(Video không có tiếng)</span>
            )}
          </div>
          <Slider
            min={0}
            max={100}
            step={5}
            defaultResetValue={0}
            disabled={project?.video?.hasAudio === false}
            value={Math.round((project?.video?.originalVolume ?? 0) * 100)}
            valueDisplay={`${Math.round((project?.video?.originalVolume ?? 0) * 100)}%`}
            onChange={(val) =>
              project?.video &&
              updateProjectPartial({
                video: { ...project.video, originalVolume: val / 100 },
              })
            }
          />
        </div>

        {/* Multi-clip list */}
        <div className="space-y-1.5 pt-1 border-t border-white/[0.06]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[#a1a1aa]">Danh sách clip ghép nối</span>
            <input
              ref={clipInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm,.m4v"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleAddBrollClip(f);
                e.target.value = '';
              }}
            />
            {clips.length < 5 && (
              <Button
                size="sm"
                variant="outline"
                disabled={uploadingClip}
                onClick={() => clipInputRef.current?.click()}
                className="h-7 px-2 gap-1 text-[10px]"
              >
                {uploadingClip ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Plus className="h-3 w-3" />
                )}
                <span>Thêm clip B-roll</span>
              </Button>
            )}
          </div>

          {clips.length > 0 && (
            <div className="space-y-1">
              {clips.map((c, idx) => (
                <div
                  key={`${c.path}_${idx}`}
                  className="flex items-center justify-between gap-2 rounded-md border border-white/[0.06] bg-[#09090b] px-2.5 py-1.5 text-[11px]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-[#fafafa]">
                      {idx + 1}. {c.fileName}
                    </div>
                    <div className="font-mono text-[10px] text-[#9ca3af] tabular-nums">
                      {formatDuration(c.duration)} | {c.width}×{c.height}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => reorderClip(idx, -1)}
                      aria-label="Đưa clip lên"
                      className="rounded p-1 text-[#a1a1aa] hover:bg-white/[0.06] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === clips.length - 1}
                      onClick={() => reorderClip(idx, 1)}
                      aria-label="Đưa clip xuống"
                      className="rounded p-1 text-[#a1a1aa] hover:bg-white/[0.06] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                    {clips.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeClip(idx)}
                        aria-label="Xóa clip này"
                        className="rounded p-1 text-[#9ca3af] hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Button
        onClick={() => setActiveTab('voice')}
        className="w-full"
      >
        Tiếp tục chọn giọng đọc
      </Button>
    </div>
  );
}
