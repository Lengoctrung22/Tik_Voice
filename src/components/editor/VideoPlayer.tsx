'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { IWordTimestamp } from '@/types';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Sparkles,
  Film,
  Music,
  CheckCircle2,
  Tv,
} from 'lucide-react';
import { formatDuration } from '@/lib/utils';

export function VideoPlayer() {
  const {
    project,
    currentTime,
    setCurrentTime,
    seekTo,
    seekTarget,
    isPlaying,
    setIsPlaying,
    duration,
    setDuration,
    previewMode,
    setPreviewMode,
  } = useEditorStore();

  const videoRef = useRef<HTMLVideoElement>(null);
  const ttsAudioRef = useRef<HTMLAudioElement>(null);
  const bgMusicRef = useRef<HTMLAudioElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  const [isMuted, setIsMuted] = useState(false);
  const [containerWidth, setContainerWidth] = useState(360);

  // ResizeObserver on the actual 9:16 frame to calculate real-time scaleFactor = previewWidth / 1080
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });

    observer.observe(el);
    setContainerWidth(el.clientWidth || 360);

    return () => observer.disconnect();
  }, []);

  const hasExportedVideo = Boolean(project?.status === 'done' && project?.export?.path);

  // Video Source resolution
  const videoSrc = useMemo(() => {
    if (previewMode === 'export' && project?.export?.path) {
      const fileName = project.export.path.split(/[\\/]/).pop();
      return `/api/files/exports/${project._id}/${encodeURIComponent(fileName || '')}`;
    }
    if (project?.video?.path) {
      const fileName = project.video.path.split(/[\\/]/).pop();
      return `/api/files/uploads/${project._id}/${encodeURIComponent(fileName || '')}`;
    }
    return '';
  }, [project?._id, project?.video?.path, project?.export?.path, previewMode]);

  // TTS Audio Source resolution
  const ttsAudioSrc = useMemo(() => {
    if (previewMode === 'export') return '';
    if (project?.tts?.audioPath) {
      const fileName = project.tts.audioPath.split(/[\\/]/).pop();
      return `/api/files/audio/${project._id}/${encodeURIComponent(fileName || '')}`;
    }
    return '';
  }, [project?._id, project?.tts?.audioPath, previewMode]);

  // BG Music Audio Source resolution
  const bgMusicSrc = useMemo(() => {
    if (previewMode === 'export') return '';
    if (project?.bgMusic?.path) {
      const p = project.bgMusic.path.replace(/\\/g, '/');
      const fileName = p.split('/').pop() || '';
      if (p.includes('public/music') || p.startsWith('/music') || p.startsWith('music/')) {
        return `/music/${encodeURIComponent(fileName)}`;
      }
      return `/api/files/music/${project._id}/${encodeURIComponent(fileName)}`;
    }
    return '';
  }, [project?._id, project?.bgMusic?.path, previewMode]);

  // Effective duration
  const totalDuration = useMemo(() => {
    if (previewMode === 'export' && project?.tts?.audioDuration) {
      return project.tts.audioDuration;
    }
    return Math.max(
      1,
      project?.tts?.audioDuration || project?.video?.duration || duration || 30
    );
  }, [project?.tts?.audioDuration, project?.video?.duration, duration, previewMode]);

  // Ensure volume & ducking on BG music element
  useEffect(() => {
    if (bgMusicRef.current && project?.bgMusic) {
      bgMusicRef.current.volume = isMuted ? 0 : project.bgMusic.volume ?? 0.12;
    }
  }, [project?.bgMusic?.volume, isMuted]);

  // Synchronize play / pause across all media streams
  useEffect(() => {
    const video = videoRef.current;
    const tts = ttsAudioRef.current;
    const bgm = bgMusicRef.current;

    if (!video) return;

    if (isPlaying) {
      video.play().catch(() => {});
      if (tts && ttsAudioSrc) {
        tts.play().catch(() => {});
      }
      if (bgm && bgMusicSrc) {
        bgm.play().catch(() => {});
      }
    } else {
      video.pause();
      if (tts) tts.pause();
      if (bgm) bgm.pause();
    }
  }, [isPlaying, ttsAudioSrc, bgMusicSrc]);

  // Synchronize external seeks (from Timeline or keyboard controls)
  useEffect(() => {
    if (!seekTarget) return;
    const seekTime = seekTarget.time;

    if (previewMode === 'export') {
      if (videoRef.current) videoRef.current.currentTime = seekTime;
      return;
    }

    if (ttsAudioRef.current && ttsAudioSrc) {
      ttsAudioRef.current.currentTime = seekTime;
    }

    if (videoRef.current) {
      const videoDur = project?.video?.duration || videoRef.current.duration || 0;
      if (videoDur > 0) {
        videoRef.current.currentTime = seekTime % videoDur;
      } else {
        videoRef.current.currentTime = seekTime;
      }
    }

    if (bgMusicRef.current && bgMusicSrc) {
      const bgmDur = bgMusicRef.current.duration;
      if (bgmDur && bgmDur > 0 && isFinite(bgmDur)) {
        bgMusicRef.current.currentTime = seekTime % bgmDur;
      } else {
        bgMusicRef.current.currentTime = seekTime;
      }
    }
  }, [seekTarget, previewMode, ttsAudioSrc, bgMusicSrc, project?.video?.duration]);

  // Spacebar toggle play/pause shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl?.tagName === 'INPUT' ||
        activeEl?.tagName === 'TEXTAREA' ||
        activeEl?.tagName === 'SELECT';
      if (e.code === 'Space' && !isInput) {
        e.preventDefault();
        setIsPlaying(!isPlaying);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, setIsPlaying]);

  // Dual-Media Sync: When TTS is active, TTS drives the master clock.
  // Video loops automatically if videoDuration < audioDuration.
  const handleTtsTimeUpdate = () => {
    if (previewMode === 'export') return;
    if (ttsAudioRef.current) {
      const t = ttsAudioRef.current.currentTime;
      setCurrentTime(t);

      // Loop video smoothly if video is shorter than speech
      const video = videoRef.current;
      const videoDur = project?.video?.duration || video?.duration || 0;
      if (video && videoDur > 0) {
        const loopTime = t % videoDur;
        if (Math.abs(video.currentTime - loopTime) > 0.3) {
          video.currentTime = loopTime;
        }
      }

      // Sync BG music if drifting > 0.35s (modulo bgm duration for smooth looping)
      const bgm = bgMusicRef.current;
      if (bgm && bgMusicSrc) {
        const bgmDur = bgm.duration;
        const targetBgmTime = bgmDur && bgmDur > 0 && isFinite(bgmDur) ? t % bgmDur : t;
        if (Math.abs(bgm.currentTime - targetBgmTime) > 0.35) {
          bgm.currentTime = targetBgmTime;
        }
      }
    }
  };

  // Video time update fallback when TTS audio is not present or when in export mode
  const handleVideoTimeUpdate = () => {
    if (!ttsAudioSrc || previewMode === 'export') {
      if (videoRef.current) {
        const t = videoRef.current.currentTime;
        setCurrentTime(t);

        // Sync BG music if present
        const bgm = bgMusicRef.current;
        if (bgm && bgMusicSrc) {
          const bgmDur = bgm.duration;
          const targetBgmTime = bgmDur && bgmDur > 0 && isFinite(bgmDur) ? t % bgmDur : t;
          if (Math.abs(bgm.currentTime - targetBgmTime) > 0.35) {
            bgm.currentTime = targetBgmTime;
          }
        }
      }
    }
  };

  const handleVideoEnded = () => {
    const video = videoRef.current;
    if (!video) return;

    // In preview mode: If TTS audio is still playing, loop video from beginning
    if (previewMode === 'preview' && ttsAudioSrc && ttsAudioRef.current) {
      if (ttsAudioRef.current.currentTime < (project?.tts?.audioDuration || 0) - 0.2) {
        video.currentTime = 0;
        video.play().catch(() => {});
        return;
      }
    }

    // Otherwise standard end
    setIsPlaying(false);
  };

  const handleTtsEnded = () => {
    setIsPlaying(false);
    setCurrentTime(totalDuration);
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const d =
        project?.tts?.audioDuration || videoRef.current.duration || project?.video?.duration || 30;
      setDuration(d);
    }
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (seekTime: number) => {
    seekTo(seekTime);
  };

  const handleRestart = () => {
    seekTo(0);
    setIsPlaying(true);
  };

  // Real-time Subtitle Karaoke Calculation
  const activeWordGroup = useMemo(() => {
    // In exported video mode, subtitles are already burned in by FFmpeg!
    if (previewMode === 'export') return null;

    const words = project?.subtitle?.words || [];
    const enabled = project?.subtitle?.enabled ?? true;
    if (!enabled || words.length === 0) return null;

    const currentMs = currentTime * 1000;
    const wordsPerGroup = project?.subtitle?.style?.wordsPerGroup || 3;

    // Group words
    const groups: IWordTimestamp[][] = [];
    let current: IWordTimestamp[] = [];
    for (const w of words) {
      current.push(w);
      if (current.length >= wordsPerGroup) {
        groups.push(current);
        current = [];
      }
    }
    if (current.length > 0) groups.push(current);

    // Find group active at currentMs with smooth sentence/word bridging
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      const gStart = g[0].start;
      const gEnd = g[g.length - 1].end;
      const nextStart = i < groups.length - 1 ? groups[i + 1][0].start : gEnd + 600;
      const displayEnd = Math.max(gEnd + 300, Math.min(nextStart, gEnd + 800));

      if (currentMs >= gStart && currentMs < displayEnd) {
        return g;
      }
    }

    return null;
  }, [
    project?.subtitle?.words,
    project?.subtitle?.enabled,
    project?.subtitle?.style?.wordsPerGroup,
    currentTime,
    previewMode,
  ]);

  const style = project?.subtitle?.style;
  const highlightEnabled = style?.highlightEnabled ?? true;
  const primaryColor = style?.primaryColor || '#FFFFFF';
  const highlightColor = style?.highlightColor || '#FFD700';
  const outlineColor = style?.outlineColor || '#000000';
  const currentMs = currentTime * 1000;

  // Pixel-accurate Resolution Scaling for Web Preview (1080x1920 reference)
  // scaleFactor = containerWidth / 1080
  const scaleFactor = Math.max(0.2, containerWidth / 1080);
  const scaledFontSize = Math.max(14, Math.round((style?.fontSize || 64) * scaleFactor));
  const scaledOutlineWidth = Math.max(1, Math.round((style?.outlineWidth ?? 4) * scaleFactor));
  const scaledMarginBottom = Math.round((style?.marginBottom ?? 120) * scaleFactor);

  const textShadow = useMemo(() => {
    const w = scaledOutlineWidth;
    const shadowColor = style?.shadowColor || '#00000080';
    const shadowDepth = Math.max(1, Math.round((style?.shadowDepth ?? 2) * scaleFactor));
    return `
      -${w}px -${w}px 0 ${outlineColor},
       ${w}px -${w}px 0 ${outlineColor},
      -${w}px  ${w}px 0 ${outlineColor},
       ${w}px  ${w}px 0 ${outlineColor},
       0px -${w}px 0 ${outlineColor},
       0px  ${w}px 0 ${outlineColor},
      -${w}px  0px 0 ${outlineColor},
       ${w}px  0px 0 ${outlineColor},
       ${shadowDepth}px ${shadowDepth}px ${shadowDepth * 2}px ${shadowColor}
    `;
  }, [scaledOutlineWidth, outlineColor, style?.shadowColor, style?.shadowDepth, scaleFactor]);

  const positionStyle = useMemo(() => {
    if (style?.position === 'top') {
      return { top: `${scaledMarginBottom}px` };
    }
    if (style?.position === 'center') {
      return { top: '50%', transform: 'translateY(-50%)' };
    }
    return { bottom: `${scaledMarginBottom}px` };
  }, [style?.position, scaledMarginBottom]);

  const fontWeight =
    style?.fontWeight === 'black' ? 900 : style?.fontWeight === 'bold' ? 700 : 400;

  return (
    <div
      className="relative flex flex-col items-center justify-center bg-black rounded-2xl border border-[#3f3f46] overflow-hidden w-full max-w-[340px] sm:max-w-[380px] shadow-2xl"
    >
      {/* Top Preview Switcher Bar (if project is exported) */}
      {hasExportedVideo && (
        <div className="w-full bg-[#18181b] border-b border-[#3f3f46] px-3 py-1.5 flex items-center justify-between z-30 text-xs">
          <span className="text-[11px] text-[#a1a1aa] flex items-center gap-1 font-medium">
            <Tv className="h-3 w-3 text-[#22c55e]" />
            <span>Chế độ:</span>
          </span>
          <div className="flex items-center gap-1 bg-[#09090b] p-0.5 rounded-lg border border-[#3f3f46]">
            <button
              type="button"
              onClick={() => setPreviewMode('export')}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                previewMode === 'export'
                  ? 'bg-[#22c55e] text-black shadow-sm'
                  : 'text-[#a1a1aa] hover:text-white'
              }`}
            >
              Video đã xuất (.mp4)
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode('preview')}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                previewMode === 'preview'
                  ? 'bg-[#f97316] text-black shadow-sm'
                  : 'text-[#a1a1aa] hover:text-white'
              }`}
            >
              Bản dựng Live
            </button>
          </div>
        </div>
      )}

      {/* 9:16 Aspect Ratio Frame */}
      <div
        ref={frameRef}
        className="relative aspect-[9/16] w-full bg-black flex items-center justify-center overflow-hidden"
      >
        {videoSrc ? (
          <video
            ref={videoRef}
            src={videoSrc}
            playsInline
            loop={previewMode === 'preview' && Boolean(ttsAudioSrc) && (project?.video?.duration || 0) < totalDuration}
            muted={isMuted || (previewMode === 'preview' && Boolean(ttsAudioSrc))}
            onTimeUpdate={handleVideoTimeUpdate}
            onEnded={handleVideoEnded}
            onLoadedMetadata={handleLoadedMetadata}
            onClick={togglePlay}
            className="h-full w-full object-contain cursor-pointer"
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center text-[#71717a]">
            <Play className="h-12 w-12 mb-3 opacity-30 text-[#f97316]" />
            <p className="text-sm font-semibold text-white">Chưa có video gốc</p>
            <p className="text-xs text-[#a1a1aa] mt-1">Tải video lên từ tab Kịch bản bên phải</p>
          </div>
        )}

        {/* TTS Audio Player (Dual-Media Sync master clock in preview mode) */}
        {ttsAudioSrc && (
          <audio
            ref={ttsAudioRef}
            src={ttsAudioSrc}
            preload="auto"
            muted={isMuted}
            onTimeUpdate={handleTtsTimeUpdate}
            onEnded={handleTtsEnded}
          />
        )}

        {/* Background Music Audio Player */}
        {bgMusicSrc && (
          <audio
            ref={bgMusicRef}
            src={bgMusicSrc}
            preload="auto"
            muted={isMuted}
            loop
          />
        )}

        {/* Real-time Subtitle Karaoke HTML/CSS Overlay (Scaled 1:1 with FFmpeg ASS) */}
        {activeWordGroup && (
          <div
            className={`absolute left-0 right-0 px-4 flex ${
              style?.alignment === 'left'
                ? 'justify-start pl-6'
                : style?.alignment === 'right'
                ? 'justify-end pr-6'
                : 'justify-center'
            } pointer-events-none transition-all duration-75 z-20`}
            style={positionStyle}
          >
            <div
              className="tracking-wide select-none max-w-[92%]"
              style={{
                fontFamily: style?.fontFamily || 'Be Vietnam Pro',
                fontSize: `${scaledFontSize}px`,
                fontWeight,
                textShadow,
                lineHeight: 1.25,
                textAlign: style?.alignment || 'center',
              }}
            >
              {activeWordGroup.map((w, idx) => {
                const isWordHighlighted =
                  highlightEnabled && currentMs >= w.start && currentMs <= w.end;
                const isWordPast = highlightEnabled && currentMs > w.end;
                const color = isWordHighlighted || isWordPast ? highlightColor : primaryColor;

                return (
                  <span
                    key={idx}
                    style={{
                      color,
                      transform: isWordHighlighted ? 'scale(1.08)' : 'scale(1)',
                      display: 'inline-block',
                      transition: 'transform 0.08s ease, color 0.08s ease',
                    }}
                    className="mx-1"
                  >
                    {w.word}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Video Controls Bar */}
      <div className="w-full bg-[#18181b] border-t border-[#3f3f46] p-3 flex flex-col gap-2">
        {/* Scrubber Range */}
        <input
          type="range"
          min={0}
          max={totalDuration}
          step={0.05}
          value={Math.min(totalDuration, currentTime)}
          onChange={(e) => handleSeek(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-[#3f3f46] rounded-lg appearance-none cursor-pointer accent-[#f97316]"
        />

        <div className="flex items-center justify-between text-xs text-[#a1a1aa]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlay}
              className="p-1.5 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-white transition-colors"
              title={isPlaying ? 'Tạm dừng' : 'Phát'}
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4 fill-current text-[#f97316]" />
              )}
            </button>

            <button
              type="button"
              onClick={handleRestart}
              className="p-1.5 rounded-lg hover:bg-[#27272a] text-[#a1a1aa] hover:text-white transition-colors"
              title="Phát lại từ đầu"
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            <span className="font-mono text-[11px] ml-1 text-white">
              {formatDuration(currentTime)} / {formatDuration(totalDuration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {bgMusicSrc && (
              <span
                className="text-[10px] text-[#22c55e] flex items-center gap-1 font-mono bg-[#22c55e]/10 px-1.5 py-0.5 rounded"
                title="Nhạc nền đang bật"
              >
                <Music className="h-3 w-3" />
                <span>BGM</span>
              </span>
            )}

            <button
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              className="p-1.5 rounded-lg hover:bg-[#27272a] text-[#a1a1aa] hover:text-white transition-colors"
              title={isMuted ? 'Bật âm thanh' : 'Tắt tiếng'}
            >
              {isMuted ? <VolumeX className="h-4 w-4 text-[#ef4444]" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
