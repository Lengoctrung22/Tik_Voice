import { IWordTimestamp, ISubtitleStyle } from '@/lib/db/models/Project';

/**
 * Đổi mã màu HEX #RRGGBB hoặc #RRGGBBAA sang định dạng ASS BGR: &H00BBGGRR
 */
export function hexToAssColor(hex: string): string {
  const cleanHex = hex.replace('#', '');
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
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/**
 * Tạo nội dung file .ass với Karaoke Highlight chuẩn 1080x1920
 */
export function generateAssFile(
  words: IWordTimestamp[],
  style: ISubtitleStyle
): string {
  const primaryColor = hexToAssColor(style.primaryColor || '#FFFFFF');
  const highlightColor = hexToAssColor(style.highlightColor || '#FFD700');
  const outlineColor = hexToAssColor(style.outlineColor || '#000000');

  // FIX LỖI ĐẢO MÀU:
  // Khi bật Karaoke Highlight: PrimaryColour phải là màu Highlight, SecondaryColour là màu chữ ban đầu
  const assPrimary = style.highlightEnabled ? highlightColor : primaryColor;
  const assSecondary = style.highlightEnabled ? primaryColor : highlightColor;

  const alignment = style.position === 'top' ? 8 : style.position === 'center' ? 5 : 2;

  let ass = `[Script Info]
Title: TikVoice Subtitles
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${style.fontFamily || 'Be Vietnam Pro'},${style.fontSize || 64},${assPrimary},${assSecondary},${outlineColor},&H80000000,${style.fontWeight === 'bold' || style.fontWeight === 'black' ? 1 : 0},0,0,0,100,100,0,0,1,${style.outlineWidth ?? 4},${style.shadowDepth ?? 2},${alignment},40,40,${style.marginBottom || 120},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  if (!words || words.length === 0) {
    return ass;
  }

  // Gom từ thành từng nhóm (mỗi nhóm khoảng wordsPerGroup từ)
  const groups: IWordTimestamp[][] = [];
  let current: IWordTimestamp[] = [];
  const wordsPerGroup = style.wordsPerGroup || 3;

  for (const w of words) {
    current.push(w);
    if (current.length >= wordsPerGroup) {
      groups.push(current);
      current = [];
    }
  }
  if (current.length > 0) groups.push(current);

  for (const group of groups) {
    const startMs = group[0].start;
    const endMs = group[group.length - 1].end;
    const startTime = msToAssTime(startMs);
    const endTime = msToAssTime(endMs);

    if (style.highlightEnabled) {
      let lineText = '';
      for (const w of group) {
        const durationCs = Math.max(1, Math.round((w.end - w.start) / 10));
        lineText += `{\\kf${durationCs}}${w.word} `;
      }
      ass += `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${lineText.trim()}\n`;
    } else {
      const lineText = group.map((w) => w.word).join(' ');
      ass += `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${lineText}\n`;
    }
  }

  return ass;
}
