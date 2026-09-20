// src/routes/webhookRoutes.js
const express = require('express');
const router = express.Router();
const verifyWebhookSignature = require('../middleware/verifyWebhookSignature');
const {
  handleWebhook,
  getEventStatus,
  getHealthCheck,
  retryWebhookEvent,
} = require('../controllers/webhookController');

// System telemetry
router.get('/health', getHealthCheck);

// Event lifecycle inspection
router.get('/status/:eventId', getEventStatus);

// Manual re-drive for failed events (Admin endpoint)
router.post('/retry/:eventId', retryWebhookEvent);

// Main ingestion endpoint (Protected by HMAC)
router.post('/receive', verifyWebhookSignature, handleWebhook);

module.exports = router;