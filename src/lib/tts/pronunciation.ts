export interface WordTiming {
  word: string;
  start: number;
  end: number;
}

export interface TokenSpan {
  originalWord: string;
  spokenWords: string[];
  startIdx: number;
  endIdx: number; // exclusive
}

export interface PronunciationPlan {
  originalWords: string[];
  spokenText: string;
  tokenSpans: TokenSpan[];
}

const EXACT_REPLACEMENTS: Array<[RegExp, string]> = [
  [/^spf$/i, 'ét pê ép'],
  [/^uv$/i, 'u vê'],
  [/^uva$/i, 'u vê a'],
  [/^uvb$/i, 'u vê bê'],
  [/^pa$/i, 'pê a'],
  [/^aha$/i, 'a hát a'],
  [/^bha$/i, 'bê hát a'],
  [/^pha$/i, 'pê hát a'],
  [/^ha$/i, 'hát a'],
  [/^serum$/i, 'xê rum'],
  [/^toner$/i, 'tôn nơ'],
  [/^cleanser$/i, 'clen dơ'],
  [/^retinol$/i, 'rê ti non'],
  [/^niacinamide$/i, 'ni a xi na mai'],
  [/^collagen$/i, 'cô la gen'],
  [/^voucher$/i, 'vâu chờ'],
  [/^freeship$/i, 'phờ ri síp'],
  [/^feedback$/i, 'phít bách'],
  [/^unbox$/i, 'ăn bóc'],
  [/^unboxing$/i, 'ăn bóc xing'],
  [/^review$/i, 'rì viu'],
  [/^skincare$/i, 'xờ kin ke'],
  [/^makeup$/i, 'mếch ắp'],
  [/^combo$/i, 'com bô'],
  [/^sale$/i, 'xêu'],
  [/^deal$/i, 'điu'],
  [/^flash$/i, 'phờ lát'],
  [/^livestream$/i, 'lai chim'],
  [/^tiktok$/i, 'tích tốc'],
  [/^affiliate$/i, 'a phi li ết'],
  [/^ml$/i, 'mi li lít'],
  [/^gr$/i, 'gam'],
  [/^kg$/i, 'ki lô gam'],
  [/^cm$/i, 'xen ti mét'],
  [/^mm$/i, 'mi li mét'],
  [/^mah$/i, 'mi li am pe giờ'],
];

export function pronounceSingleToken(token: string): string {
  // Tách dấu câu đầu & cuối để giữ nguyên ngữ điệu ngắt nghỉ của TTS
  const match = token.match(/^([^\p{L}\p{N}]*)([\p{L}\p{N}.+%-]+)([^\p{L}\p{N}]*)$/u);
  if (!match) return token;

  const [, lead, core, trail] = match;
  let spokenCore = core;

  // Số + % -> "50 phần trăm"
  if (/^\d+(?:[.,]\d+)?%$/u.test(spokenCore)) {
    spokenCore = spokenCore.replace(/%$/, ' phần trăm');
  } else if (/^spf(\d+)(\+?)$/i.test(spokenCore)) {
    spokenCore = spokenCore.replace(/^spf(\d+)(\+?)$/i, (_m, num: string, plus: string) =>
      plus ? `ét pê ép ${num} cộng` : `ét pê ép ${num}`
    );
  } else if (/^\d+(?:[.,]\d+)?ml$/i.test(spokenCore)) {
    spokenCore = spokenCore.replace(/ml$/i, ' mi li lít');
  } else if (/^\d+(?:[.,]\d+)?(?:g|gr)$/i.test(spokenCore)) {
    spokenCore = spokenCore.replace(/(?:gr|g)$/i, ' gam');
  } else if (/^\d+(?:[.,]\d+)?kg$/i.test(spokenCore)) {
    spokenCore = spokenCore.replace(/kg$/i, ' ki lô gam');
  } else if (/^\d+(?:[.,]\d+)?k$/i.test(spokenCore)) {
    spokenCore = spokenCore.replace(/k$/i, ' nghìn');
  } else if (/^\d+(?:[.,]\d+)?w$/i.test(spokenCore)) {
    spokenCore = spokenCore.replace(/w$/i, ' oát');
  } else if (/^\d+(?:[.,]\d+)?mah$/i.test(spokenCore)) {
    spokenCore = spokenCore.replace(/mah$/i, ' mi li am pe giờ');
  } else {
    for (const [pattern, replacement] of EXACT_REPLACEMENTS) {
      if (pattern.test(spokenCore)) {
        spokenCore = replacement;
        break;
      }
    }
  }

  return `${lead}${spokenCore}${trail}`;
}

