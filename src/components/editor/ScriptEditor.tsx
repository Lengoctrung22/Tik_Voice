'use client';

import { useState, useEffect } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { Sparkles, Save, Upload, Wand2, Loader2, FileText, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export const SCRIPT_TEMPLATES = [
  {
    id: 'quick_review',
    name: 'Review nhanh 30s',
    desc: 'Hook giữ chân mạnh, 2 ưu điểm nổi bật, kêu gọi mua ngay',
    targetDuration: '30s',
  },
  {
    id: 'unboxing',
    name: 'Mở hộp / Unboxing 45s',
    desc: 'Tò mò cảm xúc khui hàng, chi tiết trải nghiệm đầu tiên',
    targetDuration: '45s',
  },
  {
    id: 'comparison',
    name: 'So sánh 2 sản phẩm 45s',
    desc: 'Đấu điểm thực tế, chỉ ra điểm vượt trội và chọn người chiến thắng',
    targetDuration: '45s',
  },
  {
    id: 'top_list',
    name: 'Top 3-5 lý do nên mua 40s',
    desc: 'Đánh trúng nỗi đau, giải pháp nhanh, nhấn mạnh deal hời',
    targetDuration: '40s',
  },
  {
    id: 'storytelling',
    name: 'Kể chuyện trải nghiệm 45s',
    desc: 'Chia sẻ câu chuyện chân thực, tự nhiên và đồng cảm',
    targetDuration: '45s',
  },
];

export function ScriptEditor() {
  const { project, updateProjectPartial, setActiveTab } = useEditorStore();

  const [scriptText, setScriptText] = useState(project?.script?.text || '');
  const [productName, setProductName] = useState(project?.script?.productName || '');
  const [productInfo, setProductInfo] = useState(project?.script?.productInfo || '');
  const [templateId, setTemplateId] = useState(project?.script?.templateId || 'quick_review');
  const [customInstructions, setCustomInstructions] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);

  // Sync state when project loads or updates
  useEffect(() => {
    if (project?.script) {
      if (project.script.text !== undefined) setScriptText(project.script.text);
      if (project.script.productName) setProductName(project.script.productName);
      if (project.script.productInfo) setProductInfo(project.script.productInfo);
      if (project.script.templateId) setTemplateId(project.script.templateId);
    }
  }, [project?.script]);

  const wordCount = scriptText.trim() ? scriptText.trim().split(/\s+/).length : 0;
  // Estimated reading duration for Vietnamese: ~130 words per minute
  const estimatedSeconds = Math.round((wordCount / 130) * 60);

  const handleSaveScript = async () => {
    if (!project?._id) return;
    try {
      setIsSaving(true);
      const res = await fetch(`/api/projects/${project._id}/script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: scriptText,
          productName,
          productInfo,
          templateId,
        }),
      });
      const data = await res.json();
      if (data.success && data.data?.project) {
        toast.success('Đã lưu kịch bản thành công');
        updateProjectPartial(data.data.project);
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
      toast.error('Vui lòng nhập tên sản phẩm để AI viết kịch bản');
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
        updateProjectPartial(data.data.project);
        toast.success('Gemini AI đã tạo kịch bản TikTok thành công!');
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
      <div className="flex items-center justify-between rounded-xl border border-[#3f3f46] bg-[#09090b] p-3.5">
        <div>
          <p className="font-semibold text-white text-xs">Video nền TikTok (9:16)</p>
          <p className="text-xs text-[#a1a1aa] mt-0.5">
            {project?.video?.fileName
              ? `Tệp: ${project.video.fileName} (${project.video.duration}s)`
              : 'Chưa có video gốc. Hãy tải lên tệp MP4 dọc.'}
          </p>
        </div>

        <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-[#3f3f46] bg-[#18181b] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#27272a] transition-colors">
          <Upload className="h-3.5 w-3.5 text-[#f97316]" />
          <span>{project?.video?.path ? 'Đổi video' : 'Tải video lên'}</span>
          <input
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            onChange={handleVideoUpload}
            className="hidden"
          />
        </label>
      </div>

      {/* AI Scriptwriter Card */}
      <div className="rounded-xl border border-[#f97316]/30 bg-[#431407]/20 p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#431407] text-[#f97316]">
              <Sparkles className="h-4 w-4 fill-current" />
            </span>
            <div>
              <h4 className="font-bold text-white text-xs">Gemini AI Viết Kịch Bản</h4>
              <p className="text-[11px] text-[#a1a1aa]">Chuẩn kịch bản TikTok Affiliate chuyển đổi cao</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerateAI}
            disabled={isGenerating}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#f97316] px-3.5 py-1.5 text-xs font-bold text-black hover:bg-[#ea580c] transition-all shadow-sm disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Đang viết...</span>
              </>
            ) : (
              <>
                <Wand2 className="h-3.5 w-3.5" />
                <span>AI Viết Script</span>
              </>
            )}
          </button>
        </div>

        {/* Inputs: Template, Product Name, Product Info, Custom Instructions */}
        <div className="flex flex-col gap-2.5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-[#a1a1aa] block mb-1">
                Tên sản phẩm <span className="text-[#ef4444]">*</span>
              </label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="VD: Kem chống nắng Anessa..."
                className="w-full rounded-lg border border-[#3f3f46] bg-[#09090b] px-2.5 py-1.5 text-xs text-white placeholder-[#71717a] focus:border-[#f97316] focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] text-[#a1a1aa] block mb-1">Mẫu kịch bản (1 trong 5)</label>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="w-full rounded-lg border border-[#3f3f46] bg-[#09090b] px-2.5 py-1.5 text-xs text-white focus:border-[#f97316] focus:outline-none"
              >
                {SCRIPT_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.targetDuration})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] text-[#a1a1aa] block mb-1">Thông tin / ưu điểm sản phẩm (productInfo)</label>
            <input
              type="text"
              value={productInfo}
              onChange={(e) => setProductInfo(e.target.value)}
              placeholder="VD: Chống nắng SPF 50+, kiềm dầu 8 tiếng, nâng tone nhẹ tự nhiên..."
              className="w-full rounded-lg border border-[#3f3f46] bg-[#09090b] px-2.5 py-1.5 text-xs text-white placeholder-[#71717a] focus:border-[#f97316] focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] text-[#a1a1aa] block mb-1">Yêu cầu thêm (customInstructions - tùy chọn)</label>
            <input
              type="text"
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="VD: Nhấn mạnh deal giảm 50% trong giỏ hàng góc trái video..."
              className="w-full rounded-lg border border-[#3f3f46] bg-[#09090b] px-2.5 py-1.5 text-xs text-white placeholder-[#71717a] focus:border-[#f97316] focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Script Editor Area */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white text-xs">Nội Dung Kịch Bản</span>
            <span className="text-[11px] text-[#71717a] font-mono">
              ({wordCount} từ ~ {estimatedSeconds}s đọc)
            </span>
          </div>

          {project?.script?.text && (
            <span className="text-[11px] text-[#22c55e] flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              <span>Đã có kịch bản</span>
            </span>
          )}
        </div>

        <textarea
          value={scriptText}
          onChange={(e) => setScriptText(e.target.value)}
          placeholder="Nhập hoặc dán nội dung kịch bản lồng tiếng tại đây (khoảng 80 - 180 từ)..."
          rows={7}
          className="w-full rounded-xl border border-[#3f3f46] bg-[#09090b] p-3 text-xs text-white placeholder-[#71717a] focus:border-[#f97316] focus:outline-none focus:ring-1 focus:ring-[#f97316] leading-relaxed resize-none"
        />

        <p className="text-[11px] text-[#71717a]">
          * Lưu ý: Không dùng icon/emoji trong kịch bản để tránh lỗi phát âm khi chuyển sang Text-to-Speech.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={handleSaveScript}
          disabled={isSaving}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#3f3f46] bg-[#27272a] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#3f3f46] transition-colors"
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
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#f97316] px-4 py-2 text-xs font-bold text-black hover:bg-[#ea580c] transition-colors shadow-sm"
        >
          <span>Tiếp tục sang Giọng đọc →</span>
        </button>
      </div>

      {/* AI Scriptwriter Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-[#3f3f46] bg-[#18181b] p-6 shadow-2xl flex flex-col gap-4 text-white">
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
                  Mẫu kịch bản TikTok Affiliate <span className="text-[#ef4444]">*</span>
                </label>
                <select
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  className="w-full rounded-lg border border-[#3f3f46] bg-[#09090b] p-2.5 text-white focus:border-[#f97316] focus:outline-none"
                >
                  {SCRIPT_TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.targetDuration}) — {t.desc}
                    </option>
                  ))}
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
                  placeholder="Ví dụ: Son dưỡng DHC, Nồi chiên không dầu Lock&Lock..."
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
                  placeholder="Ví dụ: Dung tích 5L, công suất 1800W, lòng nồi phủ ceramic chống dính, giảm 80% dầu mỡ..."
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
                  placeholder="Ví dụ: Dùng giọng văn hài hước, nhấn mạnh voucher giảm giá hôm nay..."
                  className="w-full rounded-lg border border-[#3f3f46] bg-[#09090b] p-2.5 text-white placeholder-[#71717a] focus:border-[#f97316] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#3f3f46]">
              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                className="rounded-lg border border-[#3f3f46] px-4 py-2 text-xs font-semibold text-[#a1a1aa] hover:bg-[#27272a] hover:text-white transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleGenerateAI}
                disabled={isGenerating}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#f97316] px-5 py-2 text-xs font-bold text-black hover:bg-[#ea580c] transition-colors shadow-md"
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
