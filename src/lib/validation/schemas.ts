import { z } from 'zod';
import path from 'path';

export const MAX_VIDEO_UPLOAD_BYTES = 500 * 1024 * 1024; // 500MB
export const MAX_AUDIO_UPLOAD_BYTES = 50 * 1024 * 1024;  // 50MB
export const MAX_IMAGE_UPLOAD_BYTES = 15 * 1024 * 1024;  // 15MB

export type UploadCategoryType = 'video' | 'clip' | 'music' | 'voice' | 'watermark';

const UPLOAD_RULES: Record<
  UploadCategoryType,
  {
    maxBytes: number;
    extensions: string[];
    mimePrefixes: string[];
    label: string;
  }
> = {
  video: {
    maxBytes: MAX_VIDEO_UPLOAD_BYTES,
    extensions: ['.mp4', '.mov', '.webm', '.m4v'],
    mimePrefixes: ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'],
    label: 'video (MP4, MOV, WebM)',
  },
  clip: {
    maxBytes: MAX_VIDEO_UPLOAD_BYTES,
    extensions: ['.mp4', '.mov', '.webm', '.m4v'],
    mimePrefixes: ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'],
    label: 'clip B-roll (MP4, MOV, WebM)',
  },
  music: {
    maxBytes: MAX_AUDIO_UPLOAD_BYTES,
    extensions: ['.mp3', '.wav', '.m4a', '.aac', '.ogg'],
    mimePrefixes: ['audio/'],
    label: 'nhạc nền (MP3, WAV, M4A)',
  },
  voice: {
    maxBytes: MAX_AUDIO_UPLOAD_BYTES,
    extensions: ['.mp3', '.wav', '.m4a', '.ogg'],
    mimePrefixes: ['audio/'],
    label: 'giọng đọc (MP3, WAV, M4A)',
  },
  watermark: {
    maxBytes: MAX_IMAGE_UPLOAD_BYTES,
    extensions: ['.png', '.webp', '.jpg', '.jpeg'],
    mimePrefixes: ['image/png', 'image/webp', 'image/jpeg'],
    label: 'logo/watermark (PNG, WebP, JPG)',
  },
};

export function validateUploadMetadata(
  file: { name: string; type: string; size: number },
  uploadType: string
): { ok: true; category: UploadCategoryType; ext: string } | { ok: false; error: string; status: number } {
  if (!(uploadType in UPLOAD_RULES)) {
    return { ok: false, error: `Loại tệp tải lên không hợp lệ: ${uploadType}`, status: 400 };
  }

  const category = uploadType as UploadCategoryType;
  const rule = UPLOAD_RULES[category];
  const ext = path.extname(file.name || '').toLowerCase();

  if (file.size <= 0) {
    return { ok: false, error: 'Tệp tải lên bị rỗng (0 bytes).', status: 400 };
  }

  if (file.size > rule.maxBytes) {
    const maxMb = Math.round(rule.maxBytes / (1024 * 1024));
    return {
      ok: false,
      error: `Tệp quá lớn (tối đa ${maxMb}MB). Hãy nén nhẹ lại trước khi tải lên.`,
      status: 413,
    };
  }

  const extOk = rule.extensions.includes(ext);
  const mimeLower = (file.type || '').toLowerCase();
  const mimeOk = !mimeLower || mimeLower === 'application/octet-stream' || rule.mimePrefixes.some((p) => mimeLower.startsWith(p));

  if (!extOk || !mimeOk) {
    return {
      ok: false,
      error: `Định dạng tệp không được hỗ trợ. Vui lòng chọn tệp ${rule.label}.`,
      status: 400,
    };
  }

  return { ok: true, category, ext };
}

const hexColorSchema = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, 'Mã màu HEX không hợp lệ');

export const wordTimestampSchema = z.object({
  word: z.string().min(1).max(120),
  start: z.number().min(0),
  end: z.number().min(0),
});

export const subtitleStyleSchema = z
  .object({
    fontFamily: z.enum(['Be Vietnam Pro', 'Montserrat', 'Inter', 'Roboto']).optional(),
    fontSize: z.number().min(24).max(120).optional(),
    fontWeight: z.enum(['normal', 'bold', 'black']).optional(),
    primaryColor: hexColorSchema.optional(),
    outlineColor: hexColorSchema.optional(),
    outlineWidth: z.number().min(0).max(14).optional(),
    shadowColor: hexColorSchema.optional(),
    shadowDepth: z.number().min(0).max(10).optional(),
    position: z.enum(['top', 'center', 'bottom']).optional(),
    marginBottom: z.number().min(20).max(450).optional(),
    alignment: z.enum(['left', 'center', 'right']).optional(),
    highlightEnabled: z.boolean().optional(),
    highlightColor: hexColorSchema.optional(),
    animation: z.enum(['none', 'fade', 'typewriter', 'bounce']).optional(),
    maxCharsPerLine: z.number().min(10).max(50).optional(),
    wordsPerGroup: z.number().min(1).max(8).optional(),
  })
  .strict();

