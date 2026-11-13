'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Film,
  Mic,
  Music,
} from 'lucide-react';
import { useEditorStore } from '@/stores/editorStore';
import { formatDuration } from '@/lib/utils';

export function Timeline() {
  const {
    project,
    currentTime,
    isPlaying,
    duration,
    setIsPlaying,
    seekTo,
  } = useEditorStore();

  const trackRef = useRef<HTMLDivElement>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<{ pct: number; time: number } | null>(null);

  const videoDuration = project?.video?.duration || 0;
  const audioDuration = project?.tts?.audioDuration || 0;
  const subtitleEnabled = Boolean(project && project.subtitle?.enabled !== false);
  const effectiveDuration = Math.max(duration, audioDuration, videoDuration, 1);

  const loopCount = useMemo(() => {
    if (videoDuration <= 0 || audioDuration <= videoDuration) return 1;
    return Math.ceil(audioDuration / videoDuration);
  }, [audioDuration, videoDuration]);

  const progressPct = Math.min(100, Math.max(0, (currentTime / effectiveDuration) * 100));

  const computeTimeAtClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return { pct: 0, time: 0 };
      const rect = el.getBoundingClientRect();
      const pct = Math.min(1, Math.max(0, (clientX - rect.left) / Math.max(rect.width, 1)));
      return {
        pct: pct * 100,
        time: pct * effectiveDuration,
      };
    },
    [effectiveDuration]
  );

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) {
        return;
      }
      const info = computeTimeAtClientX(e.clientX);
      setHoverInfo(info);
      seekTo(info.time);
    };
    const onEnd = (e: PointerEvent) => {
      if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) {
        return;
      }
      activePointerIdRef.current = null;
      setDragging(false);
      if (e.pointerType !== 'mouse' || e.type === 'pointercancel') {
        setHoverInfo(null);
      } else if (trackRef.current) {
        const rect = trackRef.current.getBoundingClientRect();
        const inside =
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom;
        if (!inside) {
          setHoverInfo(null);
        }
      }
    };
    const onBlur = () => {
      activePointerIdRef.current = null;
      setDragging(false);
      setHoverInfo(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
      window.removeEventListener('blur', onBlur);
    };
  }, [computeTimeAtClientX, dragging, seekTo]);

  const handleTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    activePointerIdRef.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture is unsupported in this environment
    }
    const info = computeTimeAtClientX(e.clientX);
    setHoverInfo(info);
    seekTo(info.time);
    setDragging(true);
  };

  const wordMarkers = useMemo(() => {
    if (!subtitleEnabled) return [];
    const words = project?.subtitle?.words || [];
    if (words.length === 0 || audioDuration <= 0) return [];
    const step = Math.max(1, Math.floor(words.length / 48));
    const sampled: number[] = [];
    for (let i = 0; i < words.length; i += step) {
      const pct = ((words[i].start / 1000) / Math.max(audioDuration, 0.1)) * 100;
      if (pct >= 0 && pct <= 100) sampled.push(pct);
    }
    return sampled;
  }, [audioDuration, project?.subtitle?.words, subtitleEnabled]);

  return (
    <div className="shrink-0 border-t border-white/[0.08] bg-[#111113] px-3 py-2 select-none">
      {/* Control bar */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => seekTo(Math.max(0, currentTime - 5))}
            aria-label="Lùi 5 giây"
            title="Lùi 5 giây"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#a1a1aa] hover:bg-white/[0.06] hover:text-white cursor-pointer"
          >
            <SkipBack className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            aria-label={isPlaying ? 'Tạm dừng (Space)' : 'Phát thử (Space)'}
            title={isPlaying ? 'Tạm dừng (Phím Space)' : 'Phát thử (Phím Space)'}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-[#f97316] text-black hover:bg-[#ea580c] cursor-pointer"
          >
            {isPlaying ? (
              <Pause className="h-3.5 w-3.5 fill-current" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => seekTo(Math.min(effectiveDuration, currentTime + 5))}
            aria-label="Tua tới 5 giây"
            title="Tua tới 5 giây"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#a1a1aa] hover:bg-white/[0.06] hover:text-white cursor-pointer"
          >
            <SkipForward className="h-3.5 w-3.5" />
          </button>

          <span className="ml-1.5 font-mono text-[11px] font-semibold text-[#fafafa] tabular-nums">
            {formatDuration(currentTime)}
            <span className="text-[#9ca3af] font-normal"> / {formatDuration(effectiveDuration)}</span>
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-[10px] text-[#9ca3af]">
          {loopCount > 1 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 border border-amber-500/25 px-2 py-0.5 text-amber-300">
              <Repeat className="h-2.5 w-2.5" />
              Video lặp x{loopCount} khớp giọng đọc
            </span>
          )}
          {project?.bgMusic?.path && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.05] px-2 py-0.5 text-[#a1a1aa]">
              <Music className="h-2.5 w-2.5 text-[#f97316]" />
              {project.bgMusic.name}
            </span>
          )}
        </div>
      </div>

      {/* Multi-track scrubber */}
      <div
        ref={trackRef}
        role="slider"
        aria-label="Thanh thời gian video"
        aria-valuemin={0}
        aria-valuemax={Math.round(effectiveDuration)}
        aria-valuenow={Math.round(currentTime)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            seekTo(Math.min(effectiveDuration, currentTime + 2));
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            seekTo(Math.max(0, currentTime - 2));
          } else if (e.key === 'Home') {
            e.preventDefault();
            seekTo(0);
          } else if (e.key === 'End') {
            e.preventDefault();
            seekTo(effectiveDuration);
          }
        }}
        onPointerDown={handleTrackPointerDown}
        onPointerMove={(e) => {
          if (e.pointerType === 'mouse' && !dragging) {
            setHoverInfo(computeTimeAtClientX(e.clientX));
          }
        }}
        onPointerLeave={() => !dragging && setHoverInfo(null)}
        className="relative flex flex-col gap-1 rounded-lg bg-[#09090b] border border-white/[0.08] p-1.5 cursor-pointer touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f97316]"
      >
        {/* Hover time tooltip */}
        {hoverInfo && (
          <div
            className="pointer-events-none absolute -top-6 z-20 -translate-x-1/2 rounded bg-[#27272a] border border-white/[0.15] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white shadow tabular-nums"
            style={{ left: `${hoverInfo.pct}%` }}
          >
            {formatDuration(hoverInfo.time)}
          </div>
        )}

        {/* Track 1: Video / B-roll loops */}
        <div className="relative h-4 w-full overflow-hidden rounded bg-[#18181b] flex items-center">
          {videoDuration > 0 ? (
            Array.from({ length: loopCount }).map((_, idx) => {
              const startSec = idx * videoDuration;
              const segDuration = Math.min(videoDuration, effectiveDuration - startSec);
              const widthPct = Math.max(0, (segDuration / effectiveDuration) * 100);
              return (
                <div
                  key={idx}
                  style={{ width: `${widthPct}%` }}
                  className="h-full border-r border-dashed border-white/25 bg-blue-500/20 px-1.5 flex items-center gap-1 overflow-hidden"
                >
                  <Film className="h-2.5 w-2.5 text-blue-300 shrink-0" />
                  <span className="truncate text-[9px] text-blue-200 font-medium">
                    {idx === 0 ? 'Video gốc' : `Lặp #${idx + 1}`}
                  </span>
                </div>
              );
            })
          ) : (
            <span className="px-2 text-[9px] text-[#9ca3af]">Chưa có video gốc</span>
          )}
        </div>

        {/* Track 2: Voice & Subtitle ticks */}
        <div className="relative h-4 w-full overflow-hidden rounded bg-[#18181b] flex items-center">
          {audioDuration > 0 ? (
            <div
              style={{ width: `${Math.min(100, (audioDuration / effectiveDuration) * 100)}%` }}
              className="relative h-full bg-[#f97316]/20 border-r border-[#f97316]/50 px-1.5 flex items-center gap-1"
            >
              <Mic className="h-2.5 w-2.5 text-[#fb923c] shrink-0 z-10" />
              <span className="text-[9px] text-[#fed7aa] font-medium z-10 truncate">
                {subtitleEnabled ? 'Giọng đọc & Phụ đề' : 'Giọng đọc (Đã tắt phụ đề)'}
              </span>
              {subtitleEnabled &&
                wordMarkers.map((pct, i) => (
                  <span
                    key={i}
                    style={{ left: `${pct}%` }}
                    className="pointer-events-none absolute bottom-0 top-1.5 w-[1px] bg-[#ffd700]/45"
                  />
                ))}
            </div>
          ) : (
            <span className="px-2 text-[9px] text-[#9ca3af]">Chưa có giọng đọc</span>
          )}
        </div>

        {/* Playhead line */}
        <div
          className="pointer-events-none absolute top-0 bottom-0 z-10 w-[2px] bg-[#f97316]"
          style={{ left: `calc(${progressPct}% - 1px)` }}
        >
          <div className="absolute -top-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-[#f97316] ring-2 ring-[#09090b]" />
        </div>
      </div>
    </div>
  );
}
