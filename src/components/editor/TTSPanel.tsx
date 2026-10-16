'use client';

import { useState, useEffect } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { Voice } from '@/types';
import { Play, Volume2, Mic, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDuration } from '@/lib/utils';

export function TTSPanel() {
  const { project, updateProjectPartial, setActiveTab } = useEditorStore();

  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState(
    project?.tts?.voice || 'vi-VN-HoaiMyNeural'
  );
  const [speed, setSpeed] = useState<number>(project?.tts?.speed ?? 1.0);
  const [pitch, setPitch] = useState<number>(project?.tts?.pitch ?? 0);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  useEffect(() => {
    fetch('/api/tts/voices')
      .then((res) => res.json())
      .then((res) => {
        if (res.success && res.data) {
          setVoices(res.data);
        }
      })
      .catch(() => {});
  }, []);

  const handlePreview = async () => {
    try {
      setIsPreviewing(true);
      const res = await fetch('/api/tts/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voice: selectedVoice,
          speed,
          pitch,
          text: 'Xin chào, đây là giọng đọc thử nghiệm chất lượng cao trên TikVoice.',
        }),
      });

      const data = await res.json();
      if (data.success && data.data?.url) {
        const audio = new Audio(data.data.url);
        audio.play().catch(() => {});
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
      toast.error('Chưa có kịch bản. Hãy viết kịch bản trước khi tạo giọng nói.');
      setActiveTab('script');
      return;
    }

    try {
      setIsSynthesizing(true);
      const res = await fetch(`/api/projects/${project._id}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voice: selectedVoice,
          speed,
          pitch,
        }),
      });

      const data = await res.json();
      if (data.success && data.data?.project) {
        toast.success(
          `Đã tạo giọng nói thành công (${formatDuration(data.data.duration)} - ${
            data.data.words?.length
          } từ)!`
        );
        updateProjectPartial(data.data.project);
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
            Lựa chọn giọng đọc truyền cảm chuẩn tiếng Việt và trích xuất nhịp điệu từng từ
          </p>
        </div>

        {project?.tts?.audioPath && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#22c55e]/10 px-2.5 py-1 text-xs font-medium text-[#22c55e]">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Đã tạo audio ({formatDuration(project.tts.audioDuration || 0)})</span>
          </span>
        )}
      </div>

      {/* Voice Selection */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-[#a1a1aa]">Giọng đọc tiếng Việt</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {voices.map((v) => {
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
                    <span className="text-[10px] text-[#71717a] uppercase">{v.gender === 'female' ? 'Nữ' : 'Nam'}</span>
                  </div>
                  <p className="text-[11px] text-[#a1a1aa] truncate mt-0.5">{v.displayName}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sliders: Speed & Pitch */}
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
          <div className="flex justify-between text-[10px] text-[#71717a] mt-1">
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
          <div className="flex justify-between text-[10px] text-[#71717a] mt-1">
            <span>-10Hz (Trầm)</span>
            <span>0 (Chuẩn)</span>
            <span>+10Hz (Cao)</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={handlePreview}
          disabled={isPreviewing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#3f3f46] bg-[#27272a] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#3f3f46] transition-colors"
        >
          {isPreviewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          <span>Nghe thử câu mẫu</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleGenerateFullSpeech}
            disabled={isSynthesizing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#f97316] px-5 py-2 text-xs font-semibold text-black hover:bg-[#ea580c] transition-colors shadow-md"
          >
            {isSynthesizing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Đang tạo giọng nói...</span>
              </>
            ) : (
              <>
                <Volume2 className="h-3.5 w-3.5" />
                <span>Tạo giọng nói đầy đủ</span>
              </>
            )}
          </button>

          {project?.tts?.audioPath && (
            <button
              type="button"
              onClick={() => setActiveTab('subtitle')}
              className="inline-flex items-center gap-1 rounded-lg border border-[#3f3f46] bg-[#27272a] px-3 py-2 text-xs font-medium text-white hover:bg-[#3f3f46] transition-colors"
            >
              <span>Phụ đề →</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
