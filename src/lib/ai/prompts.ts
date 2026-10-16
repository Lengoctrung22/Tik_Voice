import { getGeminiClient } from './gemini';

export interface ScriptTemplate {
  id: string;
  name: string;
  description: string;
  estimatedDuration: number;
  maxWords: number;
  promptTemplate: string;
}

export const SCRIPT_TEMPLATES: Record<string, ScriptTemplate> = {
  quick_review: {
    id: 'quick_review',
    name: 'Review nhanh 30s',
    description: 'Kịch bản review ngắn gọn, hook mạnh, CTA rõ ràng',
    estimatedDuration: 30,
    maxWords: 120,
    promptTemplate: `Bạn là một TikToker chuyên review sản phẩm với giọng điệu tự nhiên, gần gũi, có chút hài hước.
Viết kịch bản lồng tiếng cho video TikTok review sản phẩm dài khoảng 30 giây.

Cấu trúc bắt buộc:
1. Hook (2-3 giây, 1-2 câu): Mở đầu gây tò mò, shock nhẹ hoặc đặt câu hỏi. Ví dụ: "Mình đã thử cái này suốt 1 tháng và kết quả khiến mình không tin nổi..."
2. Vấn đề (3-5 giây, 1-2 câu): Nêu vấn đề mà người xem đang gặp phải, tạo đồng cảm.
3. Giải pháp + Ưu điểm (15-18 giây, 3-5 câu): Giới thiệu sản phẩm, highlight 2-3 ưu điểm nổi bật nhất. Dùng cụm từ mạnh: "game changer", "phải thử ngay", "hơn hẳn".
4. CTA (3-5 giây, 1-2 câu): Kêu gọi hành động rõ ràng. Ví dụ: "Link sản phẩm ở bio nha!", "Comment 'muốn' để mình gửi link!"

Sản phẩm: {productName}
Thông tin sản phẩm: {productInfo}
Yêu cầu thêm: {customInstructions}

Quy tắc viết:
- Giọng văn tự nhiên như đang nói chuyện, KHÔNG giống đọc quảng cáo.
- Dùng ngôn ngữ đời thường, có thể xen tiếng lóng Gen Z phù hợp.
- KHÔNG quá 120 từ (tương đương ~30 giây đọc).
- KHÔNG dùng emoji trong kịch bản (để Text-to-Speech không đọc lỗi).
- KHÔNG ghi chú đạo diễn (không viết "(cười)", "(nhấn mạnh)").
- Viết liền mạch, mỗi đoạn cách nhau bằng 1 dòng trống.
Chỉ trả về kịch bản, không giải thích thêm.`,
  },

  unboxing: {
    id: 'unboxing',
    name: 'Mở hộp / Unboxing',
    description: 'Kịch bản mở hộp sản phẩm, tạo sự háo hức',
    estimatedDuration: 45,
    maxWords: 180,
    promptTemplate: `Bạn là một TikToker chuyên làm video unboxing/mở hộp sản phẩm.
Viết kịch bản lồng tiếng cho video unboxing dài khoảng 45 giây.

Cấu trúc:
1. Teaser (3s): Tạo sự tò mò về sản phẩm sắp mở.
2. Mở hộp (10s): Mô tả ấn tượng đầu tiên, packaging, phụ kiện kèm theo.
3. First Impression (15s): Cảm nhận ban đầu khi cầm/dùng thử, so sánh với kỳ vọng.
4. Đánh giá nhanh (10s): 2-3 điểm nổi bật nhất.
5. CTA (5s): Kêu gọi follow để xem review chi tiết.

Sản phẩm: {productName}
Thông tin: {productInfo}
Yêu cầu thêm: {customInstructions}

Quy tắc: Tự nhiên, háo hức, không quá 180 từ, không emoji, không ghi chú đạo diễn.
Chỉ trả về kịch bản.`,
  },

  comparison: {
    id: 'comparison',
    name: 'So sánh 2 sản phẩm',
    description: 'Kịch bản so sánh 2 sản phẩm cạnh tranh',
    estimatedDuration: 45,
    maxWords: 180,
    promptTemplate: `Bạn là reviewer so sánh sản phẩm trên TikTok.
Viết kịch bản so sánh dài ~45 giây.

Cấu trúc:
1. Hook (3s): Đặt câu hỏi so sánh gây tranh cãi.
2. Giới thiệu 2 SP (5s): Tên, giá cả.
3. So sánh từng tiêu chí (25s): 3-4 tiêu chí, mỗi tiêu chí nêu rõ winner.
4. Verdict (7s): Kết luận nên mua cái nào.
5. CTA (5s): Link mua ở bio/giỏ hàng.

Sản phẩm: {productName}
Thông tin: {productInfo}
Yêu cầu thêm: {customInstructions}

Quy tắc: Công bằng nhưng có winner rõ ràng, không quá 180 từ, không emoji.
Chỉ trả về kịch bản.`,
  },

  top_list: {
    id: 'top_list',
    name: 'Top 3-5 lý do nên mua',
    description: 'Kịch bản liệt kê lý do mua sản phẩm',
    estimatedDuration: 40,
    maxWords: 160,
    promptTemplate: `Bạn là TikToker review sản phẩm.
Viết kịch bản "Top lý do nên mua" dài ~40 giây.

Cấu trúc:
1. Hook (3s): "X lý do bạn PHẢI mua [sản phẩm] ngay!"
2. Lý do 1-3/5 (mỗi lý do 7-8s): Ngắn gọn, đánh trúng tâm lý.
3. Bonus tip (5s): Mẹo sử dụng hoặc deal giảm giá đang có.
4. CTA (5s): Kêu gọi chốt đơn.

Sản phẩm: {productName}
Thông tin: {productInfo}
Yêu cầu thêm: {customInstructions}

Quy tắc: Năng lượng cao, đếm ngược dứt khoát, không quá 160 từ, không emoji.
Chỉ trả về kịch bản.`,
  },

  storytelling: {
    id: 'storytelling',
    name: 'Kể chuyện trải nghiệm',
    description: 'Kịch bản kể chuyện cá nhân sử dụng sản phẩm',
    estimatedDuration: 45,
    maxWords: 180,
    promptTemplate: `Bạn là một người dùng thực tế kể lại trải nghiệm với sản phẩm.
Viết kịch bản kể chuyện dài ~45 giây.

Cấu trúc:
1. Mở đầu (5s): Bối cảnh — "Mình từng gặp vấn đề X..."
2. Khó khăn (8s): Mô tả nỗi đau cụ thể khiến bạn khó chịu.
3. Phát hiện SP (5s): "Cho đến khi mình tìm thấy em này..."
4. Trải nghiệm (15s): Kể chi tiết quá trình dùng, thay đổi thế nào.
5. Kết (7s): Cảm nhận tổng thể và lời khuyên chân thành.
6. CTA (5s): Giục người xem xem link ở góc trái.

Sản phẩm: {productName}
Thông tin: {productInfo}
Yêu cầu thêm: {customInstructions}

Quy tắc: Chân thực, có cảm xúc, không quá 180 từ, không emoji.
Chỉ trả về kịch bản.`,
  },
};

export async function generateProductScript(params: {
  productName: string;
  productInfo: string;
  templateId: string;
  customInstructions?: string;
}): Promise<string> {
  const template =
    SCRIPT_TEMPLATES[params.templateId as keyof typeof SCRIPT_TEMPLATES] ||
    SCRIPT_TEMPLATES.quick_review;

  const prompt = template.promptTemplate
    .replace('{productName}', params.productName)
    .replace('{productInfo}', params.productInfo || 'Không có')
    .replace('{customInstructions}', params.customInstructions || 'Không có');

  const ai = getGeminiClient();
  const primaryModel = process.env.GEMINI_MODEL || 'gemini-2.5-pro';

  try {
    const response = await ai.models.generateContent({
      model: primaryModel,
      contents: prompt,
    });
    return response.text?.trim() || '';
  } catch (error) {
    console.warn(
      `[Gemini] Model ${primaryModel} gặp lỗi hoặc vượt quota, tự động fallback sang gemini-2.0-flash:`,
      error
    );
    const fallbackResponse = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });
    return fallbackResponse.text?.trim() || '';
  }
}
