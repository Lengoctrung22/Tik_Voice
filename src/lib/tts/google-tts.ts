import fs from 'fs';
import path from 'path';
import { v1beta1, protos } from '@google-cloud/text-to-speech';
import { TTSOptions, TTSResult, Voice } from '@/types';
import type { TTSEngine } from './engine';
import { SUPPORTED_VOICES } from './voices';
import { probeAudioDuration } from '@/lib/video/probe';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildMarkedSsml(words: string[]): string {
  const body = words.map((w, idx) => `<mark name="w${idx}"/>${escapeXml(w)}`).join(' ');
  return `<speak>${body}</speak>`;
}

export async function synthesizeWithGoogleTTS(
  text: string,
  outputPath: string,
  options?: TTSOptions
): Promise<TTSResult> {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GOOGLE_CLOUD_API_KEY) {
    throw new Error(
      'Google Cloud TTS chưa được cấu hình (cần GOOGLE_APPLICATION_CREDENTIALS hoặc GOOGLE_CLOUD_API_KEY).'
    );
  }

  const clientOptions: { apiKey?: string; keyFilename?: string } = {};
  if (process.env.GOOGLE_CLOUD_API_KEY) {
    clientOptions.apiKey = process.env.GOOGLE_CLOUD_API_KEY;
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    clientOptions.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  }

  const client = new v1beta1.TextToSpeechClient(clientOptions);
  const voiceName = options?.voice || 'vi-VN-Wavenet-A';
  const speed = options?.speed ?? 1.0;
  const pitch = options?.pitch ?? 0;

  const wordsRaw = text.trim().split(/\s+/).filter(Boolean);
  const ssml = buildMarkedSsml(wordsRaw);

  const request: protos.google.cloud.texttospeech.v1beta1.ISynthesizeSpeechRequest = {
    input: { ssml },
    voice: {
      languageCode: 'vi-VN',
      name: voiceName,
      ssmlGender: /(?:Wavenet|Neural2|Standard)-[BD]/i.test(voiceName) ? 'MALE' : 'FEMALE',
    },
    audioConfig: {
      audioEncoding: 'MP3',
      speakingRate: speed,
      pitch,
    },
    enableTimePointing: [
      protos.google.cloud.texttospeech.v1beta1.SynthesizeSpeechRequest.TimepointType.SSML_MARK,
    ],
  };

  const [response] = await client.synthesizeSpeech(request);

  if (!response.audioContent) {
    throw new Error('Google Cloud TTS trả về nội dung âm thanh rỗng.');
  }

  const resolvedOutput = path.resolve(outputPath);
  const dir = path.dirname(resolvedOutput);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const audioBuffer = Buffer.from(response.audioContent as Uint8Array);
  await fs.promises.writeFile(resolvedOutput, audioBuffer);

  // Đo chính xác thời lượng tệp MP3 bằng ffprobe thay vì ước lượng byte/16000
  const fallbackApprox = Math.max(0.5, audioBuffer.length / 16000);
  const actualDurationSec = await probeAudioDuration(resolvedOutput, fallbackApprox);
  const totalDurationMs = Math.round(actualDurationSec * 1000);

  const timepointMap = new Map<string, number>();
  for (const tp of response.timepoints || []) {
    if (tp.markName && typeof tp.timeSeconds === 'number') {
      timepointMap.set(tp.markName, Math.round(tp.timeSeconds * 1000));
    }
  }

  let words: Array<{ word: string; start: number; end: number }> = [];

  if (timepointMap.size > 0 && wordsRaw.length > 0) {
    words = wordsRaw.map((w, idx) => {
      const start =
        timepointMap.get(`w${idx}`) ??
        Math.round((idx / wordsRaw.length) * totalDurationMs);
      const nextStart =
        idx < wordsRaw.length - 1
          ? timepointMap.get(`w${idx + 1}`) ??
            Math.round(((idx + 1) / wordsRaw.length) * totalDurationMs)
          : totalDurationMs;
      return {
        word: w,
        start,
        end: Math.max(start + 50, nextStart),
      };
    });
  } else if (wordsRaw.length > 0) {
    const totalChars = wordsRaw.reduce((sum, w) => sum + w.length, 0) || wordsRaw.length;
    let currentMs = 0;
    words = wordsRaw.map((w, idx) => {
      const wordDurMs = (w.length / totalChars) * totalDurationMs;
      const start = Math.round(currentMs);
      const end =
        idx === wordsRaw.length - 1
          ? totalDurationMs
          : Math.max(start + 40, Math.round(currentMs + wordDurMs));
      currentMs = end;
      return { word: w, start, end };
    });
  }

  return {
    audioPath: resolvedOutput,
    audioDuration: actualDurationSec,
    words,
    actualEngine: 'google',
    actualVoice: voiceName,
  };
}

export class GoogleTTSEngine implements TTSEngine {
  async synthesize(text: string, outputPath: string, options?: TTSOptions): Promise<TTSResult> {
    return synthesizeWithGoogleTTS(text, outputPath, options);
  }

  async listVoices(): Promise<Voice[]> {
    return SUPPORTED_VOICES.filter((v) => v.engine === 'google');
  }
}

export const googleTTSEngine = new GoogleTTSEngine();
