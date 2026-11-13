import type { IWordTimestamp, ISubtitleStyle } from '@/lib/db/models/Project';
import {
  groupSubtitleWords,
  wrapGroupIntoLines,
  escapeAssText,
  resolveAssFontConfig,
} from './subtitle-layout';

/**
 * Đổi mã màu HEX #RRGGBB hoặc #RRGGBBAA sang định dạng ASS BGR: &H00BBGGRR
 */
export function hexToAssColor(hex: string): string {
  let cleanHex = (hex || '').replace('#', '').trim();
  if (!/^[0-9a-fA-F]+$/.test(cleanHex)) {
    return '&H00FFFFFF';
  }
  if (cleanHex.length === 3) {
    cleanHex = cleanHex
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (cleanHex.length < 6) return '&H00FFFFFF';
  const r = cleanHex.slice(0, 2);
  const g = cleanHex.slice(2, 4);
  const b = cleanHex.slice(4, 6);
  return `&H00${b}${g}${r}`.toUpperCase();
}

/**
 * Chuyển đổi milliseconds sang định dạng thời gian ASS: H:MM:SS.cs
 */
export function msToAssTime(ms: number): string {
  const safeMs = Math.max(0, ms);
  const h = Math.floor(safeMs / 3600000);
  const m = Math.floor((safeMs % 3600000) / 60000);
  const s = Math.floor((safeMs % 60000) / 1000);
  const cs = Math.floor((safeMs % 1000) / 10);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/**
 * Tạo nội dung file .ass với Karaoke Highlight, Wrap theo maxCharsPerLine và Animation chuẩn 1080x1920.
 * Lưu ý: PlayRes 1080x1920 tự động scale đồng nhất bởi libass sang cả 720x1280 và 1080x1920.
 */
export function generateAssFile(
  words: IWordTimestamp[],
  style: ISubtitleStyle
): string {
  const primaryColor = hexToAssColor(style.primaryColor || '#FFFFFF');
  const highlightColor = hexToAssColor(style.highlightColor || '#FFD700');
  const outlineColor = hexToAssColor(style.outlineColor || '#000000');

  // Khi bật Karaoke Highlight: PrimaryColour là màu sau khi quét (Highlight), SecondaryColour là màu ban đầu
  const assPrimary = style.highlightEnabled ? highlightColor : primaryColor;
  const assSecondary = style.highlightEnabled ? primaryColor : highlightColor;

  let alignment = 2;
  const hAlign = style.alignment || 'center';
  const vAlign = style.position || 'bottom';
  if (vAlign === 'top') {
    alignment = hAlign === 'left' ? 7 : hAlign === 'right' ? 9 : 8;
  } else if (vAlign === 'center') {
    alignment = hAlign === 'left' ? 4 : hAlign === 'right' ? 6 : 5;
  } else {
    alignment = hAlign === 'left' ? 1 : hAlign === 'right' ? 3 : 2;
  }

  const { fontName, boldFlag } = resolveAssFontConfig(style.fontFamily, style.fontWeight);

  let ass = `[Script Info]
Title: TikVoice Subtitles
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${style.fontSize || 64},${assPrimary},${assSecondary},${outlineColor},&H80000000,${boldFlag},0,0,0,100,100,0,0,1,${style.outlineWidth ?? 4},${style.shadowDepth ?? 2},${alignment},40,40,${style.marginBottom || 120},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  if (!words || words.length === 0) {
    return ass;
  }

  const groups = groupSubtitleWords(words, style.wordsPerGroup || 3);
  const maxCharsPerLine = style.maxCharsPerLine || 25;
  const animation = style.animation || 'none';

  let prevGroupEndMs = 0;

  for (const group of groups) {
    const startMs = Math.max(prevGroupEndMs, group[0].start);
    const endMs = Math.max(startMs + 80, group[group.length - 1].end);
    prevGroupEndMs = endMs;
    const startTime = msToAssTime(startMs);
    const endTime = msToAssTime(endMs);

    const lines = wrapGroupIntoLines(group, maxCharsPerLine);

    let eventPrefix = '';
    if (animation === 'fade') {
      eventPrefix = '{\\fad(120,80)}';
    } else if (animation === 'bounce') {
      eventPrefix = '{\\fscx85\\fscy85\\t(0,85,\\fscx108\\fscy108)\\t(85,170,\\fscx100\\fscy100)}';
    }

    const lineStrings = lines.map((lineWords) => {
      return lineWords
        .map((w) => {
          const safeWord = escapeAssText(w.word);
          const relStart = Math.max(0, w.start - startMs);
          const relEnd = Math.max(relStart + 50, w.end - startMs);
          const durationCs = Math.max(1, Math.round((w.end - w.start) / 10));

          if (animation === 'typewriter') {
            const revealTag = `\\alpha&HFF&\\t(${relStart},${Math.min(relEnd, relStart + 60)},\\alpha&H00&)`;
            if (style.highlightEnabled) {
              return `{${revealTag}\\kf${durationCs}}${safeWord}`;
            }
            return `{${revealTag}}${safeWord}`;
          }

          if (style.highlightEnabled) {
            return `{\\kf${durationCs}}${safeWord}`;
          }
          return safeWord;
        })
        .join(' ');
    });

    const bodyText = lineStrings.join('\\N');
    ass += `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${eventPrefix}${bodyText}\n`;
  }

  return ass;
}
