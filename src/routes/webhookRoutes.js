// src/routes/webhookRoutes.js
import express from 'express';
import {
  handleWebhook,
  getWebhookEvents,
  getWebhookEventById,
  retryWebhookEvent,
  getWebhookStats,
} from '../controllers/webhookController.js';
import { webhookRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// ==========================================
// 1. External Ingestion Endpoint (Rate-Limited)
// Path: POST /api/v1/webhooks
// ==========================================
router.post('/', webhookRateLimiter, handleWebhook);

// ==========================================
// 2. Dashboard Internal APIs (Not Rate-Limited)
// ==========================================
// GET /api/v1/webhooks/stats
router.get('/stats', getWebhookStats);

// GET /api/v1/webhooks/events?page=1&limit=10&status=FAILED
router.get('/events', getWebhookEvents);

// GET /api/v1/webhooks/events/:id
router.get('/events/:id', getWebhookEventById);

// POST /api/v1/webhooks/events/:id/retry
router.post('/events/:id/retry', retryWebhookEvent);

export default router;