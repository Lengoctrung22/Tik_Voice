import { Voice } from '@/types';

export const SUPPORTED_VOICES: Voice[] = [
  {
    id: 'vi-VN-HoaiMyNeural',
    name: 'Hoài My',
    gender: 'female',
    region: 'Miền Bắc',
    locale: 'vi-VN',
    engine: 'edge',
    tier: 'free',
    displayName: 'Hoài My (Nữ Miền Bắc)',
    description: 'Giọng nữ sáng, tự nhiên, rất hợp review mỹ phẩm & thời trang',
  },
  {
    id: 'vi-VN-NamMinhNeural',
    name: 'Nam Minh',
    gender: 'male',
    region: 'Miền Bắc',
    locale: 'vi-VN',
    engine: 'edge',
    tier: 'free',
    displayName: 'Nam Minh (Nam Miền Bắc)',
    description: 'Giọng nam trầm ấm, dứt khoát, hợp công nghệ & gia dụng',
  },
  {
    id: 'vi-VN-Wavenet-A',
    name: 'WaveNet Nữ A',
    gender: 'female',
    region: 'Chuẩn',
    locale: 'vi-VN',
    engine: 'google',
    tier: 'premium',
    displayName: 'WaveNet Nữ (Google Cloud)',
    description: 'Giọng nữ cao cấp, ngắt nghỉ ổn định cho video bán hàng',
  },
  {
    id: 'vi-VN-Wavenet-B',
    name: 'WaveNet Nam B',
    gender: 'male',
    region: 'Chuẩn',
    locale: 'vi-VN',
    engine: 'google',
    tier: 'premium',
    displayName: 'WaveNet Nam (Google Cloud)',
    description: 'Giọng nam rõ chữ, truyền cảm, phù hợp kể chuyện & so sánh',
  },
  {
    id: 'vi-VN-Neural2-A',
    name: 'Neural2 Nữ A',
    gender: 'female',
    region: 'Chuẩn',
    locale: 'vi-VN',
    engine: 'google',
    tier: 'premium',
    displayName: 'Neural2 Nữ (Google Cloud)',
    description: 'Thế hệ mới tự nhiên như người thật, giữ chân người xem 3 giây đầu',
  },
  {
    id: 'vi-VN-Neural2-D',
    name: 'Neural2 Nam D',
    gender: 'male',
    region: 'Chuẩn',
    locale: 'vi-VN',
    engine: 'google',
    tier: 'premium',
    displayName: 'Neural2 Nam (Google Cloud)',
    description: 'Thế hệ mới năng lượng cao, phù hợp deal sốc & flash sale',
  },
];

export function getVoiceById(id: string): Voice | undefined {
  return SUPPORTED_VOICES.find((v) => v.id === id);
}

/**
 * Chuyển giọng Google Cloud sang giọng Microsoft Edge tương ứng theo giới tính khi fallback.
 */
export function resolveEdgeFallbackVoice(voiceId: string): string {
  const matched = getVoiceById(voiceId);
  if (matched?.engine === 'edge') {
    return matched.id;
  }
  const isMale =
    matched?.gender === 'male' ||
    /(?:Wavenet|Neural2|Standard)-[BD]/i.test(voiceId) ||
    /Nam/i.test(voiceId);
  return isMale ? 'vi-VN-NamMinhNeural' : 'vi-VN-HoaiMyNeural';
}
