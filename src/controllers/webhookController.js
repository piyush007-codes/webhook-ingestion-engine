import crypto from 'crypto';
import mongoose from 'mongoose';
import { WebhookEvent } from '../models/WebhookEvent.js';
import { webhookQueue } from '../queues/webhookQueue.js';
import { redisConnection } from '../config/redis.js';

export const handleWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-hub-signature-256'] || req.headers['x-webhook-signature'];
    const eventId = req.headers['x-event-id'] || req.body?.id || req.body?.eventId;
    const eventType = req.headers['x-event-type'] || req.body?.type || req.body?.eventType;

    if (!eventId || !eventType) {
      return res.status(400).json({ error: 'Missing event ID or event type' });
    }

    // Optional: HMAC verification check if secret is configured
    const secret = process.env.WEBHOOK_SECRET;
    if (secret && signature) {
      const hmac = crypto.createHmac('sha256', secret);
      const computed = 'sha256=' + hmac.update(req.rawBody || JSON.stringify(req.body)).digest('hex');
      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computed))) {
        return res.status(401).json({ error: 'Invalid HMAC signature' });
      }
    }

    // 1. Idempotency Check in Redis RAM (1-day TTL)
    const idempotencyKey = `idempotency:${eventId}`;
    const acquired = await redisConnection.set(idempotencyKey, 'LOCKED', 'EX', 86400, 'NX');

    if (!acquired) {
      return res.status(200).json({
        message: 'Duplicate event received and acknowledged.',
        status: 'DUPLICATE'
      });
    }

    // 2. Persist Event in MongoDB Atlas
    const eventRecord = await WebhookEvent.create({
      eventId,
      eventType,
      payload: req.body,
      status: 'PENDING'
    });

    // 3. Dispatch to BullMQ Queue
    await webhookQueue.add(
      'process-webhook',
      {
        dbId: eventRecord._id.toString(),
        eventId,
        eventType,
        payload: req.body
      },
      {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 1000
        },
        removeOnComplete: true
      }
    );

    return res.status(202).json({
      success: true,
      message: 'Webhook received and queued for processing',
      eventId
    });
  } catch (err) {
    console.error('[Controller Error]', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ==========================================
// DASHBOARD BRIDGES
// ==========================================

// 1. GET /api/events - Paginated event feed with status filtering
export const getWebhookEvents = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const { status, eventType } = req.query;

    const filter = {};

    if (status && status !== 'ALL') {
      const allowedStatuses = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'];
      if (allowedStatuses.includes(status.toUpperCase())) {
        filter.status = status.toUpperCase();
      }
    }

    if (eventType) {
      filter.eventType = eventType;
    }

    const skip = (page - 1) * limit;

    const [events, total] = await Promise.all([
      WebhookEvent.find(filter)
        .select('eventId eventType status attempts errorMessage processedAt failedAt createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      WebhookEvent.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        events,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
          hasNextPage: page * limit < total,
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (error) {
    console.error('[Dashboard Error - getWebhookEvents]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve webhook events',
      error: error.message,
    });
  }
};

// 2. GET /api/events/:id - Deep dive for drawer / modal inspection
export const getWebhookEventById = async (req, res) => {
  try {
    const { id } = req.params;

    // Supports querying either by MongoDB _id or your business eventId
    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { eventId: id };

    const event = await WebhookEvent.findOne(query).lean();

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    return res.status(200).json({
      success: true,
      data: event,
    });
  } catch (error) {
    console.error('[Dashboard Error - getWebhookEventById]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve event details',
      error: error.message,
    });
  }
};

// 3. POST /api/events/:id/retry - Manual redrive / replay button
export const retryWebhookEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { eventId: id };

    const event = await WebhookEvent.findOne(query);

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    // Reset status to PENDING for redrive
    event.status = 'PENDING';
    event.errorMessage = null;
    await event.save();

    // Re-queue to BullMQ
    await webhookQueue.add(
      'process-webhook',
      {
        dbId: event._id.toString(),
        eventId: event.eventId,
        eventType: event.eventType,
        payload: event.payload,
        isRetry: true,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: true,
      }
    );

    return res.status(200).json({
      success: true,
      message: `Event ${event.eventId} re-queued successfully`,
    });
  } catch (error) {
    console.error('[Dashboard Error - retryWebhookEvent]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to re-queue event',
      error: error.message,
    });
  }
};

// 4. GET /api/stats - High-level metrics for dashboard header cards
export const getWebhookStats = async (req, res) => {
  try {
    const [counts, total] = await Promise.all([
      WebhookEvent.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]),
      WebhookEvent.countDocuments(),
    ]);

    const stats = {
      total,
      PENDING: 0,
      PROCESSING: 0,
      COMPLETED: 0,
      FAILED: 0,
    };

    counts.forEach((item) => {
      if (stats[item._id] !== undefined) {
        stats[item._id] = item.count;
      }
    });

    const successRate = total > 0 ? ((stats.COMPLETED / total) * 100).toFixed(1) : 0;

    return res.status(200).json({
      success: true,
      data: {
        ...stats,
        successRate: `${successRate}%`,
      },
    });
  } catch (error) {
    console.error('[Dashboard Error - getWebhookStats]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve stats',
      error: error.message,
    });
  }
};

export default {
  handleWebhook,
  getWebhookEvents,
  getWebhookEventById,
  retryWebhookEvent,
  getWebhookStats,
};