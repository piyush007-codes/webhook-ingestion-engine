// src/controllers/webhookController.js
const mongoose = require('mongoose');
const WebhookEvent = require('../models/WebhookEvent');
const webhookQueue = require('../queues/webhookQueue');
const redisConnection = require('../config/redis');

// Query status and execution trace of a specific event
const getEventStatus = async (req, res) => {
  const { eventId } = req.params;

  try {
    const event = await WebhookEvent.findOne({ eventId }).select('-__v');

    if (!event) {
      return res.status(404).json({
        error: 'Event not found',
        eventId,
      });
    }

    return res.status(200).json({
      eventId: event.eventId,
      eventType: event.eventType,
      status: event.status,
      createdAt: event.createdAt,
      processedAt: event.processedAt || null,
      result: event.result || null,
      errorMessage: event.errorMessage || null,
    });
  } catch (error) {
    console.error('[Status Query Error]', error);
    return res.status(500).json({ error: 'Failed to retrieve event status' });
  }
};

// System telemetry and connectivity health check
const getHealthCheck = async (req, res) => {
  try {
    // 1. Verify MongoDB connection state (1 = connected)
    const isMongoHealthy = mongoose.connection.readyState === 1;

    // 2. Verify Redis connection by sending a PING command
    const redisPing = await redisConnection.ping();
    const isRedisHealthy = redisPing === 'PONG';

    // 3. Inspect BullMQ queue metrics
    const [waitingCount, activeCount, failedCount, completedCount] = await Promise.all([
      webhookQueue.getWaitingCount(),
      webhookQueue.getActiveCount(),
      webhookQueue.getFailedCount(),
      webhookQueue.getCompletedCount(),
    ]);

    const isSystemHealthy = isMongoHealthy && isRedisHealthy;

    return res.status(isSystemHealthy ? 200 : 503).json({
      status: isSystemHealthy ? 'HEALTHY' : 'DEGRADED',
      timestamp: new Date(),
      services: {
        database: isMongoHealthy ? 'CONNECTED' : 'DISCONNECTED',
        cache: isRedisHealthy ? 'CONNECTED' : 'DISCONNECTED',
      },
      queueMetrics: {
        waiting: waitingCount,
        active: activeCount,
        failed: failedCount,
        completed: completedCount,
      },
    });
  } catch (error) {
    console.error('[Health Check Error]', error);
    return res.status(500).json({
      status: 'UNHEALTHY',
      error: error.message,
    });
  }
};

const handleWebhook = async (req, res) => {
  const { eventId, eventType, data } = req.body;

  if (!eventId || !eventType) {
    return res.status(400).json({ error: 'Missing eventId or eventType in payload' });
  }

  const cacheKey = `idempotency:${eventId}`;
  const TTL_SECONDS = 60 * 60 * 24; // 24 hours

  try {
    // -----------------------------------------------------------
    // 1. FAST RAM GUARD (Redis SETNX)
    // Intercepts duplicates in memory before touching MongoDB Atlas
    // -----------------------------------------------------------
    const acquiredLock = await redisConnection.set(
      cacheKey,
      'ACQUIRED',
      'EX',
      TTL_SECONDS,
      'NX'
    );

    if (!acquiredLock) {
      console.log(`[Idempotency Guard] Duplicate event ${eventId} blocked in RAM`);
      return res.status(200).json({
        status: 'IGNORED_DUPLICATE',
        message: 'Event already processed or currently pending (intercepted by cache)',
        eventId,
      });
    }

    // -----------------------------------------------------------
    // 2. PERSISTENT STORAGE (MongoDB Atlas)
    // Only true first-time requests reach the database
    // -----------------------------------------------------------
    let event;
    try {
      event = await WebhookEvent.create({
        eventId,
        eventType,
        payload: data || req.body,
        status: 'PENDING',
      });
    } catch (dbError) {
      // If MongoDB insertion fails for any reason (e.g., historical record or DB error),
      // release the Redis lock so future retries are not deadlocked.
      if (dbError.code === 11000) {
        return res.status(200).json({
          status: 'IGNORED_DUPLICATE',
          message: 'Event already exists in persistent database',
          eventId,
        });
      }
      await redisConnection.del(cacheKey);
      throw dbError;
    }

    // -----------------------------------------------------------
    // 3. ENQUEUE JOB (BullMQ)
    // -----------------------------------------------------------
    await webhookQueue.add('process-event', {
      dbId: event._id,
      eventId: event.eventId,
      eventType: event.eventType,
    });

    // -----------------------------------------------------------
    // 4. FAST HTTP ACKNOWLEDGMENT
    // -----------------------------------------------------------
    return res.status(201).json({
      status: 'ACCEPTED',
      message: 'Event accepted and queued for background processing',
      eventId: event.eventId,
    });
  } catch (error) {
    console.error('[Webhook Ingestion Error]', error);
    return res.status(500).json({ error: 'Internal server error while ingesting event' });
  }
};

//Retrying the event , taking the count of retry done my admin
// Add this inside src/controllers/webhookController.js

const retryWebhookEvent = async (req, res) => {
  const { eventId } = req.params;

  try {
    // 1. Locate the event in MongoDB
    const event = await WebhookEvent.findOne({ eventId });

    if (!event) {
      return res.status(404).json({
        error: 'Event not found',
        eventId,
      });
    }

    // 2. State Guard: Only retry FAILED events
    if (event.status !== 'FAILED') {
      return res.status(400).json({
        error: `Cannot retry event in '${event.status}' state. Only 'FAILED' events can be re-driven.`,
        eventId,
        currentStatus: event.status,
      });
    }

    // 3. Reset the Redis Idempotency Lock
    const cacheKey = `idempotency:${eventId}`;
    const TTL_SECONDS = 60 * 60 * 24;
    // Refresh the key in Redis so it's locked to avoid concurrent race conditions during re-drive
    await redisConnection.set(cacheKey, 'RETRYING', 'EX', TTL_SECONDS);

    // 4. Update the MongoDB state back to PENDING
    event.status = 'PENDING';
    event.errorMessage = null;
    event.retryCount = (event.retryCount || 0) + 1;
    await event.save();

    // 5. Re-dispatch job to BullMQ
    await webhookQueue.add(
      'process-event',
      {
        dbId: event._id,
        eventId: event.eventId,
        eventType: event.eventType,
        isRetry: true,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
      }
    );

    console.log(`[Re-drive Engine] Event ${eventId} re-queued by admin (Retry attempt #${event.retryCount})`);

    return res.status(200).json({
      status: 'RETRY_DISPATCHED',
      message: `Event ${eventId} has been re-queued for processing`,
      retryCount: event.retryCount,
    });
  } catch (error) {
    console.error('[Re-drive Error]', error);
    return res.status(500).json({ error: 'Failed to re-drive webhook event' });
  }
};
module.exports = {
  handleWebhook,
  getEventStatus,
  getHealthCheck,
  retryWebhookEvent,
};