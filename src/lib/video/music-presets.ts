export interface PresetMusicTrack {
  id: string;
  name: string;
  description: string;
  durationSec: number;
  storagePath: string;
  previewUrl: string;
}

export const PRESET_MUSIC_TRACKS: PresetMusicTrack[] = [
  {
    id: 'lofi-chill',
    name: 'Lo-Fi Chill Nhẹ Nhàng',
    description: 'Nhịp êm dịu, phù hợp review mỹ phẩm, skincare, vlog',
    durationSec: 32,
    storagePath: 'public/music/lofi-chill.mp3',
    previewUrl: '/music/lofi-chill.mp3',
  },
  {
    id: 'upbeat-tiktok',
    name: 'Upbeat TikTok Sôi Động',
    description: 'Tiết tấu nhanh, hợp deal sốc, công nghệ & mở hộp',
    durationSec: 32,
    storagePath: 'public/music/upbeat-tiktok.mp3',
    previewUrl: '/music/upbeat-tiktok.mp3',
  },
  {
    id: 'acoustic-warm',
    name: 'Acoustic Ấm Áp',
    description: 'Mộc mạc tự nhiên, hợp kể chuyện & đồ gia dụng',
    durationSec: 32,
    storagePath: 'public/music/acoustic-warm.mp3',
    previewUrl: '/music/acoustic-warm.mp3',
  },
];