export const PRONUNCIATION_EXAMPLES = [
  { raw: 'SPF', spoken: 'ét pê ép' },
  { raw: 'Serum', spoken: 'xê rum' },
  { raw: '50ml', spoken: '50 mi li lít' },
  { raw: '50%', spoken: '50 phần trăm' },
  { raw: '199k', spoken: '199 nghìn' },
  { raw: 'Voucher / Freeship', spoken: 'vâu chờ / phờ ri síp' },
];

/**
 * Xây dựng văn bản phát âm tối ưu cho TTS nhưng giữ danh sách từ gốc cho phụ đề.
 */
export function buildPronunciationPlan(text: string): PronunciationPlan {
  const normalized = text.trim();
  if (!normalized) {
    return { originalWords: [], spokenText: '', tokenSpans: [] };
  }

  const originalWords = normalized.split(/\s+/).filter(Boolean);
  const spokenParts: string[] = [];
  const tokenSpans: TokenSpan[] = [];
  let cursor = 0;

  for (const originalWord of originalWords) {
    const converted = pronounceSingleToken(originalWord);
    const subWords = converted.split(/\s+/).filter(Boolean);
    const count = Math.max(1, subWords.length);
    tokenSpans.push({
      originalWord,
      spokenWords: subWords.length > 0 ? subWords : [originalWord],
      startIdx: cursor,
      endIdx: cursor + count,
    });
    cursor += count;
    spokenParts.push(converted);
  }

  return {
    originalWords,
    spokenText: spokenParts.join(' '),
    tokenSpans,
  };
}

/**
 * Ánh xạ ngược WordTiming từ văn bản đã phiên âm về từng từ gốc để hiển thị phụ đề đẹp.
 */
export function remapSpokenWordsToOriginal(
  plan: PronunciationPlan,
  spokenTimings: WordTiming[],
  fallbackDurationSec = 1
): WordTiming[] {
  const { tokenSpans, originalWords } = plan;
  if (originalWords.length === 0) return [];
  if (!spokenTimings || spokenTimings.length === 0) {
    const totalMs = Math.max(500, Math.round(fallbackDurationSec * 1000));
    const totalChars = originalWords.reduce((s, w) => s + w.length, 0) || originalWords.length;
    let cur = 0;
    return originalWords.map((w, idx) => {
      const dur = (w.length / totalChars) * totalMs;
      const start = Math.round(cur);
      const end = idx === originalWords.length - 1 ? totalMs : Math.round(cur + dur);
      cur = end;
      return { word: w, start, end };
    });
  }

  const expectedSpokenCount =
    tokenSpans.length > 0 ? tokenSpans[tokenSpans.length - 1].endIdx : 0;

  // Khớp chính xác số lượng token hoặc xấp xỉ rất sát
  if (spokenTimings.length === expectedSpokenCount) {
    return tokenSpans.map((span) => {
      const first = spokenTimings[span.startIdx];
      const last = spokenTimings[span.endIdx - 1] || first;
      return {
        word: span.originalWord,
        start: first.start,
        end: Math.max(first.start + 40, last.end),
      };
    });
  }

  // Fallback tỉ lệ theo tổng thời lượng thực của spokenTimings (nếu TTS gộp/tách dấu câu)
  const firstStart = spokenTimings[0].start;
  const lastEnd = Math.max(firstStart + 300, spokenTimings[spokenTimings.length - 1].end);
  const totalSpanMs = lastEnd - firstStart;
  const totalWeight = tokenSpans.reduce(
    (sum, span) => sum + Math.max(1, span.spokenWords.join('').length),
    0
  );

  let cur = firstStart;
  return tokenSpans.map((span, idx) => {
    const weight = Math.max(1, span.spokenWords.join('').length);
    const dur = (weight / totalWeight) * totalSpanMs;
    const start = Math.round(cur);
    const end = idx === tokenSpans.length - 1 ? lastEnd : Math.max(start + 40, Math.round(cur + dur));
    cur = end;
    return { word: span.originalWord, start, end };
  });
}
