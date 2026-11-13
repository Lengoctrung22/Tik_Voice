import ffmpeg from './ffmpeg';
import fs from 'fs';
import path from 'path';

export interface MediaProbeResult {
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
}

export function probeMedia(filePath: string): Promise<MediaProbeResult> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err || !data) {
        return resolve({ duration: 30, width: 1080, height: 1920, hasAudio: false });
      }
      const videoStream = data.streams?.find((s) => s.codec_type === 'video');
      const audioStream = data.streams?.find((s) => s.codec_type === 'audio');
      const duration =
        Number(data.format?.duration) ||
        Number(videoStream?.duration) ||
        Number(audioStream?.duration) ||
        30;
      const width = videoStream?.width || 1080;
      const height = videoStream?.height || 1920;
      resolve({
        duration: Math.round(duration * 100) / 100,
        width,
        height,
        hasAudio: Boolean(audioStream),
      });
    });
  });
}

export function probeAudioDuration(filePath: string, fallbackSeconds = 1): Promise<number> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err || !data) {
        return resolve(fallbackSeconds);
      }
      const audioStream = data.streams?.find((s) => s.codec_type === 'audio');
      const duration = Number(data.format?.duration) || Number(audioStream?.duration) || fallbackSeconds;
      resolve(Math.max(0.2, Math.round(duration * 100) / 100));
    });
  });
}

/**
 * Trích xuất ảnh thumbnail JPEG sắc nét cho thẻ dự án trên Dashboard (không phải tải cả video).
 */
export function generateVideoThumbnail(
  videoPath: string,
  outputPath: string,
  seekSeconds = 0.5
): Promise<string | null> {
  return new Promise((resolve) => {
    if (!fs.existsSync(videoPath)) {
      return resolve(null);
    }

    const dir = path.dirname(path.resolve(outputPath));
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const runExtract = (ss: number, allowRetry: boolean) => {
      ffmpeg(videoPath)
        .inputOptions([`-ss ${ss}`])
        .outputOptions([
          '-vframes 1',
          '-vf scale=360:-2:force_original_aspect_ratio=decrease',
          '-q:v 4',
          '-y',
        ])
        .output(outputPath)
        .on('end', () => {
          if (fs.existsSync(outputPath)) {
            resolve(outputPath);
          } else if (allowRetry && ss > 0) {
            runExtract(0, false);
          } else {
            resolve(null);
          }
        })
        .on('error', () => {
          if (allowRetry && ss > 0) {
            runExtract(0, false);
          } else {
            resolve(null);
          }
        })
        .run();
    };

    runExtract(Math.max(0, seekSeconds), true);
  });
}
