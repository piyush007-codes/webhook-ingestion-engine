// src/config/redis.js
import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL;

let redisConnection;

if (redisUrl) {
  redisConnection = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
} else {
  redisConnection = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

redisConnection.on('connect', () => {
  console.log('[Redis] Connected successfully to Redis instance');
});

redisConnection.on('error', (err) => {
  console.error('[Redis Error]', err.message);
});

export { redisConnection };
export default redisConnection;