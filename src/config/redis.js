// src/config/redis.js
const IORedis = require('ioredis');

if (!process.env.REDIS_URL) {
  console.error('[Redis Config Error] REDIS_URL is not set in environment variables');
  process.exit(1);
}

// Dedicated connection configuration for BullMQ
const redisConnection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ for blocking operations
  enableReadyCheck: false,
});

redisConnection.on('connect', () => {
  console.log('[Redis] Connected successfully to Cloud Redis instance');
});

redisConnection.on('error', (err) => {
  console.error('[Redis Error]', err.message);
});

module.exports = redisConnection;