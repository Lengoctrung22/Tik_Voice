import { describe, expect, it } from 'vitest';
import {
  ensureRedisAvailable,
  getRedisConnectionOptions,
  getRedisQueueConnectionOptions,
} from '@/lib/queue/connection';

describe('Redis & Queue connection safety', () => {
  it('keeps maxRetriesPerRequest: null for BullMQ Worker while making Queue options fail fast', () => {
    const workerOpts = getRedisConnectionOptions() as { maxRetriesPerRequest?: unknown };
    const queueOpts = getRedisQueueConnectionOptions() as {
      maxRetriesPerRequest?: unknown;
      enableOfflineQueue?: unknown;
      connectTimeout?: unknown;
    };

    expect(workerOpts.maxRetriesPerRequest).toBeNull();
    expect(queueOpts.maxRetriesPerRequest).toBe(1);
    expect(queueOpts.enableOfflineQueue).toBe(false);
    expect(typeof queueOpts.connectTimeout).toBe('number');
  });

  it('fails fast in ensureRedisAvailable when Redis server is unreachable', async () => {
    const prev = process.env.REDIS_URL;
    process.env.REDIS_URL = 'redis://127.0.0.1:6399';
    try {
      const start = Date.now();
      await expect(ensureRedisAvailable(400)).rejects.toThrow(/Redis|BullMQ/i);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(2000);
    } finally {
      if (prev === undefined) delete process.env.REDIS_URL;
      else process.env.REDIS_URL = prev;
    }
  });
});
