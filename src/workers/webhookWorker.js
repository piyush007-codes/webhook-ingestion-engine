// src/workers/webhookWorker.js
import 'dotenv/config';
import mongoose from 'mongoose';
import { Worker } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { WebhookEvent } from '../models/WebhookEvent.js';

// Connect worker to MongoDB Atlas
if (process.env.MONGODB_URI) {
  mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => console.log('[Worker DB] Connected to MongoDB Atlas'))
    .catch((err) => console.error('[Worker DB Error]', err.message));
} else {
  console.warn('[Worker DB] MONGODB_URI missing in .env');
}

// Business logic simulator based on eventType
const processBusinessLogic = async (job) => {
  const { eventId, eventType } = job.data;
  console.log(`[Worker] Starting work for event: ${eventId} (${eventType})`);

  // Simulate async processing work
  await new Promise((resolve) => setTimeout(resolve, 2000));

  switch (eventType) {
    case 'payment.succeeded':
    case 'payment.failed_test':
      console.log(`[Worker] Event ${eventId} processed successfully.`);
      return { status: 'SUCCESS', processedAt: new Date().toISOString() };
    default:
      return { status: 'PROCESSED', processedAt: new Date().toISOString() };
  }
};

const webhookWorker = new Worker(
  'webhook-queue',
  async (job) => {
    const { dbId, eventId } = job.data;
    console.log(`[Worker] Picked up job ${job.id} for event ${eventId}`);

    // Update status to PROCESSING
    if (dbId) {
      await WebhookEvent.findByIdAndUpdate(dbId, {
        status: 'PROCESSING',
        $inc: { attempts: 1 }
      });
    }

    const result = await processBusinessLogic(job);

    // Update status to COMPLETED
    if (dbId) {
      await WebhookEvent.findByIdAndUpdate(dbId, {
        status: 'COMPLETED',
        result,
        processedAt: new Date()
      });
    }

    return result;
  },
  {
    connection: redisConnection,
    concurrency: 5
  }
);

webhookWorker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} finished successfully!`);
});

webhookWorker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed with reason: ${err.message}`);
});

webhookWorker.on('error', (err) => {
  console.error('[Worker Error]', err.message);
});

export default webhookWorker;