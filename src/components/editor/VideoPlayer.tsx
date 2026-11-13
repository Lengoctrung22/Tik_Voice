'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Upload,
  ShieldCheck,
  Volume2,
  VolumeX,
  Film,
  Loader2,
  Eye,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { useEditorStore } from '@/stores/editorStore';
import { resolveMediaUrl } from '@/lib/utils';
import { resolvePreviewSubtitleGroup } from '@/lib/video/subtitle-layout';
import { DEFAULT_SUBTITLE_STYLE } from '@/lib/video/subtitle-presets';
import { MAX_VIDEO_UPLOAD_BYTES } from '@/lib/validation/schemas';
import type { IWordTimestamp, ProjectDTO } from '@/types';

function formatHexColor(hex?: string): string {
  if (!hex) return '#FFFFFF';
  return hex.startsWith('#') ? hex : `#${hex}`;
}

export function VideoPlayer() {
  const {
    project,
    activeTab,
    currentTime,
    isPlaying,
    previewMode,
    safeZoneVisible,
    seekTarget,
    setCurrentTime,
    setIsPlaying,
    setPreviewMode,
    setSafeZoneVisible,
    updateProjectPartial,
  } = useEditorStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const bgBlurVideoRef = useRef<HTMLVideoElement>(null);
  const ttsAudioRef = useRef<HTMLAudioElement>(null);
  const musicAudioRef = useRef<HTMLAudioElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const [frameWidth, setFrameWidth] = useState(320);
  const [isMutedPreview, setIsMutedPreview] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  // Đo chiều rộng khung preview 9:16 để scale chữ phụ đề chính xác như FFmpeg 1080p
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => setFrameWidth(el.clientWidth || 320);
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const videoDuration = project?.video?.duration || 0;
  const audioDuration = project?.tts?.audioDuration || 0;
  const hasExport = Boolean(project?.status === 'done' && project?.export?.path);

  const clips = useMemo(() => {
    if (project?.video?.clips && project.video.clips.length > 0) {
      return project.video.clips;
    }
    return [];
  }, [project?.video?.clips]);

  // Chọn clip active nếu có nhiều clip B-roll
  const activeClipInfo = useMemo(() => {
    if (previewMode === 'export' && hasExport) {
      return {
        url: resolveMediaUrl(project?.export?.path),
        offsetInClip: currentTime,
      };
    }

    if (clips.length > 1) {
      const totalClipsDur = clips.reduce((s, c) => s + Math.max(c.duration, 0.2), 0);
      const looped = totalClipsDur > 0 ? currentTime % totalClipsDur : 0;
      let acc = 0;
      for (const c of clips) {
        const dur = Math.max(c.duration, 0.2);
        if (looped < acc + dur) {
          return {
            url: resolveMediaUrl(c.path),
            offsetInClip: looped - acc,
          };
        }
        acc += dur;
      }
    }

    return {
      url: resolveMediaUrl(project?.video?.path),
      offsetInClip: videoDuration > 0 ? currentTime % videoDuration : currentTime,
    };
  }, [clips, currentTime, hasExport, previewMode, project?.export?.path, project?.video?.path, videoDuration]);

  const ttsUrl = useMemo(
    () => (previewMode === 'preview' ? resolveMediaUrl(project?.tts?.audioPath) : ''),
    [previewMode, project?.tts?.audioPath]
  );

  const musicUrl = useMemo(
    () => (previewMode === 'preview' ? resolveMediaUrl(project?.bgMusic?.path) : ''),
    [previewMode, project?.bgMusic?.path]
  );

  const effectiveTotalDuration = useMemo(() => {
    if (previewMode === 'export' && hasExport) {
      return audioDuration || videoDuration || 1;
    }
    return Math.max(audioDuration, videoDuration, 1);
  }, [audioDuration, hasExport, previewMode, videoDuration]);

  // Sync âm lượng nhạc nền & âm lượng video gốc
  useEffect(() => {
    if (musicAudioRef.current) {
      musicAudioRef.current.volume = isMutedPreview
        ? 0
        : Math.min(1, Math.max(0, project?.bgMusic?.volume ?? 0.12));
    }
    if (ttsAudioRef.current) {
      ttsAudioRef.current.volume = isMutedPreview ? 0 : 1;
    }
    if (videoRef.current) {
      if (previewMode === 'export') {
        videoRef.current.muted = isMutedPreview;
        videoRef.current.volume = isMutedPreview ? 0 : 1;
      } else {
        const origVol = project?.video?.originalVolume ?? 0;
        videoRef.current.muted = isMutedPreview || origVol <= 0.01;
        videoRef.current.volume = isMutedPreview ? 0 : origVol;
      }
    }
  }, [isMutedPreview, previewMode, project?.bgMusic?.volume, project?.video?.originalVolume]);

  // Seek handler
  useEffect(() => {
    if (!seekTarget) return;
    const t = Math.min(Math.max(0, seekTarget.time), effectiveTotalDuration);
    if (videoRef.current) {
      const targetVideoTime =
        previewMode === 'export'
          ? t
          : clips.length > 1
          ? activeClipInfo.offsetInClip
          : videoDuration > 0
          ? t % videoDuration
          : t;
      if (Math.abs(videoRef.current.currentTime - targetVideoTime) > 0.08) {
        videoRef.current.currentTime = targetVideoTime;
      }
    }
    if (bgBlurVideoRef.current && videoRef.current) {
      bgBlurVideoRef.current.currentTime = videoRef.current.currentTime;
    }
    if (ttsAudioRef.current && previewMode === 'preview') {
      ttsAudioRef.current.currentTime = Math.min(t, ttsAudioRef.current.duration || t);
    }
    if (musicAudioRef.current && previewMode === 'preview') {
      const mDur = musicAudioRef.current.duration || 0;
      musicAudioRef.current.currentTime = mDur > 0 ? t % mDur : t;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekTarget]);

  // Play / Pause synchronization
  useEffect(() => {
    const vid = videoRef.current;
    const blurVid = bgBlurVideoRef.current;
    const tts = ttsAudioRef.current;
    const music = musicAudioRef.current;

    if (isPlaying) {
      const storeTime = useEditorStore.getState().currentTime;
      if (vid) {
        const targetVideoTime =
          previewMode === 'export'
            ? storeTime
            : clips.length > 1
            ? activeClipInfo.offsetInClip
            : videoDuration > 0
            ? storeTime % videoDuration
            : storeTime;
        if (vid.readyState >= 1 && Math.abs(vid.currentTime - targetVideoTime) > 0.2) {
          vid.currentTime = targetVideoTime;
        }
        vid.play().catch(() => {});
      }
      if (blurVid) {
        if (vid && blurVid.readyState >= 1 && Math.abs(blurVid.currentTime - vid.currentTime) > 0.2) {
          blurVid.currentTime = vid.currentTime;
        }
        blurVid.play().catch(() => {});
      }
      if (previewMode === 'preview') {
        if (tts && ttsUrl && storeTime < (audioDuration || effectiveTotalDuration)) {
          const targetTts = Math.min(storeTime, tts.duration || storeTime);
          if (tts.readyState >= 1 && Math.abs(tts.currentTime - targetTts) > 0.15) {
            tts.currentTime = targetTts;
          }
          tts.play().catch(() => {});
        }
        if (music && musicUrl) {
          const mDur = music.duration || 0;
          const targetMusic = mDur > 0 ? storeTime % mDur : storeTime;
          if (music.readyState >= 1 && Math.abs(music.currentTime - targetMusic) > 0.2) {
            music.currentTime = targetMusic;
          }
          music.play().catch(() => {});
        }
      }
    } else {
      vid?.pause();
      blurVid?.pause();
      tts?.pause();
      music?.pause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, previewMode, ttsUrl, musicUrl]);

  // Master playback tick using requestAnimationFrame when playing
  useEffect(() => {
    if (!isPlaying) return;
    let rafId = 0;
    let lastStamp = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.1, (now - lastStamp) / 1000);
      lastStamp = now;

      const storeState = useEditorStore.getState();
      const next = storeState.currentTime + dt;

      if (next >= effectiveTotalDuration) {
        setCurrentTime(0);
        setIsPlaying(false);
        if (videoRef.current) videoRef.current.currentTime = 0;
        if (bgBlurVideoRef.current) bgBlurVideoRef.current.currentTime = 0;
        if (ttsAudioRef.current) ttsAudioRef.current.currentTime = 0;
        if (musicAudioRef.current) musicAudioRef.current.currentTime = 0;
        return;
      }

      setCurrentTime(next);

      if (videoRef.current && videoRef.current.paused && activeClipInfo.url) {
        videoRef.current.play().catch(() => {});
      }
      if (bgBlurVideoRef.current && videoRef.current) {
        if (Math.abs(bgBlurVideoRef.current.currentTime - videoRef.current.currentTime) > 0.25) {
          bgBlurVideoRef.current.currentTime = videoRef.current.currentTime;
        }
      }

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [activeClipInfo.url, effectiveTotalDuration, isPlaying, setCurrentTime, setIsPlaying]);

  // Keyboard Space to toggle play/pause (skip inputs & modal dialogs)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        target?.isContentEditable ||
        target?.closest('[role="dialog"]')
      ) {
        return;
      }
      e.preventDefault();
      setIsPlaying(!useEditorStore.getState().isPlaying);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setIsPlaying]);

  const handleUploadPrimaryVideo = async (file: File) => {
    if (!project?._id) return;
    if (file.size > MAX_VIDEO_UPLOAD_BYTES) {
      toast.error('Video vượt quá 500MB.');
      return;
    }
    setUploadingVideo(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', 'video');
      fd.append('projectId', project._id);

      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = (await res.json()) as {
        success: boolean;
        data?: { project?: ProjectDTO };
        error?: string;
      };
      if (!res.ok || !json.success || !json.data?.project) {
        toast.error(json.error || 'Tải video lên thất bại');
        return;
      }
      updateProjectPartial(json.data.project, false);
      toast.success('Đã tải video gốc thành công');
    } catch {
      toast.error('Lỗi kết nối khi tải video');
    } finally {
      setUploadingVideo(false);
    }
  };

  // Tính cụm phụ đề hiện tại (dùng chung layout với trình kết xuất phụ đề)
  const subStyle = { ...DEFAULT_SUBTITLE_STYLE, ...(project?.subtitle?.style || {}) };
  const subtitleEnabled =
    previewMode === 'preview' && Boolean(project && project.subtitle?.enabled !== false);

  const activeGroupInfo = useMemo(
    () =>
      resolvePreviewSubtitleGroup({
        subtitleEnabled,
        previewMode,
        activeTab,
        words: project?.subtitle?.words || [],
        currentTimeSec: currentTime,
        wordsPerGroup: subStyle.wordsPerGroup || 3,
        maxCharsPerLine: subStyle.maxCharsPerLine || 25,
      }),
    [
      activeTab,
      currentTime,
      previewMode,
      project?.subtitle?.words,
      subStyle.maxCharsPerLine,
      subStyle.wordsPerGroup,
      subtitleEnabled,
    ]
  );

  const scaleFactor = frameWidth / 1080;
  const scaledFontSize = Math.max(12, Math.round((subStyle.fontSize || 64) * scaleFactor));
  const scaledBottomMargin = Math.round((subStyle.marginBottom || 140) * (frameWidth * (16 / 9) / 1920));
  const rawOutlineWidth = subStyle.outlineWidth ?? 4;
  const outlinePx = rawOutlineWidth > 0 ? Math.max(1, rawOutlineWidth * scaleFactor * 0.9) : 0;
  const rawShadowDepth = subStyle.shadowDepth ?? 2;
  const outlineHex = formatHexColor(subStyle.outlineColor || '#000000');
  const shadowParts =
    outlinePx > 0
      ? [
          `${-outlinePx}px ${-outlinePx}px 0 ${outlineHex}`,
          `${outlinePx}px ${-outlinePx}px 0 ${outlineHex}`,
          `${-outlinePx}px ${outlinePx}px 0 ${outlineHex}`,
          `${outlinePx}px ${outlinePx}px 0 ${outlineHex}`,
        ]
      : [];
  if (rawShadowDepth > 0) {
    shadowParts.push(`0 2px ${Math.max(2, rawShadowDepth * 2)}px rgba(0,0,0,0.65)`);
  }
  const outlineShadow = shadowParts.length > 0 ? shadowParts.join(', ') : 'none';

  const aspectMode = project?.video?.aspectMode || 'contain';

  const watermarkStylePos = useMemo(() => {
    const pos = project?.watermark?.position || 'top-right';
    switch (pos) {
      case 'top-left':
        return 'top-[5%] left-[5%]';
      case 'top-right':
        return 'top-[5%] right-[5%]';
      case 'bottom-left':
        return 'bottom-[14%] left-[5%]';
      case 'bottom-right':
      default:
        return 'bottom-[14%] right-[5%]';
    }
  }, [project?.watermark?.position]);

  return (
    <div className="flex flex-1 min-h-0 flex-col bg-[#09090b] px-3 py-2.5">
      {/* Top Stage Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 shrink-0">
        <div className="flex items-center gap-1 rounded-md border border-white/[0.08] bg-[#111113] p-0.5 text-[11px]">
          <button
            type="button"
            onClick={() => setPreviewMode('preview')}
            className={`rounded px-2.5 py-1 font-medium transition-colors cursor-pointer ${
              previewMode === 'preview'
                ? 'bg-[#27272a] text-white'
                : 'text-[#a1a1aa] hover:text-white'
            }`}
          >
            Xem trực tiếp
          </button>
          <button
            type="button"
            disabled={!hasExport}
            onClick={() => setPreviewMode('export')}
            title={hasExport ? 'Xem video MP4 đã xuất' : 'Xuất video để xem bản hoàn chỉnh'}
            className={`rounded px-2.5 py-1 font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              previewMode === 'export'
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'text-[#a1a1aa] hover:text-white'
            }`}
          >
            Bản đã xuất {hasExport ? '✓' : ''}
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSafeZoneVisible(!safeZoneVisible)}
            className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
              safeZoneVisible
                ? 'border-[#f97316]/50 bg-[#f97316]/15 text-[#fb923c]'
                : 'border-white/[0.08] bg-[#111113] text-[#a1a1aa] hover:text-white'
            }`}
            title="Hiển thị vùng nút TikTok để tránh che phụ đề"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Vùng an toàn TikTok</span>
          </button>

          <button
            type="button"
            onClick={() => setIsMutedPreview(!isMutedPreview)}
            aria-label={isMutedPreview ? 'Bật âm thanh nghe thử' : 'Tắt âm thanh nghe thử'}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.08] bg-[#111113] text-[#a1a1aa] hover:text-white cursor-pointer"
          >
            {isMutedPreview ? <VolumeX className="h-3.5 w-3.5 text-red-400" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* 9:16 Video Frame centered inside remaining height */}
      <div className="flex flex-1 min-h-0 items-center justify-center">
        <div
          ref={containerRef}
          className="relative aspect-[9/16] w-full max-w-[290px] sm:max-w-[320px] lg:w-auto lg:max-w-full lg:h-full max-h-full overflow-hidden rounded-xl border border-white/[0.12] bg-black shadow-2xl"
        >
          {activeClipInfo.url ? (
            <>
              {previewMode === 'preview' && aspectMode === 'blur' && (
                <video
                  ref={bgBlurVideoRef}
                  src={activeClipInfo.url}
                  loop
                  muted
                  playsInline
                  onLoadedMetadata={(e) => {
                    const targetOffset = activeClipInfo.offsetInClip || 0;
                    if (targetOffset > 0.05) {
                      e.currentTarget.currentTime = targetOffset;
                    }
                    if (useEditorStore.getState().isPlaying) {
                      e.currentTarget.play().catch(() => {});
                    }
                  }}
                  className="pointer-events-none absolute inset-0 h-full w-full object-cover scale-110 blur-xl opacity-75"
                />
              )}
              <video
                ref={videoRef}
                src={activeClipInfo.url}
                loop={previewMode === 'preview'}
                playsInline
                onLoadedMetadata={(e) => {
                  const targetOffset = activeClipInfo.offsetInClip || 0;
                  if (targetOffset > 0.05) {
                    e.currentTarget.currentTime = targetOffset;
                  }
                  if (useEditorStore.getState().isPlaying) {
                    e.currentTarget.play().catch(() => {});
                  }
                }}
                onClick={() => setIsPlaying(!isPlaying)}
                className={`relative z-10 h-full w-full cursor-pointer ${
                  previewMode === 'preview' && aspectMode === 'cover'
                    ? 'object-cover'
                    : 'object-contain'
                }`}
              />
            </>
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#18181b] text-[#9ca3af]">
                <Film className="h-6 w-6" />
              </div>
              <p className="text-xs font-medium text-[#d4d4d8]">Chưa có video gốc</p>
              <input
                ref={uploadInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm,.m4v"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUploadPrimaryVideo(f);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                disabled={uploadingVideo}
                onClick={() => uploadInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#f97316] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#ea580c] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploadingVideo ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                <span>{uploadingVideo ? 'Đang tải...' : 'Tải video lên'}</span>
              </button>
            </div>
          )}

          {/* Audio tracks for preview */}
          {ttsUrl && <audio ref={ttsAudioRef} src={ttsUrl} preload="auto" />}
          {musicUrl && <audio ref={musicAudioRef} src={musicUrl} loop preload="auto" />}

          {/* Watermark overlay */}
          {previewMode === 'preview' &&
            project?.watermark?.enabled &&
            project?.watermark?.path && (
              <img
                src={resolveMediaUrl(project.watermark.path)}
                alt="Logo thương hiệu"
                className={`pointer-events-none absolute z-20 object-contain ${watermarkStylePos}`}
                style={{
                  width: `${Math.round((project.watermark.scale || 0.16) * 100)}%`,
                  opacity: project.watermark.opacity ?? 0.85,
                }}
              />
            )}

          {/* Live Sample Subtitle Indicator (kept outside text positioning wrapper) */}
          {activeGroupInfo?.isSample && (
            <div
              className={`pointer-events-none absolute left-1/2 -translate-x-1/2 z-30 ${
                subStyle.position === 'top' ? 'bottom-2.5' : 'top-2.5'
              }`}
            >
              <span className="inline-block whitespace-nowrap rounded-full border border-white/15 bg-black/75 px-2 py-0.5 text-[10px] font-medium text-[#d4d4d8] backdrop-blur-sm">
                Xem mẫu phụ đề
              </span>
            </div>
          )}

          {/* Live Karaoke Subtitle Overlay */}
          {activeGroupInfo && (
            <div
              className={`pointer-events-none absolute inset-x-3 z-30 flex flex-col ${
                subStyle.alignment === 'left'
                  ? 'items-start text-left'
                  : subStyle.alignment === 'right'
                  ? 'items-end text-right'
                  : 'items-center text-center'
              }`}
              style={{
                ...(subStyle.position === 'top'
                  ? { top: `${Math.max(16, scaledBottomMargin)}px` }
                  : subStyle.position === 'center'
                  ? { top: '50%', transform: 'translateY(-50%)' }
                  : { bottom: `${Math.max(14, scaledBottomMargin)}px` }),
              }}
            >
              <div
                key={
                  activeGroupInfo.isSample
                    ? `sample_${subStyle.animation}_${subStyle.fontFamily}_${subStyle.position}`
                    : activeGroupInfo.gi
                }
                className={`flex flex-col w-full ${
                  subStyle.alignment === 'left'
                    ? 'items-start text-left'
                    : subStyle.alignment === 'right'
                    ? 'items-end text-right'
                    : 'items-center text-center'
                } ${
                  subStyle.animation === 'fade'
                    ? 'tv-sub-anim-fade'
                    : subStyle.animation === 'bounce'
                    ? 'tv-sub-anim-bounce'
                    : ''
                }`}
              >
                {activeGroupInfo.lines.map((line, li) => (
                  <div
                    key={li}
                    className="leading-tight break-words"
                    style={{
                      fontFamily: `"${subStyle.fontFamily}", "Be Vietnam Pro", sans-serif`,
                      fontSize: `${scaledFontSize}px`,
                      fontWeight:
                        subStyle.fontWeight === 'black'
                          ? 900
                          : subStyle.fontWeight === 'bold'
                          ? 700
                          : 400,
                      textShadow: outlineShadow,
                    }}
                  >
                    {line.map((w: IWordTimestamp, wi: number) => {
                      const isSpoken = activeGroupInfo.currentMs >= w.start;
                      const visible =
                        activeGroupInfo.isSample ||
                        subStyle.animation !== 'typewriter' ||
                        isSpoken;
                      if (!visible) return null;

                      const isHighlighted = Boolean(subStyle.highlightEnabled) && isSpoken;
                      const sampleTypewriterStyle =
                        activeGroupInfo.isSample && subStyle.animation === 'typewriter'
                          ? {
                              animation: 'tv-sub-fade 160ms ease-out both',
                              animationDelay: `${Math.round(w.start / 4)}ms`,
                            }
                          : undefined;
                      return (
                        <span
                          key={`${wi}_${w.start}`}
                          style={{
                            color: isHighlighted
                              ? formatHexColor(subStyle.highlightColor || '#FFD700')
                              : formatHexColor(subStyle.primaryColor || '#FFFFFF'),
                            ...sampleTypewriterStyle,
                          }}
                        >
                          {w.word}
                          {wi < line.length - 1 ? ' ' : ''}
                        </span>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TikTok Safe Zone Guide */}
          {safeZoneVisible && (
            <div className="pointer-events-none absolute inset-0 z-40">
              {/* Top status/nav safe area */}
              <div className="absolute inset-x-0 top-0 h-[11%] bg-red-500/20 border-b border-dashed border-red-400/70 flex items-end justify-center pb-1">
                <span className="text-[9px] font-medium text-red-200 flex items-center gap-1">
                  <Eye className="h-2.5 w-2.5" /> Thanh trạng thái
                </span>
              </div>
              {/* Right engagement column */}
              <div className="absolute right-0 top-[42%] bottom-[24%] w-[16%] bg-red-500/20 border-l border-dashed border-red-400/70 flex items-center justify-center">
                <span className="text-[9px] font-medium text-red-200 -rotate-90 whitespace-nowrap">
                  Nút tương tác
                </span>
              </div>
              {/* Bottom caption + shopping cart zone */}
              <div className="absolute inset-x-0 bottom-0 h-[24%] bg-red-500/20 border-t border-dashed border-red-400/70 flex items-start justify-center pt-1.5">
                <span className="text-[9px] font-medium text-red-200 flex items-center gap-1">
                  <Sparkles className="h-2.5 w-2.5" /> Giỏ hàng & Mô tả TikTok
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
