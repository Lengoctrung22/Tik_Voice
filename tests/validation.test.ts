import { describe, expect, it } from 'vitest';
import {
  MAX_AUDIO_UPLOAD_BYTES,
  MAX_IMAGE_UPLOAD_BYTES,
  MAX_VIDEO_UPLOAD_BYTES,
  parseResolution,
  presetCreateSchema,
  projectPatchSchema,
  renderRequestSchema,
  validateUploadMetadata,
} from '@/lib/validation/schemas';

describe('Validation schemas & upload rules', () => {
  it('validates upload metadata boundaries cleanly', () => {
    expect(
      validateUploadMetadata(
        { name: 'clip.mp4', type: 'video/mp4', size: 1024 * 1024 },
        'video'
      )
    ).toEqual({ ok: true, category: 'video', ext: '.mp4' });

    const emptyRes = validateUploadMetadata(
      { name: 'empty.mp4', type: 'video/mp4', size: 0 },
      'video'
    );
    expect(emptyRes.ok).toBe(false);
    if (!emptyRes.ok) expect(emptyRes.status).toBe(400);

    const tooBigVideo = validateUploadMetadata(
      { name: 'huge.mp4', type: 'video/mp4', size: MAX_VIDEO_UPLOAD_BYTES + 1 },
      'video'
    );
    expect(tooBigVideo.ok).toBe(false);
    if (!tooBigVideo.ok) expect(tooBigVideo.status).toBe(413);

    const tooBigAudio = validateUploadMetadata(
      { name: 'song.mp3', type: 'audio/mpeg', size: MAX_AUDIO_UPLOAD_BYTES + 1 },
      'music'
    );
    expect(tooBigAudio.ok).toBe(false);
    if (!tooBigAudio.ok) expect(tooBigAudio.status).toBe(413);

    const tooBigImg = validateUploadMetadata(
      { name: 'logo.png', type: 'image/png', size: MAX_IMAGE_UPLOAD_BYTES + 1 },
      'watermark'
    );
    expect(tooBigImg.ok).toBe(false);
    if (!tooBigImg.ok) expect(tooBigImg.status).toBe(413);

    const badExt = validateUploadMetadata(
      { name: 'malware.exe', type: 'application/x-msdownload', size: 500 },
      'video'
    );
    expect(badExt.ok).toBe(false);

    const badType = validateUploadMetadata(
      { name: 'a.mp4', type: 'video/mp4', size: 100 },
      'invalid_cat'
    );
    expect(badType.ok).toBe(false);
  });

  it('allows valid partial project updates and rejects strict disallowed fields', () => {
    const valid = projectPatchSchema.safeParse({
      name: 'Review Son Kem',
      video: { aspectMode: 'blur', originalVolume: 0.25 },
      subtitle: {
        enabled: true,
        style: {
          fontFamily: 'Montserrat',
          fontWeight: 'black',
          animation: 'bounce',
          maxCharsPerLine: 22,
          primaryColor: '#FFFFFF',
        },
      },
      bgMusic: null,
    });
    expect(valid.success).toBe(true);

    const rejectedExtra = projectPatchSchema.safeParse({
      _id: 'hack',
      status: 'done',
    });
    expect(rejectedExtra.success).toBe(false);

    const rejectedColor = projectPatchSchema.safeParse({
      subtitle: { style: { primaryColor: 'not-a-hex' } },
    });
    expect(rejectedColor.success).toBe(false);

    const rejectedFont = projectPatchSchema.safeParse({
      subtitle: { style: { fontFamily: 'Comic Sans MS' } },
    });
    expect(rejectedFont.success).toBe(false);
  });

  it('parses render request and resolutions accurately', () => {
    const defaultRender = renderRequestSchema.parse({});
    expect(defaultRender).toEqual({ quality: 'balanced', resolution: '1080x1920' });

    expect(parseResolution('720x1280')).toEqual({
      width: 720,
      height: 1280,
      key: '720x1280',
    });
    expect(parseResolution('1080x1920')).toEqual({
      width: 1080,
      height: 1920,
      key: '1080x1920',
    });
    expect(parseResolution(undefined)).toEqual({
      width: 1080,
      height: 1920,
      key: '1080x1920',
    });
  });

  it('validates brand preset creation payloads', () => {
    const bad = presetCreateSchema.safeParse({ name: '   ' });
    expect(bad.success).toBe(false);

    const ok = presetCreateSchema.parse({ name: 'Kênh Mỹ Phẩm', aspectMode: 'blur' });
    expect(ok.voice).toBe('vi-VN-HoaiMyNeural');
    expect(ok.aspectMode).toBe('blur');
    expect(ok.exportResolution).toBe('1080x1920');
  });
});
