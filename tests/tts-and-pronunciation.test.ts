import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildPronunciationPlan,
  remapSpokenWordsToOriginal,
} from '@/lib/tts/pronunciation';
import { resolveEdgeFallbackVoice } from '@/lib/tts/voices';

vi.mock('@/lib/tts/edge-tts', () => ({
  edgeTTSEngine: {
    synthesize: vi.fn(),
    listVoices: vi.fn(),
  },
}));

vi.mock('@/lib/tts/google-tts', () => ({
  buildMarkedSsml: (words: string[]) =>
    `<speak>${words
      .map((w, i) => `<mark name="w${i}"/>${w.replace(/&/g, '&amp;')}`)
      .join(' ')}</speak>`,
  googleTTSEngine: {
    synthesize: vi.fn(),
    listVoices: vi.fn(),
  },
}));

import { DefaultTTSEngine } from '@/lib/tts/engine';
import { edgeTTSEngine } from '@/lib/tts/edge-tts';
import { googleTTSEngine, buildMarkedSsml } from '@/lib/tts/google-tts';

describe('Pronunciation dictionary & TTS Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds spoken pronunciation plan while keeping original words intact', () => {
    const plan = buildPronunciationPlan('Serum B5 50ml SPF50 giảm 50% chỉ 199k');
    expect(plan.originalWords).toEqual([
      'Serum',
      'B5',
      '50ml',
      'SPF50',
      'giảm',
      '50%',
      'chỉ',
      '199k',
    ]);
    expect(plan.spokenText).toContain('xê rum');
    expect(plan.spokenText).toContain('50 mi li lít');
    expect(plan.spokenText).toContain('50 phần trăm');
    expect(plan.spokenText).toContain('199 nghìn');
    expect(plan.spokenText).toContain('ét pê ép 50');
  });

  it('handles empty input in buildPronunciationPlan', () => {
    const plan = buildPronunciationPlan('   ');
    expect(plan.originalWords).toEqual([]);
    expect(plan.spokenText).toBe('');
    expect(plan.tokenSpans).toEqual([]);
  });

  it('remaps multi-syllable spoken timestamps back onto original words', () => {
    const plan = buildPronunciationPlan('Serum 50ml');
    const spokenParts = plan.spokenText.split(/\s+/);
    const mockSpokenTimings = spokenParts.map((word, idx) => ({
      word,
      start: idx * 200,
      end: (idx + 1) * 200,
    }));

    const remapped = remapSpokenWordsToOriginal(plan, mockSpokenTimings, 2.0);
    expect(remapped).toHaveLength(2);
    expect(remapped[0].word).toBe('Serum');
    expect(remapped[0].start).toBe(0);
    expect(remapped[1].word).toBe('50ml');
    expect(remapped[1].end).toBe(spokenParts.length * 200);
  });

  it('falls back proportionally when spoken token count differs from plan', () => {
    const plan = buildPronunciationPlan('Serum B5 giá 199k');
    const remapped = remapSpokenWordsToOriginal(
      plan,
      [{ word: 'toàn bộ', start: 0, end: 2000 }],
      2.0
    );
    expect(remapped.map((w) => w.word)).toEqual(['Serum', 'B5', 'giá', '199k']);
    expect(remapped[0].start).toBe(0);
    expect(remapped[remapped.length - 1].end).toBe(2000);
  });

  it('maps Google voice genders to matching Edge fallback voices', () => {
    expect(resolveEdgeFallbackVoice('vi-VN-Wavenet-A')).toBe('vi-VN-HoaiMyNeural');
    expect(resolveEdgeFallbackVoice('vi-VN-Neural2-A')).toBe('vi-VN-HoaiMyNeural');
    expect(resolveEdgeFallbackVoice('vi-VN-Wavenet-B')).toBe('vi-VN-NamMinhNeural');
    expect(resolveEdgeFallbackVoice('vi-VN-Neural2-D')).toBe('vi-VN-NamMinhNeural');
  });

  it('builds marked SSML for Google TTS timepointing', () => {
    const ssml = buildMarkedSsml(['Kem', 'A&B']);
    expect(ssml).toBe('<speak><mark name="w0"/>Kem <mark name="w1"/>A&amp;B</speak>');
  });

  it('falls back gracefully from Google TTS to gender-matched Edge TTS and preserves original words', async () => {
    vi.mocked(googleTTSEngine.synthesize).mockRejectedValueOnce(
      new Error('Missing GOOGLE_APPLICATION_CREDENTIALS')
    );

    vi.mocked(edgeTTSEngine.synthesize).mockImplementationOnce(async (spokenText, outPath) => {
      const tokens = spokenText.split(/\s+/);
      return {
        audioPath: outPath,
        audioDuration: 2.0,
        words: tokens.map((w, i) => ({ word: w, start: i * 150, end: (i + 1) * 150 })),
      };
    });

    const engine = new DefaultTTSEngine();
    const res = await engine.synthesize('Serum xịn', '/tmp/out.mp3', {
      engine: 'google',
      voice: 'vi-VN-Neural2-D',
      applyPronunciation: true,
    });

    expect(edgeTTSEngine.synthesize).toHaveBeenCalledWith(
      'xê rum xịn',
      '/tmp/out.mp3',
      expect.objectContaining({
        engine: 'edge',
        voice: 'vi-VN-NamMinhNeural',
      })
    );
    expect(res.fallbackFrom).toBe('google');
    expect(res.actualEngine).toBe('edge');
    expect(res.actualVoice).toBe('vi-VN-NamMinhNeural');
    expect(res.words.map((w) => w.word)).toEqual(['Serum', 'xịn']);
  });
});
