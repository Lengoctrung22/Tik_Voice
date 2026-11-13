'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Music,
  Play,
  Square,
  Upload,
  VolumeX,
  Image as ImageIcon,
  Loader2,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { useEditorStore } from '@/stores/editorStore';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { PRESET_MUSIC_TRACKS } from '@/lib/video/music-presets';
import { resolveMediaUrl } from '@/lib/utils';
import { MAX_AUDIO_UPLOAD_BYTES, MAX_IMAGE_UPLOAD_BYTES } from '@/lib/validation/schemas';
import type { ProjectDTO, WatermarkPosition } from '@/types';

export function BackgroundMusicPanel() {
  const { project, updateBgMusic, updateWatermark, updateProjectPartial, setActiveTab } =
    useEditorStore();

  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [uploadingMusic, setUploadingMusic] = useState(false);
  const [uploadingWatermark, setUploadingWatermark] = useState(false);
  const [watermarkOpen, setWatermarkOpen] = useState(Boolean(project?.watermark?.enabled));

  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);
  const wmInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
        audioPreviewRef.current = null;
      }
    };
  }, []);

  const stopPreview = () => {
    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
      audioPreviewRef.current = null;
    }
    setPlayingTrackId(null);
  };

  const togglePreviewTrack = async (trackId: string, url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (playingTrackId === trackId) {
      stopPreview();
      return;
    }
    stopPreview();
    if (!url) {
      toast.error('Không tìm thấy tệp âm thanh để nghe thử');
      return;
    }

    try {
      const audio = new Audio(url);
      audioPreviewRef.current = audio;
      setPlayingTrackId(trackId);
      audio.onended = () => setPlayingTrackId(null);
      audio.onerror = () => {
        setPlayingTrackId(null);
        toast.error('Không thể phát tệp nhạc nền này');
      };
      await audio.play();
    } catch {
      setPlayingTrackId(null);
    }
  };

  const handleSelectPreset = (track: (typeof PRESET_MUSIC_TRACKS)[number]) => {
    updateBgMusic({
      path: track.storagePath,
      name: track.name,
      volume: project?.bgMusic?.volume ?? 0.12,
      fadeIn: project?.bgMusic?.fadeIn ?? 2,
      fadeOut: project?.bgMusic?.fadeOut ?? 3,
      ducking: project?.bgMusic?.ducking ?? true,
    });
  };

  const handleUploadCustomMusic = async (file: File) => {
    if (!project?._id) return;
    if (file.size > MAX_AUDIO_UPLOAD_BYTES) {
      toast.error('Tệp nhạc nền vượt quá 50MB.');
      return;
    }
    setUploadingMusic(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', 'music');
      fd.append('projectId', project._id);

      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = (await res.json()) as {
        success: boolean;
        data?: { project?: ProjectDTO };
        error?: string;
      };
      if (!res.ok || !json.success || !json.data?.project) {
        toast.error(json.error || 'Tải nhạc nền thất bại');
        return;
      }
      updateProjectPartial(json.data.project, false);
      toast.success('Đã tải nhạc nền riêng thành công');
    } catch {
      toast.error('Lỗi kết nối khi tải nhạc nền');
    } finally {
      setUploadingMusic(false);
    }
  };

  const handleUploadWatermark = async (file: File) => {
    if (!project?._id) return;
    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      toast.error('Ảnh logo vượt quá 15MB.');
      return;
    }
    setUploadingWatermark(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', 'watermark');
      fd.append('projectId', project._id);

      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = (await res.json()) as {
        success: boolean;
        data?: { project?: ProjectDTO };
        error?: string;
      };
      if (!res.ok || !json.success || !json.data?.project) {
        toast.error(json.error || 'Tải ảnh logo thất bại');
        return;
      }
      updateProjectPartial(json.data.project, false);
      setWatermarkOpen(true);
      toast.success('Đã cập nhật logo thương hiệu');
    } catch {
      toast.error('Lỗi kết nối khi tải ảnh logo');
    } finally {
      setUploadingWatermark(false);
    }
  };

  const currentMusicPath = project?.bgMusic?.path || '';
  const isCustomMusic =
    Boolean(currentMusicPath) &&
    !PRESET_MUSIC_TRACKS.some((t) => t.storagePath === currentMusicPath);

  const wm = project?.watermark;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-bold text-[#fafafa]">4. Nhạc nền & Logo</h2>
        <p className="text-[11px] text-[#9ca3af]">
          Nhạc tự động hạ âm lượng khi có giọng nói để lời thoại luôn rõ ràng
        </p>
      </div>

      {/* Music options */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => {
            stopPreview();
            updateBgMusic(undefined);
          }}
          className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
            !currentMusicPath
              ? 'border-[#f97316]/60 bg-[#f97316]/12 text-[#fafafa]'
              : 'border-white/[0.08] bg-[#18181b] text-[#a1a1aa] hover:border-white/[0.16]'
          }`}
        >
          <VolumeX className="h-4 w-4 shrink-0" />
          <span className="font-medium flex-1">Không dùng nhạc nền</span>
          {!currentMusicPath && <Check className="h-3.5 w-3.5 text-[#f97316]" />}
        </button>

        {PRESET_MUSIC_TRACKS.map((track) => {
          const selected = currentMusicPath === track.storagePath;
          const isPlaying = playingTrackId === track.id;

          return (
            <div
              key={track.id}
              role="button"
              tabIndex={0}
              onClick={() => handleSelectPreset(track)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSelectPreset(track);
                }
              }}
              className={`flex items-center justify-between gap-2.5 rounded-lg border p-2.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f97316] ${
                selected
                  ? 'border-[#f97316]/60 bg-[#f97316]/10'
                  : 'border-white/[0.08] bg-[#18181b] hover:border-white/[0.16]'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#fafafa]">
                  <Music className="h-3.5 w-3.5 text-[#f97316] shrink-0" />
                  <span className="truncate">{track.name}</span>
                </div>
                <p className="mt-0.5 text-[10px] text-[#9ca3af] truncate">
                  {track.description}
                </p>
              </div>

              <button
                type="button"
                onClick={(e) => togglePreviewTrack(track.id, track.previewUrl, e)}
                aria-label={isPlaying ? `Dừng ${track.name}` : `Nghe thử ${track.name}`}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors cursor-pointer ${
                  isPlaying
                    ? 'border-[#f97316] bg-[#f97316] text-black'
                    : 'border-white/[0.1] bg-[#09090b] text-[#d4d4d8] hover:border-[#f97316]/50 hover:text-white'
                }`}
              >
                {isPlaying ? (
                  <Square className="h-3 w-3 fill-current" />
                ) : (
                  <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                )}
              </button>
            </div>
          );
        })}

        {isCustomMusic && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-[#f97316]/50 bg-[#f97316]/10 p-2.5 text-xs">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-[#fafafa] truncate">
                Nhạc tải lên: {project?.bgMusic?.name}
              </div>
            </div>
            <button
              type="button"
              onClick={(e) =>
                togglePreviewTrack('custom', resolveMediaUrl(currentMusicPath), e)
              }
              aria-label="Nghe thử nhạc đã tải lên"
              className="flex h-7 w-7 items-center justify-center rounded-md bg-[#09090b] border border-white/[0.1] text-white cursor-pointer"
            >
              {playingTrackId === 'custom' ? (
                <Square className="h-3 w-3 fill-current" />
              ) : (
                <Play className="h-3 w-3 fill-current ml-0.5" />
              )}
            </button>
          </div>
        )}

        <input
          ref={musicInputRef}
          type="file"
          accept="audio/mpeg,audio/wav,audio/mp4,audio/ogg,.mp3,.wav,.m4a,.ogg"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUploadCustomMusic(f);
            e.target.value = '';
          }}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={uploadingMusic}
          onClick={() => musicInputRef.current?.click()}
          className="w-full gap-1.5"
        >
          {uploadingMusic ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          <span>{uploadingMusic ? 'Đang tải nhạc...' : 'Tải nhạc nền riêng (MP3 / WAV)'}</span>
        </Button>
      </div>

      {/* Music mixing controls */}
      {currentMusicPath && (
        <div className="space-y-3 rounded-lg border border-white/[0.08] bg-[#18181b] p-3">
          <Slider
            label="Âm lượng nhạc nền"
            min={0}
            max={50}
            step={1}
            defaultResetValue={12}
            value={Math.round((project?.bgMusic?.volume ?? 0.12) * 100)}
            valueDisplay={`${Math.round((project?.bgMusic?.volume ?? 0.12) * 100)}%`}
            onChange={(val) => updateBgMusic({ volume: val / 100 })}
          />

          <div className="flex items-center justify-between gap-2 pt-1">
            <div>
              <div className="text-xs font-medium text-[#fafafa]">
                Tự giảm nhạc khi có giọng nói
              </div>
              <div className="text-[10px] text-[#9ca3af]">
                Giúp giọng review luôn nổi rõ trên nền nhạc
              </div>
            </div>
            <Switch
              checked={project?.bgMusic?.ducking ?? true}
              onCheckedChange={(val) => updateBgMusic({ ducking: val })}
              ariaLabel="Bật tự giảm nhạc nền khi có giọng nói"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <Slider
              label="Vào êm (Fade In)"
              min={0}
              max={5}
              step={0.5}
              defaultResetValue={2}
              value={project?.bgMusic?.fadeIn ?? 2}
              valueDisplay={`${project?.bgMusic?.fadeIn ?? 2}s`}
              onChange={(val) => updateBgMusic({ fadeIn: val })}
            />
            <Slider
              label="Tắt dần (Fade Out)"
              min={0}
              max={6}
              step={0.5}
              defaultResetValue={3}
              value={project?.bgMusic?.fadeOut ?? 3}
              valueDisplay={`${project?.bgMusic?.fadeOut ?? 3}s`}
              onChange={(val) => updateBgMusic({ fadeOut: val })}
            />
          </div>
        </div>
      )}

      {/* Watermark / Logo overlay section */}
      <div className="rounded-lg border border-white/[0.08] bg-[#18181b] overflow-hidden">
        <button
          type="button"
          onClick={() => setWatermarkOpen(!watermarkOpen)}
          className="flex w-full items-center justify-between px-3 py-2.5 text-xs font-semibold text-[#fafafa] hover:bg-white/[0.03] cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <ImageIcon className="h-3.5 w-3.5 text-[#f97316]" />
            <span>Logo / Watermark thương hiệu</span>
          </span>
          {watermarkOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {watermarkOpen && (
          <div className="space-y-3 border-t border-white/[0.08] p-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-[#d4d4d8]">Hiển thị logo lên video</span>
                {!wm?.path && (
                  <p className="text-[10px] text-[#9ca3af]">Tải ảnh logo lên trước để bật</p>
                )}
              </div>
              <Switch
                checked={Boolean(wm?.enabled && wm?.path)}
                disabled={!wm?.path}
                ariaLabel="Bật logo thương hiệu"
                onCheckedChange={(val) =>
                  updateWatermark({
                    enabled: val,
                    position: wm?.position || 'top-right',
                    opacity: wm?.opacity ?? 0.85,
                    scale: wm?.scale ?? 0.16,
                  })
                }
              />
            </div>

            <input
              ref={wmInputRef}
              type="file"
              accept="image/png,image/webp,image/jpeg,.png,.webp,.jpg,.jpeg"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUploadWatermark(f);
                e.target.value = '';
              }}
            />

            {wm?.path ? (
              <div className="flex items-center justify-between gap-2 rounded-md border border-white/[0.08] bg-[#09090b] p-2">
                <div className="flex items-center gap-2 min-w-0">
                  <img
                    src={resolveMediaUrl(wm.path)}
                    alt="Logo"
                    className="h-8 w-8 rounded object-contain bg-zinc-900 border border-white/10"
                  />
                  <span className="truncate text-[11px] text-[#fafafa]">{wm.name || 'Logo'}</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={uploadingWatermark}
                  onClick={() => wmInputRef.current?.click()}
                >
                  Đổi ảnh
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={uploadingWatermark}
                onClick={() => wmInputRef.current?.click()}
                className="w-full gap-1.5"
              >
                {uploadingWatermark ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                <span>{uploadingWatermark ? 'Đang tải ảnh...' : 'Tải logo PNG nền trong suốt'}</span>
              </Button>
            )}

            {wm?.path && (
              <>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { value: 'top-left', label: 'Trên Trái' },
                      { value: 'top-right', label: 'Trên Phải' },
                      { value: 'bottom-left', label: 'Dưới Trái' },
                      { value: 'bottom-right', label: 'Dưới Phải' },
                    ] as Array<{ value: WatermarkPosition; label: string }>
                  ).map((corner) => (
                    <button
                      key={corner.value}
                      type="button"
                      onClick={() => updateWatermark({ position: corner.value })}
                      className={`rounded-md border py-1 text-[11px] cursor-pointer ${
                        (wm.position || 'top-right') === corner.value
                          ? 'border-[#f97316]/60 bg-[#f97316]/15 text-[#fb923c]'
                          : 'border-white/[0.08] bg-[#09090b] text-[#a1a1aa]'
                      }`}
                    >
                      {corner.label}
                    </button>
                  ))}
                </div>

                <Slider
                  label="Độ rõ (Opacity)"
                  min={20}
                  max={100}
                  step={5}
                  defaultResetValue={85}
                  value={Math.round((wm.opacity ?? 0.85) * 100)}
                  valueDisplay={`${Math.round((wm.opacity ?? 0.85) * 100)}%`}
                  onChange={(val) => updateWatermark({ opacity: val / 100 })}
                />

                <Slider
                  label="Kích thước (% chiều ngang)"
                  min={8}
                  max={30}
                  step={1}
                  defaultResetValue={16}
                  value={Math.round((wm.scale ?? 0.16) * 100)}
                  valueDisplay={`${Math.round((wm.scale ?? 0.16) * 100)}%`}
                  onChange={(val) => updateWatermark({ scale: val / 100 })}
                />
              </>
            )}
          </div>
        )}
      </div>

      <Button onClick={() => setActiveTab('export')} className="w-full">
        Tiếp tục xuất video
      </Button>
    </div>
  );
}
