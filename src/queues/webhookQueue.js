// src/queues/webhookQueue.js
import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis.js';

export const webhookQueue = new Queue('webhook-queue', {
  connection: redisConnection
});

export default webhookQueue;