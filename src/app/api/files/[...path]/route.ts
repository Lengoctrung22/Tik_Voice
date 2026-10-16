import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;
  const relativePath = pathSegments.join('/');
  const storageRoot = path.resolve(process.env.STORAGE_PATH || './storage');
  const fullPath = path.resolve(storageRoot, relativePath);

  const expectedRoot = path.resolve(process.env.STORAGE_PATH || './storage');

  // Ngăn chặn Path Traversal
  const rel = path.relative(expectedRoot, fullPath);
  if (!fullPath.startsWith(expectedRoot) || rel.startsWith('..') || path.isAbsolute(rel)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  if (!fs.existsSync(fullPath)) {
    return new NextResponse('File Not Found', { status: 404 });
  }

  const stat = fs.statSync(fullPath);
  if (!stat.isFile()) {
    return new NextResponse('File Not Found', { status: 404 });
  }

  const fileSize = stat.size;
  const range = request.headers.get('range');
  const contentType = getContentType(fullPath);

  if (range) {
    const cleanRange = range.replace(/^bytes\s*=\s*/, '');
    const parts = cleanRange.split('-');
    let start = parts[0] ? parseInt(parts[0], 10) : NaN;
    let end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    // Support suffix range e.g. bytes=-500 (last 500 bytes)
    if (isNaN(start) && parts[1]) {
      const suffixLength = parseInt(parts[1], 10);
      if (!isNaN(suffixLength)) {
        start = Math.max(0, fileSize - suffixLength);
        end = fileSize - 1;
      }
    }

    if (isNaN(start) || start >= fileSize || start < 0) {
      return new NextResponse('Requested range not satisfiable', {
        status: 416,
        headers: { 'Content-Range': `bytes */${fileSize}` },
      });
    }

    const safeEnd = Math.min(end, fileSize - 1);
    if (safeEnd < start) {
      return new NextResponse('Requested range not satisfiable', {
        status: 416,
        headers: { 'Content-Range': `bytes */${fileSize}` },
      });
    }

    const chunksize = safeEnd - start + 1;
    const fileStream = fs.createReadStream(fullPath, { start, end: safeEnd });
    const webStream = Readable.toWeb(fileStream);

    return new NextResponse(webStream as unknown as ReadableStream, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${safeEnd}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize.toString(),
        'Content-Type': contentType,
      },
    });
  } else {
    const fileStream = fs.createReadStream(fullPath);
    const webStream = Readable.toWeb(fileStream);
    return new NextResponse(webStream as unknown as ReadableStream, {
      status: 200,
      headers: {
        'Content-Length': fileSize.toString(),
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
      },
    });
  }
}

function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.mp4':
      return 'video/mp4';
    case '.mov':
      return 'video/quicktime';
    case '.webm':
      return 'video/webm';
    case '.mp3':
      return 'audio/mpeg';
    case '.wav':
      return 'audio/wav';
    case '.ass':
      return 'text/plain; charset=utf-8';
    default:
      return 'application/octet-stream';
  }
}
