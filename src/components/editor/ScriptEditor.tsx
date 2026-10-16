'use client';

import { useState } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { Sparkles, Save, Upload, Wand2, Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';

export function ScriptEditor() {
  const { project, updateProjectPartial, setActiveTab } = useEditorStore();
  const [scriptText, setScriptText] = useState(project?.script?.text || '');
  const [isSaving, setIsSaving] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);

  // AI Modal Form State
  const [productName, setProductName] = useState(project?.script?.productName || '');
  const [productInfo, setProductInfo] = useState(project?.script?.productInfo || '');
  const [templateId, setTemplateId] = useState(project?.script?.templateId || 'quick_review');
  const [customInstructions, setCustomInstructions] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const wordCount = scriptText.trim() ? scriptText.trim().split(/\s+/).length : 0;
  const estimatedSeconds = Math.round((wordCount / 120) * 30);

  const handleSaveScript = async () => {
    if (!project?._id) return;
    try {
      setIsSaving(true);
      const res = await fetch(`/api/projects/${project._id}/script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: scriptText }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Đã lưu kịch bản thành công');
        updateProjectPartial({
          script: {
            ...project.script,
            text: scriptText,
          },
          status: project.status === 'draft' ? 'scripted' : project.status,
        });
      } else {
        toast.error(data.error || 'Lưu kịch bản thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối khi lưu kịch bản');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateAI = async () => {
    if (!project?._id) return;
    if (!productName.trim()) {
      toast.error('Vui lòng nhập tên sản phẩm');
      return;
    }

    try {
      setIsGenerating(true);
      const res = await fetch(`/api/projects/${project._id}/script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generateWithAI: true,
          productName,
          productInfo,
          templateId,
          customInstructions,
        }),
      });
      const data = await res.json();
      if (data.success && data.data?.script?.text) {
        setScriptText(data.data.script.text);
        updateProjectPartial({
          script: data.data.script,
          status: project.status === 'draft' ? 'scripted' : project.status,
        });
        toast.success('AI đã viết kịch bản thành công!');
        setShowAiModal(false);
      } else {
        toast.error(data.error || 'AI viết kịch bản thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối tới AI API');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !project?._id) return;

    const toastId = toast.loading('Đang tải video lên...');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'video');
      formData.append('projectId', project._id);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.data?.project) {
        toast.success('Tải video lên thành công', { id: toastId });
        updateProjectPartial(data.data.project);
      } else {
        toast.error(data.error || 'Tải video thất bại', { id: toastId });
      }
    } catch {
      toast.error('Lỗi khi tải video lên', { id: toastId });
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 text-sm">
      {/* Video upload status */}
      <div className="flex items-center justify-between rounded-lg border border-[#3f3f46] bg-[#27272a]/50 p-3">
        <div>
          <p className="font-medium text-white text-xs">Video nền</p>
          <p className="text-xs text-[#a1a1aa] mt-0.5">
            {project?.video?.fileName
              ? `Tệp: ${project.video.fileName} (${project.video.duration}s)`
              : 'Chưa có video gốc. Hãy tải lên video dạng dọc TikTok 9:16.'}
          </p>
        </div>

        <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-[#3f3f46] bg-[#18181b] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#3f3f46] transition-colors">
          <Upload className="h-3.5 w-3.5 text-[#f97316]" />
          <span>{project?.video?.path ? 'Thay video' : 'Tải video lên'}</span>
          <input
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            onChange={handleVideoUpload}
            className="hidden"
          />
        </label>
      </div>

      {/* Script Header Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white">Soạn Thảo Kịch Bản</span>
          <span className="text-xs text-[#71717a]">
            ({wordCount} từ ~ {estimatedSeconds}s đọc)
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShowAiModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#431407] border border-[#f97316]/50 px-3 py-1.5 text-xs font-semibold text-[#f97316] hover:bg-[#f97316] hover:text-black transition-all shadow-sm"
        >
          <Sparkles className="h-3.5 w-3.5 fill-current" />
          <span>AI Viết Script</span>
        </button>
      </div>

      {/* Script Textarea */}
      <textarea
        value={scriptText}
        onChange={(e) => setScriptText(e.target.value)}
        placeholder="Nhập hoặc dán nội dung kịch bản lồng tiếng tại đây (khoảng 80 - 180 từ)..."
        rows={8}
        className="w-full rounded-xl border border-[#3f3f46] bg-[#09090b] p-3.5 text-sm text-white placeholder-[#71717a] focus:border-[#f97316] focus:outline-none focus:ring-1 focus:ring-[#f97316] leading-relaxed resize-none"
      />

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-1">
        <p className="text-[11px] text-[#71717a]">
          * Mẹo: Tránh emoji và ký tự đặc biệt để giọng đọc Text-to-Speech phát âm mượt mà nhất.
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveScript}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#3f3f46] bg-[#27272a] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#3f3f46] transition-colors"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            <span>Lưu kịch bản</span>
          </button>

          <button
            type="button"
            onClick={() => {
              handleSaveScript();
              setActiveTab('voice');
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#f97316] px-4 py-2 text-xs font-semibold text-black hover:bg-[#ea580c] transition-colors"
          >
            <span>Tiếp tục sang Giọng đọc →</span>
          </button>
        </div>
      </div>

      {/* AI Scriptwriter Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-[#3f3f46] bg-[#18181b] p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#3f3f46] pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#431407] text-[#f97316]">
                  <Wand2 className="h-4 w-4" />
                </span>
                <h3 className="font-bold text-white text-base">Gemini AI Viết Kịch Bản TikTok</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                className="text-[#a1a1aa] hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              <div>
                <label className="block font-medium text-white mb-1">
                  Mẫu kịch bản chuyên dụng <span className="text-[#ef4444]">*</span>
                </label>
                <select
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  className="w-full rounded-lg border border-[#3f3f46] bg-[#09090b] p-2.5 text-white focus:border-[#f97316] focus:outline-none"
                >
                  <option value="quick_review">Review nhanh 30s (Hook mạnh, ngắn gọn, CTA)</option>
                  <option value="unboxing">Mở hộp / Unboxing 45s (Tò mò, đánh giá nhanh)</option>
                  <option value="comparison">So sánh 2 sản phẩm 45s (Đấu điểm, chốt winner)</option>
                  <option value="top_list">Top 3-5 lý do nên mua 40s (Đánh trúng tâm lý, deal)</option>
                  <option value="storytelling">Kể chuyện trải nghiệm 45s (Chân thực, cảm xúc)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-white mb-1">
                  Tên sản phẩm <span className="text-[#ef4444]">*</span>
                </label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Ví dụ: Son MAC Ruby Woo, Tai nghe AirPods Pro 2..."
                  className="w-full rounded-lg border border-[#3f3f46] bg-[#09090b] p-2.5 text-white placeholder-[#71717a] focus:border-[#f97316] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-white mb-1">
                  Thông tin nổi bật / Ưu điểm sản phẩm
                </label>
                <textarea
                  value={productInfo}
                  onChange={(e) => setProductInfo(e.target.value)}
                  placeholder="Ví dụ: Lì lâu 8 tiếng, không khô môi, màu đỏ cổ điển tôn da, giá sale hôm nay..."
                  rows={2}
                  className="w-full rounded-lg border border-[#3f3f46] bg-[#09090b] p-2.5 text-white placeholder-[#71717a] focus:border-[#f97316] focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block font-medium text-white mb-1">
                  Yêu cầu thêm (Tùy chọn)
                </label>
                <input
                  type="text"
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="Ví dụ: Dùng ngôn ngữ Gen Z hài hước, nhấn mạnh deal hời..."
                  className="w-full rounded-lg border border-[#3f3f46] bg-[#09090b] p-2.5 text-white placeholder-[#71717a] focus:border-[#f97316] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#3f3f46]">
              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                className="rounded-lg border border-[#3f3f46] px-4 py-2 text-xs font-medium text-[#a1a1aa] hover:bg-[#27272a] hover:text-white transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleGenerateAI}
                disabled={isGenerating}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#f97316] px-5 py-2 text-xs font-semibold text-black hover:bg-[#ea580c] transition-colors"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Gemini đang viết...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 fill-current" />
                    <span>Tạo kịch bản ngay</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
