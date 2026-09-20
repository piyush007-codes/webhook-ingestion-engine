// src/queues/webhookQueue.js
const { Queue } = require('bullmq');
const redisConnection = require('../config/redis');

// Create the 'webhook-processing' queue backed by our Redis connection
const webhookQueue = new Queue('webhook-processing', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3, // Retry up to 3 times on failure
    backoff: {
      type: 'exponential',
      delay: 3000, // Wait 3s after 1st failure, 6s after 2nd failure
    },
    removeOnComplete: true, // Auto-cleanup completed jobs to save Redis memory
    removeOnFail: false,    // Keep failed jobs for inspection / Dead Letter Queue
  },
});

module.exports = webhookQueue;