'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { formatDuration } from '@/lib/utils';
import { Film, Mic, Subtitles, Music } from 'lucide-react';

export function Timeline() {
  const { project, currentTime, seekTo, duration } = useEditorStore();
  const trackContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const totalDuration = Math.max(
    1,
    duration || project?.video?.duration || project?.tts?.audioDuration || 30
  );

  const videoDuration = project?.video?.duration || 0;
  const audioDuration = project?.tts?.audioDuration || 0;
  const bgMusicDuration = project?.bgMusic?.path ? totalDuration : 0;
  const subtitleDuration = project?.subtitle?.words?.length
    ? audioDuration ||
      (project.subtitle.words[project.subtitle.words.length - 1]?.end || 0) / 1000
    : 0;

  const currentPercent = Math.min(100, Math.max(0, (currentTime / totalDuration) * 100));

  const seekFromPointer = useCallback(
    (clientX: number) => {
      if (!trackContainerRef.current) return;
      const rect = trackContainerRef.current.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const clickPercent = Math.max(0, Math.min(1, clickX / rect.width));
      seekTo(clickPercent * totalDuration);
    },
    [seekTo, totalDuration]
  );

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    seekFromPointer(e.clientX);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        seekFromPointer(e.clientX);
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, seekFromPointer]);

  return (
    <div className="w-full bg-[#18181b] border-t border-[#3f3f46] p-4 flex flex-col gap-2 select-none z-20">
      <div className="flex items-center justify-between text-xs text-[#a1a1aa] mb-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white text-xs">Timeline Đa Rãnh (Multi-Track)</span>
          <span className="text-[10px] text-[#71717a] hidden sm:inline">
            (Nhấp hoặc kéo chuột trên các rãnh để tua thời gian phát)
          </span>
        </div>
        <span className="font-mono text-[11px] text-white bg-[#09090b] px-2 py-0.5 rounded border border-[#3f3f46]">
          {formatDuration(currentTime)} / {formatDuration(totalDuration)}
        </span>
      </div>

      {/* Main Track Row Container: Left Labels + Right Interactive Tracks */}
      <div className="flex gap-3 w-full bg-[#09090b] rounded-xl border border-[#3f3f46]/80 p-3">
        {/* Left Track Labels Column */}
        <div className="flex flex-col gap-2 w-20 sm:w-24 shrink-0 text-xs justify-between py-0.5">
          <div className="h-6 flex items-center gap-1.5 text-[#a1a1aa] text-[10px] sm:text-[11px] font-medium">
            <Film className="h-3.5 w-3.5 text-blue-400 shrink-0" />
            <span className="truncate">Video gốc</span>
          </div>
          <div className="h-6 flex items-center gap-1.5 text-[#a1a1aa] text-[10px] sm:text-[11px] font-medium">
            <Mic className="h-3.5 w-3.5 text-[#f97316] shrink-0" />
            <span className="truncate">Giọng đọc</span>
          </div>
          <div className="h-6 flex items-center gap-1.5 text-[#a1a1aa] text-[10px] sm:text-[11px] font-medium">
            <Subtitles className="h-3.5 w-3.5 text-purple-400 shrink-0" />
            <span className="truncate">Phụ đề</span>
          </div>
          <div className="h-6 flex items-center gap-1.5 text-[#a1a1aa] text-[10px] sm:text-[11px] font-medium">
            <Music className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">Nhạc nền</span>
          </div>
        </div>

        {/* Right Interactive Multi-Track Area with Playhead */}
        <div
          ref={trackContainerRef}
          onMouseDown={handleMouseDown}
          className="relative flex-1 flex flex-col gap-2 cursor-ew-resize justify-between overflow-hidden py-0.5"
        >
          {/* Playhead Vertical Line */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-[#f97316] z-30 pointer-events-none transition-all duration-75"
            style={{ left: `${currentPercent}%` }}
          >
            <div className="h-3 w-3 -translate-x-[5px] -translate-y-1 bg-[#f97316] rotate-45 shadow-md" />
          </div>

          {/* 1. Video Track */}
          <div className="relative h-6 bg-[#27272a]/40 rounded-md overflow-hidden">
            {videoDuration > 0 && (
              <div
                className="h-full bg-blue-600/70 border border-blue-500/80 rounded flex items-center px-2 text-[10px] text-white font-medium truncate"
                style={{ width: `${Math.min(100, (videoDuration / totalDuration) * 100)}%` }}
              >
                <span>{project?.video?.fileName || 'Video gốc'} ({formatDuration(videoDuration)})</span>
              </div>
            )}
          </div>

          {/* 2. Speech Audio Track */}
          <div className="relative h-6 bg-[#27272a]/40 rounded-md overflow-hidden">
            {audioDuration > 0 && (
              <div
                className="h-full bg-[#f97316]/80 border border-[#f97316] rounded flex items-center px-2 text-[10px] text-black font-bold truncate"
                style={{ width: `${Math.min(100, (audioDuration / totalDuration) * 100)}%` }}
              >
                <span>Giọng TTS ({formatDuration(audioDuration)})</span>
              </div>
            )}
          </div>

          {/* 3. Subtitles Track */}
          <div className="relative h-6 bg-[#27272a]/40 rounded-md overflow-hidden">
            {subtitleDuration > 0 && (
              <div
                className="h-full bg-purple-600/70 border border-purple-500/80 rounded flex items-center px-2 text-[10px] text-white font-medium truncate"
                style={{ width: `${Math.min(100, (subtitleDuration / totalDuration) * 100)}%` }}
              >
                <span>Phụ đề Karaoke ({project?.subtitle?.words?.length || 0} từ)</span>
              </div>
            )}
          </div>

          {/* 4. Background Music Track */}
          <div className="relative h-6 bg-[#27272a]/40 rounded-md overflow-hidden">
            {bgMusicDuration > 0 && (
              <div
                className="h-full bg-emerald-600/70 border border-emerald-500/80 rounded flex items-center px-2 text-[10px] text-white font-medium truncate"
                style={{ width: '100%' }}
              >
                <span>{project?.bgMusic?.name || 'Nhạc nền loop'} ({Math.round((project?.bgMusic?.volume ?? 0.12) * 100)}% vol)</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
