import { TTSOptions, TTSResult, Voice } from '@/types';
import { SUPPORTED_VOICES, getVoiceById } from './voices';
import { edgeTTSEngine } from './edge-tts';
import { googleTTSEngine } from './google-tts';

export interface TTSEngine {
  synthesize(text: string, outputPath: string, options?: TTSOptions): Promise<TTSResult>;
  listVoices(): Promise<Voice[]>;
}

export class DefaultTTSEngine implements TTSEngine {
  async synthesize(text: string, outputPath: string, options?: TTSOptions): Promise<TTSResult> {
    const voiceId = options?.voice || 'vi-VN-HoaiMyNeural';
    const voiceObj = getVoiceById(voiceId);
    const engineType = options?.engine || voiceObj?.engine || 'edge';

    if (engineType === 'google') {
      try {
        return await googleTTSEngine.synthesize(text, outputPath, options);
      } catch (err) {
        console.warn('Google TTS failed, falling back to Edge TTS:', err);
        return await edgeTTSEngine.synthesize(text, outputPath, options);
      }
    }

    return await edgeTTSEngine.synthesize(text, outputPath, options);
  }

  async listVoices(): Promise<Voice[]> {
    return SUPPORTED_VOICES;
  }
}

export const ttsEngine = new DefaultTTSEngine();

