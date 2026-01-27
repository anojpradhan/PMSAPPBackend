import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error('REDIS_URL is not defined in environment variables');
}

export const redisProvider = {
  provide: 'REDIS_CLIENT',
  useFactory: () => new Redis(redisUrl),
};
