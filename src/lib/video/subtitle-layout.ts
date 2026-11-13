import type { ISubtitleStyle, IWordTimestamp } from '@/lib/db/models/Project';

export const BUNDLED_SUBTITLE_FONTS = [
  'Be Vietnam Pro',
  'Montserrat',
  'Inter',
  'Roboto',
] as const;

export type BundledSubtitleFont = (typeof BUNDLED_SUBTITLE_FONTS)[number];

export const SAMPLE_SUBTITLE_WORDS: IWordTimestamp[] = [
  { word: 'Chốt', start: 0, end: 400 },
  { word: 'đơn', start: 400, end: 800 },
  { word: 'ngay', start: 800, end: 1200 },
  { word: 'hôm', start: 1200, end: 1600 },
  { word: 'nay', start: 1600, end: 2000 },
];

export const SAMPLE_SUBTITLE_CURRENT_MS = 600;

export interface PreviewSubtitleGroup {
  gi: number;
  group: IWordTimestamp[];
  lines: IWordTimestamp[][];
  startMs: number;
  currentMs: number;
  isSample: boolean;
}

/**
 * Gom danh sách từ thành từng cụm theo `wordsPerGroup`.
 */
export function groupSubtitleWords(
  words: IWordTimestamp[],
  wordsPerGroup = 3
): IWordTimestamp[][] {
  if (!words || words.length === 0) return [];
  const safePerGroup = Math.max(1, Math.min(8, Math.round(wordsPerGroup || 3)));
  const groups: IWordTimestamp[][] = [];
  let current: IWordTimestamp[] = [];

  for (const w of words) {
    current.push(w);
    if (current.length >= safePerGroup) {
      groups.push(current);
      current = [];
    }
  }
  if (current.length > 0) {
    groups.push(current);
  }
  return groups;
}

/**
 * Ngắt dòng một cụm từ theo giới hạn `maxCharsPerLine` (dùng chung cho cả Preview & FFmpeg ASS).
 */
export function wrapGroupIntoLines(
  group: IWordTimestamp[],
  maxCharsPerLine = 25
): IWordTimestamp[][] {
  if (!group || group.length === 0) return [];
  const limit = Math.max(8, Math.round(maxCharsPerLine || 25));
  const lines: IWordTimestamp[][] = [];
  let currentLine: IWordTimestamp[] = [];
  let currentLen = 0;

  for (const w of group) {
    const wordText = (w.word || '').trim();
    if (!wordText) continue;
    const nextLen = currentLine.length === 0 ? wordText.length : currentLen + 1 + wordText.length;

    if (currentLine.length > 0 && nextLen > limit) {
      lines.push(currentLine);
      currentLine = [w];
      currentLen = wordText.length;
    } else {
      currentLine.push(w);
      currentLen = nextLen;
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }
  return lines;
}

/**
 * Xác định cụm phụ đề hiển thị trên khung xem trước 9:16 (kèm mẫu trực tiếp khi chưa tạo TTS).
 */
export function resolvePreviewSubtitleGroup(params: {
  subtitleEnabled: boolean;
  previewMode: 'preview' | 'export';
  activeTab: string;
  words: IWordTimestamp[];
  currentTimeSec: number;
  wordsPerGroup?: number;
  maxCharsPerLine?: number;
}): PreviewSubtitleGroup | null {
  const {
    subtitleEnabled,
    previewMode,
    activeTab,
    words,
    currentTimeSec,
    wordsPerGroup = 3,
    maxCharsPerLine = 25,
  } = params;

  if (!subtitleEnabled || previewMode !== 'preview') {
    return null;
  }

  if (words.length === 0) {
    if (activeTab !== 'subtitle') {
      return null;
    }
    const lines = wrapGroupIntoLines(SAMPLE_SUBTITLE_WORDS, maxCharsPerLine);
    return {
      gi: 0,
      group: SAMPLE_SUBTITLE_WORDS,
      lines,
      startMs: 0,
      currentMs: SAMPLE_SUBTITLE_CURRENT_MS,
      isSample: true,
    };
  }

  const groups = groupSubtitleWords(words, wordsPerGroup);
  const currentMs = currentTimeSec * 1000;

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    const startMs = group[0].start;
    const endMs = group[group.length - 1].end + 150;
    if (currentMs >= startMs && currentMs <= endMs) {
      const lines = wrapGroupIntoLines(group, maxCharsPerLine);
      return { gi, group, lines, startMs, currentMs, isSample: false };
    }
  }
  return null;
}

/**
 * Escape ký tự đặc biệt của định dạng SubStation Alpha (.ass) để không hỏng tag.
 */
export function escapeAssText(text: string): string {
  return (text || '')
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\r?\n/g, ' ');
}

/**
 * Ánh xạ font family + weight sang tên font thực tế cho libass.
 */
export function resolveAssFontConfig(
  fontFamily?: string,
  fontWeight?: ISubtitleStyle['fontWeight']
): { fontName: string; boldFlag: 0 | 1 } {
  const family = fontFamily || 'Be Vietnam Pro';
  const isBundled = (BUNDLED_SUBTITLE_FONTS as readonly string[]).includes(family);

  if (fontWeight === 'black' && isBundled) {
    return { fontName: `${family} Black`, boldFlag: 0 };
  }
  if (fontWeight === 'bold' || fontWeight === 'black') {
    return { fontName: family, boldFlag: 1 };
  }
  return { fontName: family, boldFlag: 0 };
}
