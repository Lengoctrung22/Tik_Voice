'use client';

import React, { useRef, useState } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Download,
  Trash2,
  Check,
  Sparkles,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Film,
} from 'lucide-react';
import { toast } from 'sonner';
import { useBatchStore, type CsvBatchRow } from '@/stores/batchStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { SUPPORTED_VOICES } from '@/lib/tts/voices';
import { SCRIPT_TEMPLATE_LIST } from '@/lib/ai/templates';
import { DEFAULT_SUBTITLE_STYLE, SUBTITLE_PRESETS } from '@/lib/video/subtitle-presets';
import { PRESET_MUSIC_TRACKS } from '@/lib/video/music-presets';
import { formatFileSize } from '@/lib/utils';
import { MAX_VIDEO_UPLOAD_BYTES } from '@/lib/validation/schemas';
import type {
  ExportResolution,
  IPopulatedBatchGroup,
  ProjectDTO,
  VideoAspectMode,
} from '@/types';

interface BatchUploaderProps {
  onBatchCreated: (batch: IPopulatedBatchGroup) => void;
}

function parseCsvText(csvText: string): CsvBatchRow[] {
  const lines: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    if (ch === '"') {
      if (inQuotes && csvText[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && csvText[i + 1] === '\n') i++;
      if (current.trim()) lines.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) lines.push(current);

  const splitRow = (line: string): string[] => {
    const cells: string[] = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = !quoted;
        }
      } else if (ch === ',' && !quoted) {
        cells.push(cell.trim());
        cell = '';
      } else {
        cell += ch;
      }
    }
    cells.push(cell.trim());
    return cells;
  };

  if (lines.length === 0) return [];
  const rows = lines.map(splitRow);
  const firstHeader = (rows[0]?.[0] || '').toLowerCase();
  const hasHeader =
    firstHeader.includes('product') ||
    firstHeader.includes('ten') ||
    firstHeader.includes('tên') ||
    firstHeader.includes('sản phẩm');

  const dataRows = hasHeader ? rows.slice(1) : rows;
  return dataRows
    .filter((cols) => cols.some((c) => c.length > 0))
    .map((cols) => ({
      productName: cols[0] || '',
      productInfo: cols[1] || '',
      scriptText: cols[2] || '',
    }));
}

