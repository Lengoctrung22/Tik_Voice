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
1. Hook (2-3 giây, 1-2 câu): Mở đầu gây tò mò, shock nhẹ hoặc đặt câu hỏi.
2. Vấn đề (3-5 giây, 1-2 câu): Nêu vấn đề mà người xem đang gặp phải, tạo đồng cảm.
3. Giải pháp + Ưu điểm (15-18 giây, 3-5 câu): Giới thiệu sản phẩm, highlight 2-3 ưu điểm nổi bật nhất.
4. CTA (3-5 giây, 1-2 câu): Kêu gọi hành động rõ ràng (giỏ hàng góc trái / bio).

Sản phẩm: {productName}
Thông tin sản phẩm: {productInfo}
Yêu cầu thêm: {customInstructions}

Quy tắc viết:
- Giọng văn tự nhiên như đang nói chuyện, KHÔNG giống đọc quảng cáo.
- Dùng ngôn ngữ đời thường, có thể xen tiếng lóng Gen Z phù hợp.
- KHÔNG quá 120 từ (tương đương ~30 giây đọc).
- KHÔNG dùng emoji trong kịch bản (để Text-to-Speech không đọc lỗi).
- KHÔNG ghi chú đạo diễn (không viết "(cười)", "[Hook]").
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
3. Trải nghiệm ban đầu (15s): Cảm nhận thực tế khi cầm/dùng thử.
4. Đánh giá nhanh (10s): 2-3 điểm nổi bật nhất.
5. CTA (5s): Kêu gọi xem link giỏ hàng góc trái.

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
1. Hook (3s): Đặt câu hỏi so sánh gây tò mò.
2. Giới thiệu 2 sản phẩm (5s): Tên, mức giá.
3. So sánh từng tiêu chí (25s): 3-4 tiêu chí, nêu rõ điểm hơn thua.
4. Kết luận (7s): Nên chọn cái nào cho ai.
5. CTA (5s): Link mua ở giỏ hàng góc trái.

Sản phẩm: {productName}
Thông tin: {productInfo}
Yêu cầu thêm: {customInstructions}

Quy tắc: Công bằng nhưng có lựa chọn rõ ràng, không quá 180 từ, không emoji, không ghi chú đạo diễn.
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
1. Hook (3s): Mở đầu bằng con số mạnh thu hút chú ý.
2. Các lý do chính (25s): Ngắn gọn, đánh trúng tâm lý người mua.
3. Mẹo / Deal (7s): Lưu ý sử dụng hoặc ưu đãi hiện tại.
4. CTA (5s): Kêu gọi chốt đơn ngay.

Sản phẩm: {productName}
Thông tin: {productInfo}
Yêu cầu thêm: {customInstructions}

Quy tắc: Năng lượng cao, dứt khoát, không quá 160 từ, không emoji, không ghi chú đạo diễn.
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
1. Mở đầu (5s): Bối cảnh gặp vấn đề.
2. Khó khăn (8s): Mô tả nỗi đau cụ thể.
3. Phát hiện sản phẩm (5s): Bước ngoặt tìm thấy sản phẩm.
4. Trải nghiệm (15s): Kể chi tiết quá trình dùng, thay đổi thực tế.
5. Kết (7s): Cảm nhận tổng thể và lời khuyên chân thành.
6. CTA (5s): Gợi ý xem giỏ hàng góc trái.

Sản phẩm: {productName}
Thông tin: {productInfo}
Yêu cầu thêm: {customInstructions}

