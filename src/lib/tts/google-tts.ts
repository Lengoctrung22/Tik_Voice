import fs from 'fs';
import path from 'path';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { TTSOptions, TTSResult } from '@/types';

export async function synthesizeWithGoogleTTS(
  text: string,
  outputPath: string,
  options?: TTSOptions
): Promise<TTSResult> {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GOOGLE_CLOUD_API_KEY) {
    throw new Error(
      'Google Cloud TTS requires GOOGLE_APPLICATION_CREDENTIALS to be configured in .env'
    );
  }

  const client = new TextToSpeechClient();
  const voiceName = options?.voice || 'vi-VN-Wavenet-A';
  const speed = options?.speed ?? 1.0;
  const pitch = options?.pitch ?? 0;

  const [response] = (await client.synthesizeSpeech({
    input: { text },
    voice: {
      languageCode: 'vi-VN',
      name: voiceName,
      ssmlGender: voiceName.includes('B') || voiceName.includes('D') ? 'MALE' : 'FEMALE',
    },
    audioConfig: {
      audioEncoding: 'MP3',
      speakingRate: speed,
      pitch: pitch,
    },
  })) as unknown as [any];

  if (!response.audioContent) {
    throw new Error('Google Cloud TTS returned empty audio content');
  }

  const resolvedOutput = path.resolve(outputPath);
  const dir = path.dirname(resolvedOutput);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  await fs.promises.writeFile(resolvedOutput, response.audioContent as Buffer);

  // Estimate words duration if time points are not present
  const wordsRaw = text.trim().split(/\s+/).filter(Boolean);
  const audioBuffer = response.audioContent as Buffer;
  // Approximation for MP3 duration: size in bits / bitrate (128kbps default = 16000 bytes/sec)
  const approxDuration = Math.max(1, audioBuffer.length / 16000);

  const totalChars = wordsRaw.reduce((sum, w) => sum + w.length, 0);
  let currentMs = 0;
  const words = wordsRaw.map((w, idx) => {
    const wordDurMs = (w.length / totalChars) * (approxDuration * 1000);
    const start = Math.round(currentMs);
    const end = idx === wordsRaw.length - 1 ? Math.round(approxDuration * 1000) : Math.round(currentMs + wordDurMs);
    currentMs = end;
    return { word: w, start, end };
  });

  return {
    audioPath: resolvedOutput,
    audioDuration: Math.round(approxDuration * 100) / 100,
    words,
  };
}
