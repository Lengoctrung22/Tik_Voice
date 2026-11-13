'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  Play,
  Square,
  Loader2,
  BookOpen,
  Upload,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { useEditorStore } from '@/stores/editorStore';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { SUPPORTED_VOICES } from '@/lib/tts/voices';
import { PRONUNCIATION_EXAMPLES } from '@/lib/tts/pronunciation';
import { formatDuration, resolveMediaUrl } from '@/lib/utils';
import { MAX_AUDIO_UPLOAD_BYTES } from '@/lib/validation/schemas';
import type { ProjectDTO, Voice } from '@/types';

export function TTSPanel() {
  const { project, updateProjectPartial, setActiveTab } = useEditorStore();

  const [selectedVoice, setSelectedVoice] = useState(
    project?.tts?.voice || 'vi-VN-HoaiMyNeural'
  );
  const [selectedEngine, setSelectedEngine] = useState<'edge' | 'google'>(
    project?.tts?.engine || 'edge'
  );
  const [speed, setSpeed] = useState(project?.tts?.speed ?? 1.0);
  const [pitch, setPitch] = useState(project?.tts?.pitch ?? 0);
  const [applyPronunciation, setApplyPronunciation] = useState(true);
  const [showPronunciationGuide, setShowPronunciationGuide] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  const [customVoiceOpen, setCustomVoiceOpen] = useState(false);
  const [uploadingCustomVoice, setUploadingCustomVoice] = useState(false);

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const customVoiceInputRef = useRef<HTMLInputElement>(null);

  // Sync local controls when project loads/updates
  useEffect(() => {
    if (project?.tts) {
      setSelectedVoice(project.tts.voice || 'vi-VN-HoaiMyNeural');
      setSelectedEngine(project.tts.engine || 'edge');
      setSpeed(project.tts.speed ?? 1.0);
      setPitch(project.tts.pitch ?? 0);
    }
  }, [project?.tts]);

  // Stop voice preview audio when leaving TTSPanel
  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
    };
  }, []);

  const stopPreviewAudio = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    setPlayingVoiceId(null);
  };

  const handleSelectVoice = (voice: Voice) => {
    setSelectedVoice(voice.id);
    setSelectedEngine(voice.engine);
    updateProjectPartial({
      tts: {
        ...project?.tts,
        voice: voice.id,
        engine: voice.engine,
        speed,
        pitch,
      },
    });
  };

  const handlePreviewVoice = async (voice: Voice, e: React.MouseEvent) => {
    e.stopPropagation();

    if (playingVoiceId === voice.id) {
      stopPreviewAudio();
      return;
    }

    stopPreviewAudio();
    setPreviewingVoiceId(voice.id);

    try {
      const sampleText =
        project?.script?.text?.trim().split(/[.!?。\n]/)[0]?.trim().slice(0, 140) ||
        `Xin chào, mình là ${voice.name}. Rất vui được đồng hành cùng bạn trên TikVoice.`;

      const res = await fetch('/api/tts/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voice: voice.id,
          engine: voice.engine,
          speed,
          pitch,
          applyPronunciation,
          text: sampleText,
        }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: { url?: string; fallbackFrom?: 'google' };
        error?: string;
      };
      if (!res.ok || !json.success || !json.data?.url) {
        toast.error(json.error || 'Không thể phát thử giọng đọc');
        return;
      }

      if (json.data.fallbackFrom === 'google') {
        toast.info(
          'Chưa cấu hình khóa Google Cloud, hệ thống đã phát thử bằng giọng Edge miễn phí tương ứng.'
        );
      }

      const audio = new Audio(json.data.url);
      previewAudioRef.current = audio;
      setPlayingVoiceId(voice.id);
      audio.onended = () => setPlayingVoiceId(null);
      audio.onerror = () => setPlayingVoiceId(null);
      await audio.play();
    } catch {
      toast.error('Lỗi phát thử giọng đọc');
    } finally {
      setPreviewingVoiceId(null);
    }
  };

  const handleSynthesize = async () => {
    if (!project?._id) return;
    const text = project.script?.text?.trim();
    if (!text) {
      toast.error('Kịch bản đang trống. Hãy viết kịch bản ở bước 1 trước.');
      setActiveTab('script');
      return;
    }

    stopPreviewAudio();
    setGenerating(true);

    try {
      // Lưu kịch bản trước để đảm bảo DB đồng bộ
      await fetch(`/api/projects/${project._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: { text },
          tts: { engine: selectedEngine, voice: selectedVoice, speed, pitch },
        }),
      });

      const res = await fetch(`/api/projects/${project._id}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voice: selectedVoice,
          engine: selectedEngine,
          speed,
          pitch,
          applyPronunciation,
        }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: {
          project?: ProjectDTO;
          duration?: number;
          fallbackFrom?: 'google';
          actualVoice?: string;
        };
        error?: string;
      };

      if (!res.ok || !json.success || !json.data?.project) {
        toast.error(json.error || 'Tạo giọng đọc thất bại');
        return;
      }

      updateProjectPartial(json.data.project, false);
      if (json.data.fallbackFrom === 'google') {
        toast.warning(
          'Chưa cấu hình Google Cloud TTS, hệ thống đã tự động chuyển sang giọng miễn phí tương ứng.'
        );
      } else {
        toast.success(`Đã tạo giọng đọc (${formatDuration(json.data.duration || 0)}) và khớp phụ đề!`);
      }
    } catch {
      toast.error('Lỗi kết nối khi tạo giọng đọc');
    } finally {
      setGenerating(false);
    }
  };

  const handleUploadCustomVoice = async (file: File) => {
    if (!project?._id) return;
    if (file.size > MAX_AUDIO_UPLOAD_BYTES) {
      toast.error('Tệp âm thanh vượt quá 50MB.');
      return;
    }

    setUploadingCustomVoice(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', 'voice');
      fd.append('projectId', project._id);

      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = (await res.json()) as {
        success: boolean;
        data?: { project?: ProjectDTO };
        error?: string;
      };
      if (!res.ok || !json.success || !json.data?.project) {
        toast.error(json.error || 'Tải giọng thu âm thất bại');
        return;
      }
      updateProjectPartial(json.data.project, false);
      toast.success('Đã tải giọng tự thu âm lên dự án');
    } catch {
      toast.error('Lỗi kết nối khi tải giọng thu âm');
    } finally {
      setUploadingCustomVoice(false);
    }
  };

  const currentAudioUrl = resolveMediaUrl(project?.tts?.audioPath);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-bold text-[#fafafa]">2. Giọng đọc AI (Text-to-Speech)</h2>
        <p className="text-[11px] text-[#9ca3af]">
          Chọn giọng đọc tự nhiên và nghe thử trước khi tạo toàn bộ video
        </p>
      </div>

      {/* Voice Cards */}
      <div className="space-y-2">
        {SUPPORTED_VOICES.map((v) => {
          const isSelected = selectedVoice === v.id;
          const isLoadingPreview = previewingVoiceId === v.id;
          const isPlayingPreview = playingVoiceId === v.id;

          return (
            <div
              key={v.id}
              role="button"
              tabIndex={0}
              onClick={() => handleSelectVoice(v)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSelectVoice(v);
                }
              }}
              className={`flex items-center justify-between gap-2.5 rounded-lg border p-2.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f97316] ${
                isSelected
                  ? 'border-[#f97316]/60 bg-[#f97316]/10'
                  : 'border-white/[0.08] bg-[#18181b] hover:border-white/[0.16]'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold text-[#fafafa]">{v.name}</span>
                  <span className="rounded-full bg-white/[0.07] px-1.5 py-0.5 text-[9px] font-medium text-[#d4d4d8]">
                    {v.region}
                  </span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                      v.tier === 'free'
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'bg-amber-500/15 text-amber-300'
                    }`}
                  >
                    {v.tier === 'free' ? 'Miễn phí' : 'Google Cloud'}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-[#a1a1aa] line-clamp-1">{v.description}</p>
              </div>

              <button
                type="button"
                onClick={(e) => handlePreviewVoice(v, e)}
                disabled={isLoadingPreview}
                aria-label={isPlayingPreview ? `Dừng nghe thử ${v.name}` : `Nghe thử ${v.name}`}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  isPlayingPreview
                    ? 'border-[#f97316] bg-[#f97316] text-black'
                    : 'border-white/[0.1] bg-[#09090b] text-[#d4d4d8] hover:border-[#f97316]/50 hover:text-white'
                }`}
              >
                {isLoadingPreview ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : isPlayingPreview ? (
                  <Square className="h-3 w-3 fill-current" />
                ) : (
                  <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Speed & Pitch */}
      <div className="space-y-3 rounded-lg border border-white/[0.08] bg-[#18181b] p-3">
        <Slider
          label="Tốc độ đọc"
          min={0.75}
          max={1.5}
          step={0.05}
          defaultResetValue={1.0}
          value={speed}
          valueDisplay={`${speed.toFixed(2)}x`}
          onChange={(val) => {
            setSpeed(val);
            updateProjectPartial({
              tts: { ...project?.tts, voice: selectedVoice, engine: selectedEngine, speed: val, pitch },
            });
          }}
        />

        <Slider
          label="Cao độ giọng"
          min={-10}
          max={10}
          step={1}
          defaultResetValue={0}
          value={pitch}
          valueDisplay={`${pitch > 0 ? `+${pitch}` : pitch} Hz`}
          onChange={(val) => {
            setPitch(val);
            updateProjectPartial({
              tts: { ...project?.tts, voice: selectedVoice, engine: selectedEngine, speed, pitch: val },
            });
          }}
        />

        {/* Pronunciation helper toggle */}
        <div className="pt-2 border-t border-white/[0.06] space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-medium text-[#fafafa]">
                Chuẩn hóa phát âm thuật ngữ
              </div>
              <div className="text-[10px] text-[#9ca3af]">
                Đọc đúng từ tiếng Anh & đơn vị, phụ đề vẫn giữ chữ gốc
              </div>
            </div>
            <Switch
              checked={applyPronunciation}
              onCheckedChange={setApplyPronunciation}
              ariaLabel="Bật chuẩn hóa phát âm"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowPronunciationGuide(!showPronunciationGuide)}
            className="inline-flex items-center gap-1 text-[11px] text-[#f97316] hover:underline cursor-pointer"
          >
            <BookOpen className="h-3 w-3" />
            <span>{showPronunciationGuide ? 'Ẩn ví dụ phiên âm' : 'Xem ví dụ từ điển phiên âm'}</span>
          </button>

          {showPronunciationGuide && (
            <div className="grid grid-cols-2 gap-1.5 rounded-md bg-[#09090b] border border-white/[0.06] p-2">
              {PRONUNCIATION_EXAMPLES.map((ex) => (
                <div key={ex.raw} className="text-[10px] text-[#a1a1aa]">
                  <span className="font-semibold text-white">{ex.raw}</span>:{' '}
                  <span className="italic">{ex.spoken}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Primary action */}
      <Button
        onClick={handleSynthesize}
        disabled={generating}
        className="w-full h-10 gap-2"
      >
        {generating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
        <span>{generating ? 'Đang tổng hợp giọng đọc...' : 'Tạo giọng đọc & khớp phụ đề'}</span>
      </Button>

      {currentAudioUrl && (
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3 space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-emerald-300 flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" />
              {project?.tts?.isCustomAudio ? 'Đang dùng giọng tự thu âm' : 'Đã tạo file giọng đọc'}
            </span>
            <span className="font-mono text-emerald-200 tabular-nums">
              {formatDuration(project?.tts?.audioDuration || 0)}
            </span>
          </div>
          <audio controls src={currentAudioUrl} className="w-full h-8" />
        </div>
      )}

      {/* Custom voice upload */}
      <div className="rounded-lg border border-white/[0.08] bg-[#18181b] overflow-hidden">
        <button
          type="button"
          onClick={() => setCustomVoiceOpen(!customVoiceOpen)}
          className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-[#d4d4d8] hover:bg-white/[0.03] cursor-pointer"
        >
          <span>Hoặc tải giọng tự thu âm (MP3 / WAV / M4A)</span>
          {customVoiceOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {customVoiceOpen && (
          <div className="border-t border-white/[0.08] p-3 space-y-2">
            <p className="text-[11px] text-[#9ca3af]">
              Nếu bạn tự thu giọng bằng micro, hãy tải lên đây. Hệ thống sẽ căn thời gian phụ đề theo kịch bản hiện tại.
            </p>
            <input
              ref={customVoiceInputRef}
              type="file"
              accept="audio/mpeg,audio/wav,audio/mp4,audio/ogg,.mp3,.wav,.m4a,.ogg"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUploadCustomVoice(f);
                e.target.value = '';
              }}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={uploadingCustomVoice}
              onClick={() => customVoiceInputRef.current?.click()}
              className="w-full gap-1.5"
            >
              {uploadingCustomVoice ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              <span>{uploadingCustomVoice ? 'Đang tải âm thanh...' : 'Chọn tệp thu âm của bạn'}</span>
            </Button>
          </div>
        )}
      </div>

      <Button variant="outline" onClick={() => setActiveTab('subtitle')} className="w-full">
        Tiếp tục chỉnh phụ đề
      </Button>
    </div>
  );
}
