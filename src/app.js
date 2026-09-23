// src/app.js
require('dotenv').config(); 
const express = require('express');
const webhookRoutes = require('./routes/webhookRoutes');
const { webhookRateLimiter } = require('./middleware/rateLimiter');

const app = express();

// 1. Enforce payload cap (1mb) and capture untouched raw buffer for HMAC
app.use(
  express.json({
    limit: '1mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    }
  })
);

// 2. Apply rate limiter to webhook endpoints
app.use('/api/v1/webhooks', webhookRateLimiter, webhookRoutes);

module.exports = app;