export const bgMusicPatchSchema = z
  .object({
    path: z.string().min(1).max(500),
    name: z.string().min(1).max(200),
    volume: z.number().min(0).max(1).optional(),
    fadeIn: z.number().min(0).max(15).optional(),
    fadeOut: z.number().min(0).max(15).optional(),
    ducking: z.boolean().optional(),
  })
  .strict();

export const watermarkPatchSchema = z
  .object({
    enabled: z.boolean().optional(),
    path: z.string().max(500).optional(),
    name: z.string().max(200).optional(),
    position: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right']).optional(),
    opacity: z.number().min(0.1).max(1).optional(),
    scale: z.number().min(0.05).max(0.4).optional(),
  })
  .strict();

export const videoClipSchema = z.object({
  path: z.string().min(1),
  fileName: z.string().min(1),
  duration: z.number().min(0),
  width: z.number().min(1),
  height: z.number().min(1),
  fileSize: z.number().min(0),
  hasAudio: z.boolean().optional(),
});

export const projectPatchSchema = z
  .object({
    name: z.string().trim().min(1, 'Tên dự án không được để trống').max(150).optional(),
    description: z.string().max(1000).optional(),
    video: z
      .object({
        aspectMode: z.enum(['cover', 'blur', 'contain']).optional(),
        originalVolume: z.number().min(0).max(1).optional(),
        clips: z.array(videoClipSchema).max(5).optional(),
      })
      .strict()
      .optional(),
    script: z
      .object({
        text: z.string().max(10000).optional(),
        templateId: z.string().max(60).optional(),
        productName: z.string().max(200).optional(),
        productInfo: z.string().max(2000).optional(),
        customInstructions: z.string().max(1000).optional(),
        hookVariants: z.array(z.string().max(500)).max(5).optional(),
        captionText: z.string().max(2200).optional(),
        hashtags: z.array(z.string().max(80)).max(20).optional(),
      })
      .strict()
      .optional(),
    tts: z
      .object({
        engine: z.enum(['edge', 'google']).optional(),
        voice: z.string().max(100).optional(),
        speed: z.number().min(0.5).max(2.0).optional(),
        pitch: z.number().min(-20).max(20).optional(),
      })
      .strict()
      .optional(),
    subtitle: z
      .object({
        enabled: z.boolean().optional(),
        style: subtitleStyleSchema.optional(),
        words: z.array(wordTimestampSchema).max(5000).optional(),
      })
      .strict()
      .optional(),
    bgMusic: bgMusicPatchSchema.nullable().optional(),
    watermark: watermarkPatchSchema.nullable().optional(),
    export: z
      .object({
        resolution: z.enum(['1080x1920', '720x1280']).optional(),
        quality: z.enum(['fast', 'balanced', 'high']).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const renderRequestSchema = z
  .object({
    quality: z.enum(['fast', 'balanced', 'high']).optional().default('balanced'),
    resolution: z.enum(['1080x1920', '720x1280']).optional().default('1080x1920'),
  })
  .strict();

export const subtitleUpdateSchema = z
  .object({
    enabled: z.boolean().optional(),
    style: subtitleStyleSchema.optional(),
    words: z.array(wordTimestampSchema).max(5000).optional(),
  })
  .strict();

export const presetCreateSchema = z.object({
  name: z.string().trim().min(1, 'Vui lòng nhập tên cấu hình mẫu').max(100),
  engine: z.enum(['edge', 'google']).default('edge'),
  voice: z.string().min(1).max(100).default('vi-VN-HoaiMyNeural'),
  speed: z.number().min(0.5).max(2.0).default(1.0),
  pitch: z.number().min(-20).max(20).default(0),
  aspectMode: z.enum(['cover', 'blur', 'contain']).default('contain'),
  originalVolume: z.number().min(0).max(1).default(0),
  subtitleEnabled: z.boolean().default(true),
  subtitleStyle: subtitleStyleSchema.default({}),
  bgMusic: bgMusicPatchSchema.optional(),
  exportResolution: z.enum(['1080x1920', '720x1280']).default('1080x1920'),
  exportQuality: z.enum(['fast', 'balanced', 'high']).default('balanced'),
});

export function parseResolution(resolution?: string): { width: number; height: number; key: '1080x1920' | '720x1280' } {
  if (resolution === '720x1280') {
    return { width: 720, height: 1280, key: '720x1280' };
  }
  return { width: 1080, height: 1920, key: '1080x1920' };
}