Quy tắc: Chân thực, có cảm xúc, không quá 180 từ, không emoji, không ghi chú đạo diễn.
Chỉ trả về kịch bản.`,
  },
};

export function cleanScriptText(text: string): string {
  return text
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
      ''
    )
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n\n');
}

async function callGeminiWithFallback(
  contents: string | Array<string | { inlineData: { data: string; mimeType: string } }>
): Promise<string> {
  const ai = getGeminiClient();
  const primaryModel = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

  try {
    const response = await ai.models.generateContent({
      model: primaryModel,
      contents,
    });
    return response.text?.trim() || '';
  } catch (error) {
    console.warn(`[Gemini] Model ${primaryModel} gặp lỗi, thử lại với gemini-2.0-flash:`, error);
    const fallbackResponse = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents,
    });
    return fallbackResponse.text?.trim() || '';
  }
}

export async function generateProductScript(params: {
  productName: string;
  productInfo: string;
  templateId: string;
  customInstructions?: string;
  productImageBase64?: string;
  productImageMimeType?: string;
}): Promise<string> {
  const template =
    SCRIPT_TEMPLATES[params.templateId as keyof typeof SCRIPT_TEMPLATES] ||
    SCRIPT_TEMPLATES.quick_review;

  let prompt = template.promptTemplate
    .replace('{productName}', params.productName)
    .replace('{productInfo}', params.productInfo || 'Không có')
    .replace('{customInstructions}', params.customInstructions || 'Không có');

  if (params.productImageBase64) {
    prompt += `\n\nHãy quan sát thêm ảnh sản phẩm đính kèm (màu sắc, bao bì, dung tích, chữ trên nhãn nếu thấy rõ) để mô tả chi tiết thực tế hơn.`;
    const raw = await callGeminiWithFallback([
      prompt,
      {
        inlineData: {
          data: params.productImageBase64,
          mimeType: params.productImageMimeType || 'image/jpeg',
        },
      },
    ]);
    return cleanScriptText(raw);
  }

  const raw = await callGeminiWithFallback(prompt);
  return cleanScriptText(raw);
}

/**
 * Tạo 3 phương án Hook 3 giây đầu để Creator A/B test.
 */
export async function generateHookVariants(params: {
  productName: string;
  productInfo?: string;
  currentScript?: string;
}): Promise<string[]> {
  const prompt = `Bạn là chuyên gia nội dung TikTok Affiliate. Hãy viết đúng 3 câu mở đầu (Hook 3 giây đầu) khác nhau cho sản phẩm "${params.productName}".
Thông tin sản phẩm: ${params.productInfo || 'Không có'}
Ngữ cảnh kịch bản hiện tại: ${params.currentScript || 'Chưa có'}

Yêu cầu:
- Câu 1: Gây tò mò / sốc nhẹ (Curiosity)
- Câu 2: Đánh trúng nỗi đau (Pain point)
- Câu 3: Khoe kết quả / Deal hời (Result/Offer)
- Mỗi câu ngắn gọn dưới 18 từ, tiếng Việt tự nhiên, KHÔNG emoji, KHÔNG số thứ tự, mỗi câu trên 1 dòng.`;

  const raw = await callGeminiWithFallback(prompt);
  return raw
    .split('\n')
    .map((line) => line.replace(/^[-*•\d.)\s]+/, '').trim())
    .map((line) => cleanScriptText(line))
    .filter(Boolean)
    .slice(0, 3);
}

/**
 * Tạo Caption và Hashtag TikTok chuẩn SEO từ kịch bản & tên sản phẩm.
 */
export async function generateTikTokCaption(params: {
  productName?: string;
  scriptText?: string;
}): Promise<{ caption: string; hashtags: string[] }> {
  const prompt = `Bạn là chuyên gia TikTok Affiliate Việt Nam. Dựa vào sản phẩm và kịch bản sau, hãy tạo:
1. Một đoạn caption ngắn hấp dẫn (2-3 dòng, có CTA xem giỏ hàng góc trái)
2. Danh sách 5-7 hashtag tiếng Việt/tiếng Anh phù hợp xu hướng TikTok Shop.

Sản phẩm: ${params.productName || 'Sản phẩm hot TikTok'}
Kịch bản: ${params.scriptText || 'Review chân thực sản phẩm'}

Trả về đúng định dạng JSON thuần (không bọc markdown):
{"caption": "...", "hashtags": ["#review", "#tiktokshop"]}`;

  const raw = await callGeminiWithFallback(prompt);
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  try {
    const parsed = JSON.parse(cleaned) as { caption?: string; hashtags?: string[] };
    const caption = (parsed.caption || '').trim();
    const hashtags = Array.isArray(parsed.hashtags)
      ? parsed.hashtags
          .map((h) => String(h).trim())
          .filter(Boolean)
          .map((h) => (h.startsWith('#') ? h : `#${h}`))
          .slice(0, 10)
      : [];
    if (caption) {
      return { caption, hashtags };
    }
  } catch {
    // Fallback if Gemini didn't return strict JSON
  }

  return {
    caption: `${params.productName ? `${params.productName} - ` : ''}Dùng thử và cảm nhận thực tế, xem ngay ở giỏ hàng góc trái nhé!`,
    hashtags: ['#tiktokshop', '#reviewchantinh', '#xuhuong', '#affiliate'],
  };
}
