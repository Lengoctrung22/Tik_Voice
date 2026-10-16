'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { IWordTimestamp } from '@/types';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Maximize2 } from 'lucide-react';
import { formatDuration } from '@/lib/utils';

export function VideoPlayer() {
  const { project, currentTime, setCurrentTime, isPlaying, setIsPlaying, setDuration } =
    useEditorStore();

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isMuted, setIsMuted] = useState(false);

  const videoSrc = useMemo(() => {
    if (project?.export?.path) {
      const fileName = project.export.path.split(/[\\/]/).pop();
      return `/api/files/exports/${project._id}/${encodeURIComponent(fileName || '')}`;
    }
    if (project?.video?.path) {
      const fileName = project.video.path.split(/[\\/]/).pop();
      return `/api/files/uploads/${project._id}/${encodeURIComponent(fileName || '')}`;
    }
    return '';
  }, [project?._id, project?.video?.path, project?.export?.path]);

  const audioSrc = useMemo(() => {
    if (!project?.export?.path && project?.tts?.audioPath) {
      const fileName = project.tts.audioPath.split(/[\\/]/).pop();
      return `/api/files/audio/${project._id}/${encodeURIComponent(fileName || '')}`;
    }
    return '';
  }, [project?._id, project?.tts?.audioPath, project?.export?.path]);

  // Handle Play/Pause synchronization
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;

    if (!video) return;

    if (isPlaying) {
      video.play().catch(() => {});
      if (audio && audioSrc) {
        audio.play().catch(() => {});
      }
    } else {
      video.pause();
      if (audio) {
        audio.pause();
      }
    }
  }, [isPlaying, audioSrc]);

  // Time update sync
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const t = videoRef.current.currentTime;
      setCurrentTime(t);

      // Sync secondary audio if audio drifting exceeds 0.25s
      if (audioRef.current && audioSrc) {
        if (Math.abs(audioRef.current.currentTime - t) > 0.25) {
          audioRef.current.currentTime = t;
        }
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const d = videoRef.current.duration || project?.tts?.audioDuration || 30;
      setDuration(d);
    }
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seekTime = parseFloat(e.target.value);
    setCurrentTime(seekTime);
    if (videoRef.current) {
      videoRef.current.currentTime = seekTime;
    }
    if (audioRef.current && audioSrc) {
      audioRef.current.currentTime = seekTime;
    }
  };

  const handleRestart = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
    if (audioRef.current && audioSrc) {
      audioRef.current.currentTime = 0;
    }
    setCurrentTime(0);
    setIsPlaying(true);
  };

  // Real-time Subtitle Karaoke Calculation
  const activeWordGroup = useMemo(() => {
    const words = project?.subtitle?.words || [];
    const enabled = project?.subtitle?.enabled ?? true;
    if (!enabled || words.length === 0) return null;

    const currentMs = currentTime * 1000;
    const wordsPerGroup = project?.subtitle?.style?.wordsPerGroup || 3;

    // Build word groups
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

    // Find the group active at currentMs
    for (const g of groups) {
      const gStart = g[0].start;
      const gEnd = g[g.length - 1].end;
      // Keep group visible slightly past ending for natural reading feel
      if (currentMs >= gStart && currentMs <= gEnd + 300) {
        return g;
      }
    }

    return null;
  }, [project?.subtitle?.words, project?.subtitle?.enabled, project?.subtitle?.style?.wordsPerGroup, currentTime]);

  const style = project?.subtitle?.style;
  const highlightEnabled = style?.highlightEnabled ?? true;
  const primaryColor = style?.primaryColor || '#FFFFFF';
  const highlightColor = style?.highlightColor || '#FFD700';
  const outlineColor = style?.outlineColor || '#000000';
  const outlineWidth = style?.outlineWidth ?? 4;
  const currentMs = currentTime * 1000;

  // Text shadow generator for ASS outline effect
  const textShadow = useMemo(() => {
    const w = outlineWidth;
    return `
      -${w}px -${w}px 0 ${outlineColor},
       ${w}px -${w}px 0 ${outlineColor},
      -${w}px  ${w}px 0 ${outlineColor},
       ${w}px  ${w}px 0 ${outlineColor},
       0px -${w}px 0 ${outlineColor},
       0px  ${w}px 0 ${outlineColor},
      -${w}px  0px 0 ${outlineColor},
       ${w}px  0px 0 ${outlineColor}
    `;
  }, [outlineWidth, outlineColor]);

  const positionClass =
    style?.position === 'top'
      ? 'top-12'
      : style?.position === 'center'
      ? 'top-1/2 -translate-y-1/2'
      : 'bottom-16';

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col items-center justify-center bg-black/95 rounded-xl border border-[#3f3f46] overflow-hidden w-full max-w-[340px] sm:max-w-[380px] shadow-2xl"
    >
      {/* 9:16 Aspect Ratio Frame */}
      <div className="relative aspect-[9/16] w-full bg-black flex items-center justify-center overflow-hidden">
        {videoSrc ? (
          <video
            ref={videoRef}
            src={videoSrc}
            playsInline
            loop={!project?.export?.path} // loop video if previewing raw input
            muted={isMuted || Boolean(audioSrc)} // mute video if playing secondary TTS audio
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onClick={togglePlay}
            className="h-full w-full object-contain cursor-pointer"
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center text-[#71717a]">
            <Play className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">Chưa có video gốc</p>
            <p className="text-xs text-[#a1a1aa] mt-1">Tải video lên từ bảng điều khiển bên phải</p>
          </div>
        )}

        {/* Hidden audio player for TTS preview before export */}
        {audioSrc && <audio ref={audioRef} src={audioSrc} preload="auto" />}

        {/* Real-time Subtitle Karaoke Overlay */}
        {activeWordGroup && (
          <div
            className={`absolute left-0 right-0 px-4 flex justify-center pointer-events-none transition-all duration-75 ${positionClass}`}
          >
            <div
              className="text-center font-bold tracking-wide select-none max-w-[90%]"
              style={{
                fontFamily: style?.fontFamily || 'Be Vietnam Pro',
                fontSize: `${Math.max(18, Math.round((style?.fontSize || 64) * 0.42))}px`,
                textShadow,
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
          max={project?.video?.duration || project?.tts?.audioDuration || 30}
          step={0.05}
          value={currentTime}
          onChange={handleSeek}
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
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
            </button>

            <button
              type="button"
              onClick={handleRestart}
              className="p-1.5 rounded-lg hover:bg-[#27272a] text-[#a1a1aa] hover:text-white transition-colors"
              title="Phát lại từ đầu"
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            <span className="font-mono text-[11px] ml-1">
              {formatDuration(currentTime)} /{' '}
              {formatDuration(project?.video?.duration || project?.tts?.audioDuration || 30)}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              className="p-1.5 rounded-lg hover:bg-[#27272a] text-[#a1a1aa] hover:text-white transition-colors"
              title={isMuted ? 'Bật âm thanh' : 'Tắt tiếng'}
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
