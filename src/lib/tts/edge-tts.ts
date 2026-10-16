import { spawn } from 'child_process';
import path from 'path';
import { TTSOptions, TTSResult } from '@/types';

export async function synthesizeWithEdgeTTS(
  text: string,
  outputPath: string,
  options?: TTSOptions
): Promise<TTSResult> {
  const voice = options?.voice || 'vi-VN-HoaiMyNeural';
  const speed = options?.speed ?? 1.0;
  const pitch = options?.pitch ?? 0;

  const speedDiff = Math.round((speed - 1.0) * 100);
  const rateStr = speedDiff >= 0 ? `+${speedDiff}%` : `${speedDiff}%`;
  const pitchStr = pitch >= 0 ? `+${pitch}Hz` : `${pitch}Hz`;

  const scriptPath = path.resolve('src/lib/tts/edge_tts_runner.py');
  const payload = JSON.stringify({
    text,
    voice,
    rate: rateStr,
    pitch: pitchStr,
    outputPath: path.resolve(outputPath),
  });

  return new Promise((resolve, reject) => {
    const pythonExe = process.platform === 'win32' ? 'python' : 'python3';
    const proc = spawn(pythonExe, [scriptPath, payload]);

    let stdoutData = '';
    let stderrData = '';

    proc.stdout.on('data', (chunk: Buffer) => {
      stdoutData += chunk.toString('utf-8');
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      stderrData += chunk.toString('utf-8');
    });

    proc.on('close', (code: number) => {
      if (code !== 0) {
        return reject(
          new Error(`Edge TTS failed with code ${code}: ${stderrData || stdoutData}`)
        );
      }

      try {
        const parsed = JSON.parse(stdoutData.trim());
        if (!parsed.success) {
          return reject(new Error(parsed.error || 'Edge TTS returned failure'));
        }
        resolve({
          audioPath: parsed.audioPath,
          audioDuration: parsed.audioDuration,
          words: parsed.words || [],
        });
      } catch (err) {
        reject(new Error(`Failed to parse Edge TTS output: ${err} - Output: ${stdoutData}`));
      }
    });

    proc.on('error', (err: Error) => {
      reject(new Error(`Failed to spawn Python process for Edge TTS: ${err.message}`));
    });
  });
}
