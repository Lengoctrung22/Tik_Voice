'use client';

import { useEditorStore } from '@/stores/editorStore';
import { formatDuration } from '@/lib/utils';
import { Film, Mic, Subtitles, Music } from 'lucide-react';

export function Timeline() {
  const { project, currentTime, setCurrentTime, duration } = useEditorStore();

  const totalDuration = Math.max(
    1,
    duration || project?.video?.duration || project?.tts?.audioDuration || 30
  );

  const videoDuration = project?.video?.duration || 0;
  const audioDuration = project?.tts?.audioDuration || 0;
  const bgMusicDuration = project?.bgMusic?.path ? totalDuration : 0;
  const subtitleDuration = project?.subtitle?.words?.length ? audioDuration : 0;

  const currentPercent = Math.min(100, (currentTime / totalDuration) * 100);

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickPercent = Math.max(0, Math.min(1, clickX / rect.width));
    setCurrentTime(clickPercent * totalDuration);
  };

  return (
    <div className="w-full bg-[#18181b] border-t border-[#3f3f46] p-4 flex flex-col gap-2 select-none">
      <div className="flex items-center justify-between text-xs text-[#a1a1aa] mb-1">
        <span className="font-semibold text-white text-xs">Timeline Rãnh Âm Thanh & Video</span>
        <span className="font-mono text-[11px]">
          {formatDuration(currentTime)} / {formatDuration(totalDuration)}
        </span>
      </div>

      {/* Main Track Container with Playhead */}
      <div
        className="relative w-full bg-[#09090b] rounded-lg border border-[#3f3f46]/60 p-2.5 flex flex-col gap-1.5 cursor-pointer overflow-hidden"
        onClick={handleTrackClick}
      >
        {/* Playhead Vertical Line */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-[#f97316] z-20 pointer-events-none transition-all duration-75"
          style={{ left: `${currentPercent}%` }}
        >
          <div className="h-2 w-2 -translate-x-[3px] bg-[#f97316] rotate-45" />
        </div>

        {/* Video Track */}
        <div className="flex items-center gap-2 h-6 text-xs">
          <div className="w-16 flex items-center gap-1 text-[#71717a] text-[10px] shrink-0">
            <Film className="h-3 w-3" />
            <span>Video</span>
          </div>
          <div className="relative flex-1 h-full bg-[#27272a]/50 rounded overflow-hidden">
            {videoDuration > 0 && (
              <div
                className="h-full bg-blue-600/60 border border-blue-500/80 rounded flex items-center px-2 text-[10px] text-white truncate"
                style={{ width: `${Math.min(100, (videoDuration / totalDuration) * 100)}%` }}
              >
                <span>{project?.video?.fileName || 'Video gốc'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Speech Audio Track */}
        <div className="flex items-center gap-2 h-6 text-xs">
          <div className="w-16 flex items-center gap-1 text-[#71717a] text-[10px] shrink-0">
            <Mic className="h-3 w-3" />
            <span>Giọng đọc</span>
          </div>
          <div className="relative flex-1 h-full bg-[#27272a]/50 rounded overflow-hidden">
            {audioDuration > 0 && (
              <div
                className="h-full bg-[#f97316]/70 border border-[#f97316] rounded flex items-center px-2 text-[10px] text-white truncate"
                style={{ width: `${Math.min(100, (audioDuration / totalDuration) * 100)}%` }}
              >
                <span>Giọng đọc TTS ({formatDuration(audioDuration)})</span>
              </div>
            )}
          </div>
        </div>

        {/* Subtitles Track */}
        <div className="flex items-center gap-2 h-6 text-xs">
          <div className="w-16 flex items-center gap-1 text-[#71717a] text-[10px] shrink-0">
            <Subtitles className="h-3 w-3" />
            <span>Phụ đề</span>
          </div>
          <div className="relative flex-1 h-full bg-[#27272a]/50 rounded overflow-hidden">
            {subtitleDuration > 0 && (
              <div
                className="h-full bg-purple-600/60 border border-purple-500/80 rounded flex items-center px-2 text-[10px] text-white truncate"
                style={{ width: `${Math.min(100, (subtitleDuration / totalDuration) * 100)}%` }}
              >
                <span>Phụ đề Karaoke ({project?.subtitle?.words?.length} từ)</span>
              </div>
            )}
          </div>
        </div>

        {/* Background Music Track */}
        <div className="flex items-center gap-2 h-6 text-xs">
          <div className="w-16 flex items-center gap-1 text-[#71717a] text-[10px] shrink-0">
            <Music className="h-3 w-3" />
            <span>Nhạc nền</span>
          </div>
          <div className="relative flex-1 h-full bg-[#27272a]/50 rounded overflow-hidden">
            {bgMusicDuration > 0 && (
              <div
                className="h-full bg-emerald-600/60 border border-emerald-500/80 rounded flex items-center px-2 text-[10px] text-white truncate"
                style={{ width: '100%' }}
              >
                <span>{project?.bgMusic?.name || 'Nhạc nền loop'}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
