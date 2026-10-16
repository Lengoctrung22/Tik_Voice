import { Voice } from '@/types';

export const SUPPORTED_VOICES: Voice[] = [
  {
    id: 'vi-VN-HoaiMyNeural',
    name: 'Hoài My',
    gender: 'female',
    locale: 'vi-VN',
    engine: 'edge',
    displayName: 'Hoài My (Nữ Bắc - Miễn phí)',
  },
  {
    id: 'vi-VN-NamMinhNeural',
    name: 'Nam Minh',
    gender: 'male',
    locale: 'vi-VN',
    engine: 'edge',
    displayName: 'Nam Minh (Nam Bắc - Miễn phí)',
  },
  {
    id: 'vi-VN-Wavenet-A',
    name: 'WaveNet Nữ',
    gender: 'female',
    locale: 'vi-VN',
    engine: 'google',
    displayName: 'WaveNet Nữ (Google Cloud)',
  },
  {
    id: 'vi-VN-Wavenet-B',
    name: 'WaveNet Nam',
    gender: 'male',
    locale: 'vi-VN',
    engine: 'google',
    displayName: 'WaveNet Nam (Google Cloud)',
  },
  {
    id: 'vi-VN-Neural2-A',
    name: 'Neural2 Nữ',
    gender: 'female',
    locale: 'vi-VN',
    engine: 'google',
    displayName: 'Neural2 Nữ (Google Cloud)',
  },
  {
    id: 'vi-VN-Neural2-D',
    name: 'Neural2 Nam',
    gender: 'male',
    locale: 'vi-VN',
    engine: 'google',
    displayName: 'Neural2 Nam (Google Cloud)',
  },
];

export function getVoiceById(id: string): Voice | undefined {
  return SUPPORTED_VOICES.find((v) => v.id === id);
}
