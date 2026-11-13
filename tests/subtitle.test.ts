import { describe, expect, it } from 'vitest';
import {
  generateAssFile,
  hexToAssColor,
  msToAssTime,
} from '@/lib/video/subtitle';
import {
  escapeAssText,
  groupSubtitleWords,
  resolveAssFontConfig,
  resolvePreviewSubtitleGroup,
  SAMPLE_SUBTITLE_WORDS,
  wrapGroupIntoLines,
} from '@/lib/video/subtitle-layout';
import { DEFAULT_SUBTITLE_STYLE } from '@/lib/video/subtitle-presets';
import type { IWordTimestamp } from '@/lib/db/models/Project';

describe('Subtitle layout & ASS generation', () => {
  it('converts HEX colors to ASS BGR format accurately', () => {
    expect(hexToAssColor('#FFD700')).toBe('&H0000D7FF');
    expect(hexToAssColor('#F97316')).toBe('&H001673F9');
    expect(hexToAssColor('#fff')).toBe('&H00FFFFFF');
    expect(hexToAssColor('xyz')).toBe('&H00FFFFFF');
    expect(hexToAssColor('#not-hex')).toBe('&H00FFFFFF');
  });

  it('formats milliseconds into ASS timestamps cleanly', () => {
    expect(msToAssTime(-50)).toBe('0:00:00.00');
    expect(msToAssTime(0)).toBe('0:00:00.00');
    expect(msToAssTime(65430)).toBe('0:01:05.43');
    expect(msToAssTime(3661990)).toBe('1:01:01.99');
  });

  it('escapes ASS braces, backslashes, and newlines safely', () => {
    expect(escapeAssText('{sale}\n50%\\off')).toBe('\\{sale\\} 50%\\\\off');
  });

  it('maps bundled black fonts to libass Fontname without double bolding', () => {
    expect(resolveAssFontConfig('Montserrat', 'black')).toEqual({
      fontName: 'Montserrat Black',
      boldFlag: 0,
    });
    expect(resolveAssFontConfig('Be Vietnam Pro', 'bold')).toEqual({
      fontName: 'Be Vietnam Pro',
      boldFlag: 1,
    });
    expect(resolveAssFontConfig('Inter', 'normal')).toEqual({
      fontName: 'Inter',
      boldFlag: 0,
    });
    expect(resolveAssFontConfig('Arial', 'black')).toEqual({
      fontName: 'Arial',
      boldFlag: 1,
    });
  });

  it('wraps word groups across multiple lines according to maxCharsPerLine', () => {
    const words: IWordTimestamp[] = [
      { word: 'Kem', start: 0, end: 250 },
      { word: 'chống', start: 250, end: 500 },
      { word: 'nắng', start: 500, end: 800 },
      { word: 'siêu', start: 800, end: 1100 },
      { word: 'kiềm', start: 1100, end: 1400 },
      { word: 'dầu', start: 1400, end: 1700 },
    ];
    const groups = groupSubtitleWords(words, 6);
    expect(groups).toHaveLength(1);

    const lines = wrapGroupIntoLines(groups[0], 15);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[0].map((w) => w.word).join(' ').length).toBeLessThanOrEqual(15);
  });

  it('returns header-only ASS when words array is empty', () => {
    const ass = generateAssFile([], DEFAULT_SUBTITLE_STYLE);
    expect(ass).toContain('PlayResX: 1080');
    expect(ass).toContain('PlayResY: 1920');
    expect(ass).not.toContain('Dialogue:');
  });

  it('emits \\N wraps, escaped special tokens, and animation tags (fade/bounce/typewriter)', () => {
    const words: IWordTimestamp[] = [
      { word: 'Sản', start: 0, end: 200 },
      { word: 'phẩm', start: 200, end: 450 },
      { word: '{hot}', start: 450, end: 750 },
      { word: 'nhất', start: 750, end: 1000 },
    ];

    const fadeAss = generateAssFile(words, {
      ...DEFAULT_SUBTITLE_STYLE,
      wordsPerGroup: 4,
      maxCharsPerLine: 12,
      animation: 'fade',
    });
    expect(fadeAss).toContain('{\\fad(120,80)}');
    expect(fadeAss).toContain('\\N');
    expect(fadeAss).toContain('\\{hot\\}');

    const bounceAss = generateAssFile(words, {
      ...DEFAULT_SUBTITLE_STYLE,
      wordsPerGroup: 4,
      animation: 'bounce',
    });
    expect(bounceAss).toContain('\\fscx85\\fscy85');

    const typewriterAss = generateAssFile(words, {
      ...DEFAULT_SUBTITLE_STYLE,
      wordsPerGroup: 4,
      animation: 'typewriter',
    });
    expect(typewriterAss).toContain('\\alpha&HFF&\\t(');
  });

  it('prevents overlapping Dialogue timestamps when boundary words overlap', () => {
    const overlappingWords: IWordTimestamp[] = [
      { word: 'Giảm', start: 6000, end: 6500 },
      { word: '50%!', start: 6500, end: 7462 },
      { word: 'Đừng', start: 7412, end: 8100 },
      { word: 'bỏ', start: 8100, end: 8500 },
    ];
    const ass = generateAssFile(overlappingWords, {
      ...DEFAULT_SUBTITLE_STYLE,
      wordsPerGroup: 2,
    });
    const dialogues = ass
      .split(/\r?\n/)
      .filter((line) => line.startsWith('Dialogue:'));
    expect(dialogues).toHaveLength(2);
    const endFirst = dialogues[0].split(',')[2];
    const startSecond = dialogues[1].split(',')[1];
    expect(startSecond >= endFirst).toBe(true);
  });

  it('returns null from resolvePreviewSubtitleGroup when disabled or in export preview mode', () => {
    const words: IWordTimestamp[] = [
      { word: 'Xin', start: 0, end: 300 },
      { word: 'chào', start: 300, end: 700 },
    ];

    expect(
      resolvePreviewSubtitleGroup({
        subtitleEnabled: false,
        previewMode: 'preview',
        activeTab: 'subtitle',
        words: [],
        currentTimeSec: 0,
      })
    ).toBeNull();

    expect(
      resolvePreviewSubtitleGroup({
        subtitleEnabled: false,
        previewMode: 'preview',
        activeTab: 'subtitle',
        words,
        currentTimeSec: 0.1,
      })
    ).toBeNull();

    expect(
      resolvePreviewSubtitleGroup({
        subtitleEnabled: true,
        previewMode: 'export',
        activeTab: 'subtitle',
        words: [],
        currentTimeSec: 0,
      })
    ).toBeNull();
  });

  it('returns sample preview subtitle only on subtitle tab when words are empty, highlighting first two words', () => {
    expect(
      resolvePreviewSubtitleGroup({
        subtitleEnabled: true,
        previewMode: 'preview',
        activeTab: 'script',
        words: [],
        currentTimeSec: 0,
      })
    ).toBeNull();

    const sample = resolvePreviewSubtitleGroup({
      subtitleEnabled: true,
      previewMode: 'preview',
      activeTab: 'subtitle',
      words: [],
      currentTimeSec: 0,
      wordsPerGroup: 5,
      maxCharsPerLine: 14,
    });

    expect(sample).not.toBeNull();
    expect(sample?.isSample).toBe(true);
    expect(sample?.group).toEqual(SAMPLE_SUBTITLE_WORDS);
    expect(sample?.group.map((w) => w.word).join(' ')).toBe('Chốt đơn ngay hôm nay');
    expect(sample?.lines.length).toBeGreaterThanOrEqual(2);
    expect(sample?.currentMs).toBeGreaterThanOrEqual(SAMPLE_SUBTITLE_WORDS[1].start);
    expect(sample?.currentMs).toBeLessThan(SAMPLE_SUBTITLE_WORDS[2].start);
  });

  it('returns active timed word group with isSample=false when words exist', () => {
    const words: IWordTimestamp[] = [
      { word: 'Sản', start: 0, end: 300 },
      { word: 'phẩm', start: 300, end: 700 },
      { word: 'hot', start: 700, end: 1100 },
    ];

    const preview = resolvePreviewSubtitleGroup({
      subtitleEnabled: true,
      previewMode: 'preview',
      activeTab: 'tts',
      words,
      currentTimeSec: 0.4,
      wordsPerGroup: 3,
      maxCharsPerLine: 22,
    });

    expect(preview).not.toBeNull();
    expect(preview?.isSample).toBe(false);
    expect(preview?.gi).toBe(0);
    expect(preview?.group).toEqual(words);
    expect(preview?.currentMs).toBe(400);
  });
});
