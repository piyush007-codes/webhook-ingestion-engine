// src/app.js
require('dotenv').config(); 
const express = require('express');
const webhookRoutes = require('./routes/webhookRoutes');

const app = express();

// Capture raw body buffer for HMAC-SHA256 signature verification
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Mount Webhook Router
app.use('/api/v1/webhooks', webhookRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

module.exports = app;