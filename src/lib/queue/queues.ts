import { Queue } from 'bullmq';
import { getRedisConnectionOptions } from './connection';

const connection = getRedisConnectionOptions();

declare global {
  // eslint-disable-next-line no-var
  var videoQueueInstance: Queue | undefined;
}

export const VIDEO_QUEUE_NAME = 'video-processing';

export function getVideoQueue(): Queue {
  if (global.videoQueueInstance) {
    return global.videoQueueInstance;
  }

  const queue = new Queue(VIDEO_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: {
        age: 24 * 3600,
        count: 500,
      },
      removeOnFail: {
        age: 48 * 3600,
      },
    },
  });

  global.videoQueueInstance = queue;
  return queue;
}