export function BatchUploader({ onBatchCreated }: BatchUploaderProps) {
  const {
    items,
    batchName,
    sharedConfig,
    isSubmitting,
    addFiles,
    removeItem,
    updateItem,
    applyCsvRows,
    setBatchName,
    updateSharedConfig,
    setIsSubmitting,
    resetBatchForm,
  } = useBatchStore();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [dragging, setDragging] = useState(false);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const handleSelectVideos = (files: FileList | File[]) => {
    const valid = Array.from(files).filter((f) => {
      if (f.size <= 0 || f.size > MAX_VIDEO_UPLOAD_BYTES) return false;
      const ext = f.name.toLowerCase();
      return (
        f.type.startsWith('video/') ||
        ext.endsWith('.mp4') ||
        ext.endsWith('.mov') ||
        ext.endsWith('.webm') ||
        ext.endsWith('.m4v')
      );
    });
    if (valid.length === 0) {
      toast.error('Không có video hợp lệ (hỗ trợ MP4, MOV, WebM dưới 500MB).');
      return;
    }
    addFiles(valid);
    toast.success(`Đã thêm ${valid.length} video vào lô`);
  };

  const handleImportCsv = async (file: File) => {
    const text = await file.text();
    const rows = parseCsvText(text);
    if (rows.length === 0) {
      toast.error('Tệp CSV không có dòng dữ liệu hợp lệ.');
      return;
    }
    const applied = applyCsvRows(rows);
    toast.success(
      applied > 0
        ? `Đã điền thông tin từ CSV cho ${applied} video`
        : 'Hãy tải video lên trước rồi nhập CSV để ghép theo thứ tự'
    );
  };

  const handleDownloadSampleCsv = () => {
    const sample =
      '\uFEFFproductName,productInfo,scriptText\n' +
      '"Serum B5 Phục Hồi","Thấm nhanh 3s, giảm đỏ rát, giá 199k",""\n' +
      '"Kem Chống Nắng SPF50","Kiềm dầu 8 tiếng, không nâng tông lố","Da dầu dùng thử em kem chống nắng này đảm bảo mê ngay!"\n';
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tikvoice-batch-mau.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmitBatch = async () => {
    if (items.length === 0) {
      toast.error('Vui lòng thêm ít nhất 1 video vào lô.');
      setStep(1);
      return;
    }

    setIsSubmitting(true);
    const createdProjectIds: string[] = [];

    try {
      for (const item of items) {
        updateItem(item.id, { status: 'uploading', error: undefined });

        const fd = new FormData();
        fd.append('file', item.file);
        fd.append('type', 'video');

        const upRes = await fetch('/api/upload', { method: 'POST', body: fd });
        const upJson = (await upRes.json()) as {
          success: boolean;
          data?: { project?: ProjectDTO };
          error?: string;
        };

        if (!upRes.ok || !upJson.success || !upJson.data?.project?._id) {
          updateItem(item.id, {
            status: 'error',
            error: upJson.error || 'Tải video thất bại',
          });
          continue;
        }

        const projectId = upJson.data.project._id;

        // Cập nhật cấu hình sản phẩm + cấu hình chung theo đúng Zod allowlist
        const patchPayload = {
          name: item.productName.trim() || item.file.name.replace(/\.[^/.]+$/, ''),
          video: {
            aspectMode: sharedConfig.aspectMode,
          },
          script: {
            text: item.scriptText.trim(),
            templateId: sharedConfig.templateId,
            productName: item.productName.trim(),
            productInfo: item.productInfo.trim(),
          },
          tts: {
            engine: sharedConfig.engine,
            voice: sharedConfig.voice,
            speed: sharedConfig.speed,
            pitch: sharedConfig.pitch,
          },
          subtitle: {
            enabled: sharedConfig.subtitleEnabled,
            style: sharedConfig.subtitleStyle,
          },
          bgMusic: sharedConfig.bgMusic
            ? {
                path: sharedConfig.bgMusic.path,
                name: sharedConfig.bgMusic.name,
                volume: sharedConfig.bgMusic.volume,
                fadeIn: sharedConfig.bgMusic.fadeIn ?? 2,
                fadeOut: sharedConfig.bgMusic.fadeOut ?? 3,
                ducking: sharedConfig.bgMusic.ducking ?? true,
              }
            : null,
          export: {
            resolution: sharedConfig.resolution,
            quality: sharedConfig.quality,
          },
        };

        const patchRes = await fetch(`/api/projects/${projectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patchPayload),
        });

        if (!patchRes.ok) {
          updateItem(item.id, {
            status: 'error',
            error: 'Lỗi lưu cấu hình dự án',
          });
          continue;
        }

        createdProjectIds.push(projectId);
        updateItem(item.id, { status: 'done', projectId });
      }

      if (createdProjectIds.length === 0) {
        toast.error('Không có video nào tải lên thành công.');
        return;
      }

      const createRes = await fetch('/api/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: batchName.trim() || `Lô video ${new Date().toLocaleDateString('vi-VN')}`,
          projectIds: createdProjectIds,
          sharedConfig,
        }),
      });
      const createJson = (await createRes.json()) as {
        success: boolean;
        data?: { _id: string };
        error?: string;
      };

      if (!createRes.ok || !createJson.success || !createJson.data?._id) {
        toast.error(createJson.error || 'Tạo lô xử lý thất bại');
        return;
      }

      const startRes = await fetch(`/api/batch/${createJson.data._id}`, {
        method: 'POST',
      });
      const startJson = (await startRes.json()) as {
        success: boolean;
        data?: IPopulatedBatchGroup;
        message?: string;
        error?: string;
      };

      if (!startRes.ok || !startJson.success || !startJson.data) {
        toast.error(startJson.error || 'Không thể đưa lô vào hàng đợi xử lý');
        return;
      }

      toast.success(startJson.message || 'Đã bắt đầu xử lý hàng loạt trên Worker!');
      resetBatchForm();
      setStep(1);
      onBatchCreated(startJson.data);
    } catch {
      toast.error('Lỗi kết nối trong quá trình khởi chạy lô');
    } finally {
      setIsSubmitting(false);
    }
  };

  const previewStyle = {
    ...DEFAULT_SUBTITLE_STYLE,
    ...(sharedConfig.subtitleStyle || {}),
  };

  return (
    <div className="space-y-5">
      {/* Stepper Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#111113] px-4 py-3">
        <div className="flex items-center gap-2 sm:gap-4">
          {[
            { num: 1, title: 'Chọn video & Sản phẩm' },
            { num: 2, title: 'Cấu hình chung' },
            { num: 3, title: 'Xác nhận & Chạy lô' },
          ].map((s) => {
            const active = step === s.num;
            const completed = step > s.num;
            return (
              <button
                key={s.num}
                type="button"
                onClick={() => {
                  if (s.num === 1 || items.length > 0) setStep(s.num as 1 | 2 | 3);
                }}
                className={`flex items-center gap-2 text-xs font-semibold cursor-pointer ${
                  active
                    ? 'text-[#f97316]'
                    : completed
                    ? 'text-emerald-400'
                    : 'text-[#9ca3af]'
                }`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold border ${
                    active
                      ? 'border-[#f97316] bg-[#f97316]/15 text-[#f97316]'
                      : completed
                      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                      : 'border-white/[0.1] bg-[#18181b] text-[#9ca3af]'
                  }`}
                >
                  {completed ? <Check className="h-3.5 w-3.5" /> : s.num}
                </span>
                <span className="hidden sm:inline">{s.title}</span>
              </button>
            );
          })}
        </div>

        <span className="text-xs text-[#a1a1aa] font-mono tabular-nums">
          {items.length} video đã chọn
        </span>
      </div>

      {/* Step 1: Video Upload + CSV */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
              <div className="space-y-1">
                <label className="text-xs font-medium text-[#d4d4d8]">Tên lô chiến dịch</label>
                <Input
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  placeholder="VD: Video review mỹ phẩm tuần 2"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImportCsv(f);
                    e.target.value = '';
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => csvInputRef.current?.click()}
                  disabled={items.length === 0}
                  className="gap-1.5"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Nhập từ CSV</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownloadSampleCsv}
                  className="gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Tải CSV mẫu</span>
                </Button>
              </div>
            </div>

            {/* Multi-video Dropzone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                if (e.dataTransfer.files?.length) {
                  handleSelectVideos(e.dataTransfer.files);
                }
              }}
              className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                dragging
                  ? 'border-[#f97316] bg-[#f97316]/10'
                  : 'border-white/[0.12] bg-[#09090b] hover:border-white/[0.2]'
              }`}
            >
              <input
                ref={videoInputRef}
                type="file"
                multiple
                accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm,.m4v"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) {
                    handleSelectVideos(e.target.files);
                    e.target.value = '';
                  }
                }}
              />
              <Upload className="mx-auto h-7 w-7 text-[#f97316] mb-2" />
              <p className="text-xs font-semibold text-[#fafafa]">
                Kéo thả nhiều video sản phẩm vào đây
              </p>
              <p className="mt-1 text-[11px] text-[#9ca3af]">
                Hỗ trợ MP4, MOV, WebM (tối đa 500MB/tệp)
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => videoInputRef.current?.click()}
              >
                Chọn nhiều video
              </Button>
            </div>
          </div>

          {items.length > 0 && (
            <div className="space-y-2.5">
              {items.map((item, idx) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-white/[0.08] bg-[#111113] p-3.5 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#27272a] font-mono text-[11px] font-bold text-[#fafafa]">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-[#fafafa]">
                          {item.file.name}
                        </div>
                        <div className="text-[10px] text-[#9ca3af]">
                          {formatFileSize(item.file.size)}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      aria-label={`Xóa ${item.file.name}`}
                      className="rounded p-1.5 text-[#9ca3af] hover:bg-red-500/10 hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[11px] text-[#a1a1aa]">Tên sản phẩm</label>
                      <Input
                        value={item.productName}
                        onChange={(e) =>
                          updateItem(item.id, { productName: e.target.value })
                        }
                        placeholder="Tên sản phẩm cho AI..."
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] text-[#a1a1aa]">
                        Điểm nổi bật / Ưu đãi (AI dùng viết kịch bản)
                      </label>
                      <Input
                        value={item.productInfo}
                        onChange={(e) =>
                          updateItem(item.id, { productInfo: e.target.value })
                        }
                        placeholder="VD: Giảm 30%, freeship, chất liệu cotton..."
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-[#a1a1aa]">
                      Kịch bản viết sẵn (để trống nếu muốn AI tự viết)
                    </label>
                    <Textarea
                      rows={2}
                      value={item.scriptText}
                      onChange={(e) =>
                        updateItem(item.id, { scriptText: e.target.value })
                      }
                      placeholder="Bỏ trống để Gemini AI tự động viết kịch bản theo tên và điểm nổi bật ở trên..."
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end">
            <Button
              disabled={items.length === 0}
              onClick={() => setStep(2)}
              className="gap-1.5"
            >
              <span>Tiếp tục cấu hình chung</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Shared Config + Live Preview */}
      {step === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_270px] gap-5">
          <div className="space-y-4 rounded-xl border border-white/[0.08] bg-[#111113] p-4">
            {/* Voice & AI Template */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-[#d4d4d8]">Giọng đọc mặc định</label>
                <select
                  value={sharedConfig.voice}
                  onChange={(e) => {
                    const v = SUPPORTED_VOICES.find((x) => x.id === e.target.value);
                    updateSharedConfig({
                      voice: e.target.value,
                      engine: v?.engine || 'edge',
                    });
                  }}
                  className="h-9 w-full rounded-md border border-white/[0.1] bg-[#09090b] px-2.5 text-xs text-white"
                >
                  {SUPPORTED_VOICES.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.displayName} ({v.tier === 'free' ? 'Miễn phí' : 'Cloud'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-[#d4d4d8]">Phong cách kịch bản AI</label>
                <select
                  value={sharedConfig.templateId}
                  onChange={(e) => updateSharedConfig({ templateId: e.target.value })}
                  className="h-9 w-full rounded-md border border-white/[0.1] bg-[#09090b] px-2.5 text-xs text-white"
                >
                  {SCRIPT_TEMPLATE_LIST.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Slider
                label="Tốc độ đọc"
                min={0.75}
                max={1.5}
                step={0.05}
                defaultResetValue={1.0}
                value={sharedConfig.speed}
                valueDisplay={`${sharedConfig.speed.toFixed(2)}x`}
                onChange={(val) => updateSharedConfig({ speed: val })}
              />
              <Slider
                label="Cao độ giọng"
                min={-10}
                max={10}
                step={1}
                defaultResetValue={0}
                value={sharedConfig.pitch}
                valueDisplay={`${sharedConfig.pitch} Hz`}
                onChange={(val) => updateSharedConfig({ pitch: val })}
              />
            </div>

            {/* Subtitle Preset */}
            <div className="space-y-2 border-t border-white/[0.08] pt-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#fafafa]">Kiểu phụ đề Karaoke</span>
                <Switch
                  checked={sharedConfig.subtitleEnabled}
                  onCheckedChange={(val) => updateSharedConfig({ subtitleEnabled: val })}
                  ariaLabel="Bật phụ đề cho toàn lô"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SUBTITLE_PRESETS.map((p) => {
                  const active =
                    sharedConfig.subtitleStyle?.fontFamily === p.style.fontFamily &&
                    sharedConfig.subtitleStyle?.highlightColor === p.style.highlightColor;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => updateSharedConfig({ subtitleStyle: p.style })}
                      className={`rounded-full border px-3 py-1 text-[11px] font-medium cursor-pointer ${
                        active
                          ? 'border-[#f97316] bg-[#f97316]/15 text-[#fb923c]'
                          : 'border-white/[0.08] bg-[#09090b] text-[#a1a1aa] hover:text-white'
                      }`}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Music & Aspect & Resolution */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-white/[0.08] pt-3">
              <div className="space-y-1">
                <label className="text-[11px] text-[#a1a1aa]">Nhạc nền</label>
                <select
                  value={sharedConfig.bgMusic?.path || ''}
                  onChange={(e) => {
                    const track = PRESET_MUSIC_TRACKS.find(
                      (t) => t.storagePath === e.target.value
                    );
                    updateSharedConfig({
                      bgMusic: track
                        ? {
                            path: track.storagePath,
                            name: track.name,
                            volume: sharedConfig.bgMusic?.volume ?? 0.12,
                            fadeIn: 2,
                            fadeOut: 3,
                            ducking: sharedConfig.bgMusic?.ducking ?? true,
                          }
                        : undefined,
                    });
                  }}
                  className="h-9 w-full rounded-md border border-white/[0.1] bg-[#09090b] px-2.5 text-xs text-white"
                >
                  <option value="">Không dùng nhạc nền</option>
                  {PRESET_MUSIC_TRACKS.map((t) => (
                    <option key={t.id} value={t.storagePath}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-[#a1a1aa]">Khung 9:16</label>
                <select
                  value={sharedConfig.aspectMode}
                  onChange={(e) =>
                    updateSharedConfig({
                      aspectMode: e.target.value as VideoAspectMode,
                    })
                  }
                  className="h-9 w-full rounded-md border border-white/[0.1] bg-[#09090b] px-2.5 text-xs text-white"
                >
                  <option value="contain">Vừa khung</option>
                  <option value="blur">Nền mờ tự động</option>
                  <option value="cover">Lấp đầy khung</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-[#a1a1aa]">Độ phân giải & Chất lượng</label>
                <select
                  value={`${sharedConfig.resolution}:${sharedConfig.quality}`}
                  onChange={(e) => {
                    const [res, q] = e.target.value.split(':');
                    updateSharedConfig({
                      resolution: res as ExportResolution,
                      quality: q as 'fast' | 'balanced' | 'high',
                    });
                  }}
                  className="h-9 w-full rounded-md border border-white/[0.1] bg-[#09090b] px-2.5 text-xs text-white"
                >
                  <option value="1080x1920:balanced">1080×1920 (Cân bằng)</option>
                  <option value="1080x1920:high">1080×1920 (Cao nhất)</option>
                  <option value="720x1280:fast">720×1280 (Xuất nhanh)</option>
                </select>
              </div>
            </div>

            {sharedConfig.bgMusic && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-[#d4d4d8]">
                  Tự giảm âm nhạc khi có giọng đọc
                </span>
                <Switch
                  checked={sharedConfig.bgMusic.ducking ?? true}
                  onCheckedChange={(val) =>
                    sharedConfig.bgMusic &&
                    updateSharedConfig({
                      bgMusic: { ...sharedConfig.bgMusic, ducking: val },
                    })
                  }
                  ariaLabel="Bật giảm nhạc nền khi có giọng nói"
                />
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)} className="gap-1">
                <ChevronLeft className="h-4 w-4" />
                <span>Quay lại</span>
              </Button>
              <Button onClick={() => setStep(3)} className="gap-1">
                <span>Kiểm tra & Chạy lô</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Live 9:16 Sample Preview Card */}
          <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-4 flex flex-col items-center gap-3">
            <div className="text-xs font-semibold text-[#d4d4d8]">Xem trước kiểu chữ 9:16</div>
            <div className="relative aspect-[9/16] w-full max-w-[200px] overflow-hidden rounded-xl border border-white/[0.12] bg-gradient-to-b from-zinc-800 via-zinc-900 to-black flex flex-col items-center justify-center p-3">
              <Film className="h-8 w-8 text-[#9ca3af] mb-2" />
              <span className="text-[10px] text-[#9ca3af]">
                {sharedConfig.aspectMode === 'blur'
                  ? 'Nền mờ 9:16'
                  : sharedConfig.aspectMode === 'cover'
                  ? 'Lấp đầy khung'
                  : 'Vừa khung'}
              </span>

              {sharedConfig.subtitleEnabled && (
                <div
                  className="absolute inset-x-2 text-center leading-tight"
                  style={{
                    fontFamily: `"${previewStyle.fontFamily}", sans-serif`,
                    fontSize: `${Math.max(12, Math.round((previewStyle.fontSize || 64) * 0.22))}px`,
                    fontWeight:
                      previewStyle.fontWeight === 'black'
                        ? 900
                        : previewStyle.fontWeight === 'bold'
                        ? 700
                        : 400,
                    textShadow: `0 1px 2px ${previewStyle.outlineColor || '#000000'}`,
                    ...(previewStyle.position === 'top'
                      ? { top: '14%' }
                      : previewStyle.position === 'center'
                      ? { top: '50%', transform: 'translateY(-50%)' }
                      : { bottom: '14%' }),
                  }}
                >
                  <span
                    style={{
                      color: previewStyle.highlightEnabled
                        ? previewStyle.highlightColor || '#FFD700'
                        : previewStyle.primaryColor || '#FFFFFF',
                    }}
                  >
                    Chốt đơn{' '}
                  </span>
                  <span style={{ color: previewStyle.primaryColor || '#FFFFFF' }}>
                    ngay hôm nay
                  </span>
                </div>
              )}
            </div>
            <div className="w-full space-y-1 text-[11px] text-[#a1a1aa]">
              <div className="flex justify-between">
                <span>Độ phân giải:</span>
                <span className="font-mono text-white">{sharedConfig.resolution}</span>
              </div>
              <div className="flex justify-between">
                <span>Nhạc nền:</span>
                <span className="text-white truncate max-w-[130px]">
                  {sharedConfig.bgMusic?.name || 'Không'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Summary & Submit */}
      {step === 3 && (
        <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#f97316]/15 text-[#f97316]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#fafafa]">
                Sẵn sàng xử lý tự động {items.length} video
              </h3>
              <p className="mt-1 text-xs text-[#a1a1aa] leading-relaxed">
                Hệ thống sẽ tải các video lên, sau đó Worker chạy ngầm sẽ tự động viết kịch bản (cho video chưa có lời thoại), tạo giọng đọc, khớp phụ đề và kết xuất MP4 hoàn chỉnh.
              </p>
            </div>
          </div>

          <div className="space-y-1.5 max-h-60 overflow-y-auto rounded-lg border border-white/[0.08] bg-[#09090b] p-3">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 text-xs py-1 border-b border-white/[0.05] last:border-b-0"
              >
                <span className="truncate text-[#fafafa]">
                  {idx + 1}. {item.productName || item.file.name}
                </span>
                <span className="text-[11px] shrink-0">
                  {item.status === 'uploading' ? (
                    <span className="text-[#f97316]">Đang tải lên...</span>
                  ) : item.status === 'done' ? (
                    <span className="text-emerald-400">Đã sẵn sàng</span>
                  ) : item.status === 'error' ? (
                    <span className="text-red-400">{item.error || 'Lỗi'}</span>
                  ) : item.scriptText.trim() ? (
                    <span className="text-zinc-400">Kịch bản viết sẵn</span>
                  ) : (
                    <span className="text-blue-400">AI tự viết kịch bản</span>
                  )}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <Button
              variant="outline"
              disabled={isSubmitting}
              onClick={() => setStep(2)}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Chỉnh cấu hình</span>
            </Button>

            <Button
              size="lg"
              disabled={isSubmitting}
              onClick={handleSubmitBatch}
              className="gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              <span>
                {isSubmitting ? 'Đang tải video & tạo lô...' : 'Tạo lô & Bắt đầu xử lý ngầm'}
              </span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
