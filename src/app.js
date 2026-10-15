// src/app.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import webhookRoutes from './routes/webhookRoutes.js';

const app = express();

// 1. Enable CORS for frontend clients
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-event-id', 'x-event-type', 'x-webhook-signature'],
  })
);

// 2. Enforce payload cap (1mb) and capture untouched raw buffer for HMAC
app.use(
  express.json({
    limit: '1mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

// 3. Mount Webhook & Dashboard API routes
// Note: Rate limiting will be handled per-route inside webhookRoutes.js
app.use('/api/v1/webhooks', webhookRoutes);

// Health check endpoint for monitoring/deployment
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', uptime: process.uptime() });
});

export default app;