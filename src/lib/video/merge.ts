import ffmpeg from './ffmpeg';
import path from 'path';
import fs from 'fs';

export interface DynamicRenderConfig {
  videoPath: string;
  videoDuration: number;
  audioPath: string;
  audioDuration: number;
  subtitlePath?: string;
  subtitleEnabled: boolean;
  bgMusicPath?: string;
  bgMusicVolume?: number;
  bgMusicFadeIn?: number;
  bgMusicFadeOut?: number;
  outputPath: string;
  quality: 'fast' | 'balanced' | 'high';
  onProgress?: (percent: number) => void;
}

export function executeRenderPipeline(config: DynamicRenderConfig): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(config.videoPath)) {
      return reject(new Error(`Tệp video không tồn tại: ${config.videoPath}`));
    }
    if (!fs.existsSync(config.audioPath)) {
      return reject(new Error(`Tệp audio không tồn tại: ${config.audioPath}`));
    }

    let command = ffmpeg();

    // 1. Loop video gốc nếu ngắn hơn giọng đọc TTS
    if (config.videoDuration < config.audioDuration) {
      command = command.input(config.videoPath).inputOptions(['-stream_loop', '-1']);
    } else {
      command = command.input(config.videoPath);
    }

    // Input 1: Audio giọng đọc TTS
    command = command.input(config.audioPath);

    const filterParts: string[] = [];
    let currentVideoLabel = 'v0';
    let audioMapOption = '1:a'; // Mặc định map trực tiếp từ input 1 (KHÔNG có ngoặc vuông)

    // Scale & Pad video về chuẩn 1080x1920 (TikTok 9:16)
    filterParts.push(
      `[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black[${currentVideoLabel}]`
    );

    // Xử lý nhạc nền
    const hasBgMusic = config.bgMusicPath && fs.existsSync(config.bgMusicPath);
    if (hasBgMusic) {
      // Loop nhạc nền vô hạn để không bị ngắt quãng giữa chừng
      command = command.input(config.bgMusicPath!).inputOptions(['-stream_loop', '-1']);

      const volume = config.bgMusicVolume ?? 0.12;
      const fadeIn = config.bgMusicFadeIn ?? 2;
      const fadeOut = config.bgMusicFadeOut ?? 3;
      const actualFadeOut = Math.min(fadeOut, Math.max(0.5, config.audioDuration));
      const fadeOutStart = Math.max(0, config.audioDuration - actualFadeOut);

      filterParts.push(
        `[2:a]volume=${volume},afade=t=in:st=0:d=${fadeIn},afade=t=out:st=${fadeOutStart}:d=${actualFadeOut}[bgm]`,
        `[1:a][bgm]amix=inputs=2:duration=first:dropout_transition=2[a0]`
      );
      audioMapOption = '[a0]'; // Khi có filter amix thì map qua nhãn [a0]
    } else {
      audioMapOption = '1:a'; // Không có nhạc nền: map thẳng stream 1:a
    }

    // Xử lý phụ đề ASS kèm fontsdir để tránh lỗi font trên Linux/Windows
    const hasSubtitle = config.subtitleEnabled && config.subtitlePath && fs.existsSync(config.subtitlePath);
    if (hasSubtitle) {
      const normalizedPath = config.subtitlePath!
        .replace(/\\/g, '/')
        .replace(/:/g, '\\:')
        .replace(/'/g, "'\\\\''");
      const fontsDir = path
        .resolve('public/fonts')
        .replace(/\\/g, '/')
        .replace(/:/g, '\\:')
        .replace(/'/g, "'\\\\''");

      filterParts.push(
        `[${currentVideoLabel}]ass='${normalizedPath}':fontsdir='${fontsDir}'[vout]`
      );
      currentVideoLabel = 'vout';
    }

    const qualityMap = {
      fast: { preset: 'ultrafast', crf: 28 },
      balanced: { preset: 'medium', crf: 23 },
      high: { preset: 'slow', crf: 18 },
    };
    const { preset, crf } = qualityMap[config.quality] || qualityMap.balanced;

    const outDir = path.dirname(path.resolve(config.outputPath));
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const renderDuration = (config.audioDuration && config.audioDuration > 0)
      ? config.audioDuration
      : (config.videoDuration || 30);

    command
      .complexFilter(filterParts)
      .outputOptions([
        `-map [${currentVideoLabel}]`,
        `-map ${audioMapOption}`,
        `-c:v libx264`,
        `-r 30`,
        `-preset ${preset}`,
        `-crf ${crf}`,
        `-c:a aac`,
        `-b:a 192k`,
        `-t ${renderDuration}`,
        `-movflags +faststart`,
        `-y`,
      ])
      .output(config.outputPath)
      .on('progress', (p) => {
        if (!config.onProgress) return;
        let calculatedPercent = typeof p.percent === 'number' && !isNaN(p.percent) ? p.percent : 0;
        if (p.timemark && renderDuration > 0) {
          const parts = p.timemark.split(':');
          if (parts.length === 3) {
            const secs = parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
            if (!isNaN(secs)) {
              calculatedPercent = (secs / renderDuration) * 100;
            }
          }
        }
        config.onProgress(Math.min(100, Math.max(0, Math.round(calculatedPercent))));
      })
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}
