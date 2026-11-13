import { TTSOptions, TTSResult, Voice } from '@/types';
import { SUPPORTED_VOICES, getVoiceById, resolveEdgeFallbackVoice } from './voices';
import { edgeTTSEngine } from './edge-tts';
import { googleTTSEngine } from './google-tts';
import { buildPronunciationPlan, remapSpokenWordsToOriginal } from './pronunciation';

export interface TTSEngine {
  synthesize(text: string, outputPath: string, options?: TTSOptions): Promise<TTSResult>;
  listVoices(): Promise<Voice[]>;
}

export class DefaultTTSEngine implements TTSEngine {
  async synthesize(text: string, outputPath: string, options?: TTSOptions): Promise<TTSResult> {
    const voiceId = options?.voice || 'vi-VN-HoaiMyNeural';
    const voiceObj = getVoiceById(voiceId);
    const engineType = options?.engine || voiceObj?.engine || 'edge';
    const applyPronunciation = options?.applyPronunciation ?? true;

    const plan = applyPronunciation ? buildPronunciationPlan(text) : null;
    const textForSynthesis = plan ? plan.spokenText : text;

    let rawResult: TTSResult;

    if (engineType === 'google') {
      try {
        rawResult = await googleTTSEngine.synthesize(textForSynthesis, outputPath, options);
        rawResult.actualEngine = 'google';
        rawResult.actualVoice = voiceId;
      } catch (err) {
        const fallbackVoice = resolveEdgeFallbackVoice(voiceId);
        console.warn(
          `Google TTS thất bại (${err instanceof Error ? err.message : String(err)}), tự động chuyển sang Edge TTS (${fallbackVoice})`
        );
        rawResult = await edgeTTSEngine.synthesize(textForSynthesis, outputPath, {
          ...options,
          engine: 'edge',
          voice: fallbackVoice,
        });
        rawResult.actualEngine = 'edge';
        rawResult.actualVoice = fallbackVoice;
        rawResult.fallbackFrom = 'google';
      }
    } else {
      const edgeVoice = voiceObj?.engine === 'edge' ? voiceId : resolveEdgeFallbackVoice(voiceId);
      rawResult = await edgeTTSEngine.synthesize(textForSynthesis, outputPath, {
        ...options,
        engine: 'edge',
        voice: edgeVoice,
      });
      rawResult.actualEngine = 'edge';
      rawResult.actualVoice = edgeVoice;
    }

    if (plan && plan.originalWords.length > 0) {
      rawResult.words = remapSpokenWordsToOriginal(
        plan,
        rawResult.words,
        rawResult.audioDuration
      );
    }

    return rawResult;
  }

  async listVoices(): Promise<Voice[]> {
    return SUPPORTED_VOICES;
  }
}

export const ttsEngine = new DefaultTTSEngine();
