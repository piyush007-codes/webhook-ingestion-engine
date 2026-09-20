// src/workers/webhookWorker.js
const { Worker } = require('bullmq');
const redisConnection = require('../config/redis');
const WebhookEvent = require('../models/WebhookEvent');


// Business logic simulator based on eventType
// Ensure this is clean/normal in src/workers/webhookWorker.js
const processBusinessLogic = async (job) => {
  const { eventId, eventType } = job.data;
  console.log(`[Worker] Starting work for event: ${eventId} (${eventType})`);

  // Simulate work
  await new Promise((resolve) => setTimeout(resolve, 2000));

  switch (eventType) {
    case 'payment.succeeded':
    case 'payment.failed_test': // Allow it to succeed now!
      console.log(`[Worker] Payment verified for ${eventId}. Fulfilling customer order...`);
      break;
    default:
      console.log(`[Worker] Generic event handled: ${eventType}`);
  }

  return { processedAt: new Date(), status: 'SUCCESS' };
};


// src/workers/webhookWorker.js


// Initialize the worker instance
const webhookWorker = new Worker(
  'webhook-processing',
  async (job) => {
    const { dbId, eventId } = job.data;

    // 1. Transition state to PROCESSING in MongoDB
    await WebhookEvent.findByIdAndUpdate(dbId, {
      status: 'PROCESSING',
      updatedAt: new Date(),
    });

    try {
      // 2. Execute business logic
      const result = await processBusinessLogic(job);

      // 3. Mark state as COMPLETED
      await WebhookEvent.findByIdAndUpdate(dbId, {
        status: 'COMPLETED',
        processedAt: new Date(),
        result,
      });

      console.log(`[Worker] Job ${job.id} for event ${eventId} finished successfully.`);
    } catch (error) {
      console.error(`[Worker Error] Failed job ${job.id} for event ${eventId}:`, error.message);

      // If final retry attempt exhausted, flag as FAILED
      if (job.attemptsMade + 1 >= job.opts.attempts) {
        await WebhookEvent.findByIdAndUpdate(dbId, {
          status: 'FAILED',
          errorMessage: error.message,
        });
      }

      // Re-throw so BullMQ initiates the retry backoff sequence
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5, // Process up to 5 concurrent jobs
  }
);

webhookWorker.on('ready', () => {
  console.log('[Worker] Webhook processing worker is ready and listening for jobs');
});

webhookWorker.on('failed', (job, err) => {
  console.error(`[Worker Event] Job ${job?.id} failed: ${err.message}`);
});

module.exports = webhookWorker;