import ffmpeg from 'fluent-ffmpeg';

// Fluent-ffmpeg will use system PATH by default.
// In containerized environment or local systems, custom paths can be set via env variables.
if (process.env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
}

if (process.env.FFPROBE_PATH) {
  ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);
}

export default ffmpeg;
