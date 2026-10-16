import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'mongoose',
    'bullmq',
    'ioredis',
    'fluent-ffmpeg',
    'archiver',
  ],
};

export default nextConfig;
