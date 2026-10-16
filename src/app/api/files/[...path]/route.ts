import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;
  const relativePath = pathSegments.join('/');
  const storageRoot = path.resolve(process.env.STORAGE_PATH || './storage');
  const fullPath = path.resolve(storageRoot, relativePath);

  // Ngăn chặn Path Traversal
  if (!fullPath.startsWith(storageRoot)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  if (!fs.existsSync(fullPath)) {
    return new NextResponse('File Not Found', { status: 404 });
  }

  const stat = fs.statSync(fullPath);
  const fileSize = stat.size;
  const range = request.headers.get('range');
  const contentType = getContentType(fullPath);

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize) {
      return new NextResponse('Requested range not satisfiable', {
        status: 416,
        headers: { 'Content-Range': `bytes */${fileSize}` },
      });
    }

    const chunksize = end - start + 1;
    const fileStream = fs.createReadStream(fullPath, { start, end });

    return new NextResponse(fileStream as unknown as ReadableStream, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize.toString(),
        'Content-Type': contentType,
      },
    });
  } else {
    const fileStream = fs.createReadStream(fullPath);
    return new NextResponse(fileStream as unknown as ReadableStream, {
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
