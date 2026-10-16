'use client';

import { useState, useEffect, useMemo } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { Voice } from '@/types';
import { SUPPORTED_VOICES } from '@/lib/tts/voices';
import { Play, Volume2, Mic, Loader2, CheckCircle2, Zap, Cloud, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { formatDuration } from '@/lib/utils';

export function TTSPanel() {
  const { project, updateProjectPartial, setActiveTab, setDuration, updateWords } = useEditorStore();

  const [engine, setEngine] = useState<'edge' | 'google'>(project?.tts?.engine || 'edge');
  const [voices, setVoices] = useState<Voice[]>(SUPPORTED_VOICES);
  const [selectedVoice, setSelectedVoice] = useState(
    project?.tts?.voice || 'vi-VN-HoaiMyNeural'
  );
  const [speed, setSpeed] = useState<number>(project?.tts?.speed ?? 1.0);
  const [pitch, setPitch] = useState<number>(project?.tts?.pitch ?? 0);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  // Fetch voice list
  useEffect(() => {
    fetch('/api/tts/voices')
      .then((res) => res.json())
      .then((res) => {
        if (res.success && res.data && res.data.length > 0) {
          setVoices(res.data);
        }
      })
      .catch(() => {});
  }, []);

  // Sync state when project loads or updates
  useEffect(() => {
    if (project?.tts) {
      if (project.tts.engine) setEngine(project.tts.engine);
      if (project.tts.voice) setSelectedVoice(project.tts.voice);
      if (typeof project.tts.speed === 'number') setSpeed(project.tts.speed);
      if (typeof project.tts.pitch === 'number') setPitch(project.tts.pitch);
    }
  }, [project?.tts]);

  // Filter voices by selected engine
  const filteredVoices = useMemo(() => {
    return voices.filter((v) => v.engine === engine);
  }, [voices, engine]);

  // If engine changes and current voice doesn't belong to it, select first voice
  const handleEngineChange = (newEngine: 'edge' | 'google') => {
    setEngine(newEngine);
    const available = voices.filter((v) => v.engine === newEngine);
    if (available.length > 0 && !available.some((v) => v.id === selectedVoice)) {
      setSelectedVoice(available[0].id);
    }
  };

  const handlePreview = async () => {
    try {
      setIsPreviewing(true);
      const res = await fetch('/api/tts/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voice: selectedVoice,
          engine,
          speed,
          pitch,
          text: 'Xin chào, đây là giọng đọc thử nghiệm chất lượng cao trên TikVoice Studio.',
        }),
      });

      const data = await res.json();
      if (data.success && data.data?.url) {
        const audio = new Audio(data.data.url);
        audio.play().catch(() => {});
        toast.success('Đang phát giọng đọc thử nghiệm');
      } else {
        toast.error(data.error || 'Nghe thử giọng thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối máy chủ giọng nói');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleGenerateFullSpeech = async () => {
    if (!project?._id) return;
    if (!project.script?.text?.trim()) {
      toast.error('Chưa có kịch bản. Hãy viết hoặc tạo kịch bản ở tab Kịch bản trước.');
      setActiveTab('script');
      return;
    }

    try {
      setIsSynthesizing(true);
      const res = await fetch(`/api/projects/${project._id}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engine,
          voice: selectedVoice,
          speed,
          pitch,
        }),
      });

      const data = await res.json();
      if (data.success && data.data?.project) {
        toast.success(
          `Tạo giọng nói thành công (${formatDuration(data.data.duration)} - ${
            data.data.words?.length || 0
          } từ)!`
        );
        updateProjectPartial(data.data.project);
        if (data.data.words) {
          updateWords(data.data.words);
        }
        setDuration(data.data.duration);
      } else {
        toast.error(data.error || 'Tạo giọng nói thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối khi tổng hợp giọng nói');
    } finally {
      setIsSynthesizing(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 p-4 text-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-white">Cấu Hình Text-to-Speech (TTS)</h3>
          <p className="text-xs text-[#a1a1aa] mt-0.5">
            Lựa chọn engine và giọng đọc truyền cảm, trích xuất chính xác nhịp điệu từng từ
          </p>
        </div>

        {project?.tts?.audioPath && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#22c55e]/15 px-2.5 py-1 text-xs font-semibold text-[#22c55e] border border-[#22c55e]/30">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Đã tạo audio ({formatDuration(project.tts.audioDuration || 0)})</span>
          </span>
        )}
      </div>

      {/* Engine Selection: Edge (Free) vs Google (Premium) */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-[#a1a1aa]">Công nghệ chuyển văn bản thành giọng nói</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleEngineChange('edge')}
            className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all ${
              engine === 'edge'
                ? 'border-[#f97316] bg-[#431407]/40 shadow-sm'
                : 'border-[#3f3f46] bg-[#09090b] hover:bg-[#27272a]'
            }`}
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                engine === 'edge' ? 'bg-[#f97316] text-black' : 'bg-[#27272a] text-[#a1a1aa]'
              }`}
            >
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <p className="font-semibold text-xs text-white">Microsoft Edge TTS</p>
              <p className="text-[11px] text-[#22c55e] mt-0.5 font-medium">Miễn phí • Tự nhiên</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleEngineChange('google')}
            className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all ${
              engine === 'google'
                ? 'border-[#f97316] bg-[#431407]/40 shadow-sm'
                : 'border-[#3f3f46] bg-[#09090b] hover:bg-[#27272a]'
            }`}
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                engine === 'google' ? 'bg-[#f97316] text-black' : 'bg-[#27272a] text-[#a1a1aa]'
              }`}
            >
              <Cloud className="h-4 w-4" />
            </div>
            <div>
              <p className="font-semibold text-xs text-white">Google Cloud TTS</p>
              <p className="text-[11px] text-blue-400 mt-0.5 font-medium">WaveNet / Neural2</p>
            </div>
          </button>
        </div>
      </div>

      {/* Voice Selection */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-[#a1a1aa]">
          Giọng đọc tiếng Việt ({filteredVoices.length} giọng sẵn sàng)
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {filteredVoices.map((v) => {
            const isSelected = selectedVoice === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedVoice(v.id)}
                className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                  isSelected
                    ? 'border-[#f97316] bg-[#431407]/40 shadow-sm'
                    : 'border-[#3f3f46] bg-[#09090b] hover:bg-[#27272a]'
                }`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    isSelected ? 'bg-[#f97316] text-black' : 'bg-[#27272a] text-[#a1a1aa]'
                  }`}
                >
                  <Mic className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-xs text-white truncate">{v.name}</p>
                    <span className="text-[10px] text-[#71717a] uppercase font-mono">
                      {v.gender === 'female' ? 'Nữ' : 'Nam'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#a1a1aa] truncate mt-0.5">{v.displayName}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sliders: Speed (0.75x - 1.5x) & Pitch (-10Hz - +10Hz) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-[#3f3f46] bg-[#09090b] p-4">
        <div>
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-[#a1a1aa]">Tốc độ đọc (Speed)</span>
            <span className="font-mono text-white font-semibold">{speed}x</span>
          </div>
          <input
            type="range"
            min={0.75}
            max={1.5}
            step={0.05}
            value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-[#27272a] rounded-lg appearance-none cursor-pointer accent-[#f97316]"
          />
          <div className="flex justify-between text-[10px] text-[#71717a] mt-1 font-mono">
            <span>0.75x</span>
            <span>1.0x (Chuẩn)</span>
            <span>1.5x</span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-[#a1a1aa]">Cao độ (Pitch)</span>
            <span className="font-mono text-white font-semibold">
              {pitch >= 0 ? `+${pitch}Hz` : `${pitch}Hz`}
            </span>
          </div>
          <input
            type="range"
            min={-10}
            max={10}
            step={1}
            value={pitch}
            onChange={(e) => setPitch(parseInt(e.target.value, 10))}
            className="w-full h-1.5 bg-[#27272a] rounded-lg appearance-none cursor-pointer accent-[#f97316]"
          />
          <div className="flex justify-between text-[10px] text-[#71717a] mt-1 font-mono">
            <span>-10 (Trầm)</span>
            <span>0 (Chuẩn)</span>
            <span>+10 (Cao)</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={handlePreview}
          disabled={isPreviewing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#3f3f46] bg-[#27272a] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#3f3f46] transition-colors"
        >
          {isPreviewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          <span>Nghe thử câu mẫu</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleGenerateFullSpeech}
            disabled={isSynthesizing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#f97316] px-5 py-2 text-xs font-bold text-black hover:bg-[#ea580c] transition-colors shadow-md"
          >
            {isSynthesizing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Đang tạo giọng nói...</span>
              </>
            ) : (
              <>
                <Volume2 className="h-3.5 w-3.5" />
                <span>Tạo giọng nói</span>
              </>
            )}
          </button>

          {project?.tts?.audioPath && (
            <button
              type="button"
              onClick={() => setActiveTab('subtitle')}
              className="inline-flex items-center gap-1 rounded-lg border border-[#3f3f46] bg-[#27272a] px-3 py-2 text-xs font-semibold text-white hover:bg-[#3f3f46] transition-colors"
            >
              <span>Phụ đề →</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
