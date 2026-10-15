// src/tests/webhook.test.js
import 'dotenv/config';
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import { redisConnection } from '../config/redis.js';

describe('Webhook Engine Ingestion & Idempotency', () => {
  before(async () => {
    // Ensure MongoDB connection is ready
    if (mongoose.connection.readyState === 0 && process.env.MONGODB_URI) {
      await mongoose.connect(process.env.MONGODB_URI);
    }
  });

  after(async () => {
    // Close connections so the test runner exits cleanly
    await mongoose.connection.close();
    await redisConnection.quit();
  });

  test('POST /api/v1/webhooks returns 202 and queues the event', async () => {
    const testPayload = {
      eventId: `test_${Date.now()}`,
      eventType: 'payment.succeeded',
      amount: 2500
    };

    const res = await request(app)
      .post('/api/v1/webhooks')
      .send(testPayload)
      .set('Content-Type', 'application/json');

    assert.equal(res.status, 202);
    assert.equal(res.body.success, true);
    assert.equal(res.body.eventId, testPayload.eventId);
  });

  test('POST /api/v1/webhooks with duplicate eventId returns DUPLICATE status', async () => {
    const duplicatePayload = {
      eventId: `dup_test_${Date.now()}`,
      eventType: 'payment.succeeded',
      amount: 1500
    };

    // First request - should be accepted
    const firstRes = await request(app)
      .post('/api/v1/webhooks')
      .send(duplicatePayload);
    assert.equal(firstRes.status, 202);

    // Second request with exact same eventId - should be caught by Redis idempotency
    const secondRes = await request(app)
      .post('/api/v1/webhooks')
      .send(duplicatePayload);
    assert.equal(secondRes.status, 200);
    assert.equal(secondRes.body.status, 'DUPLICATE');
  });

  test('POST /api/v1/webhooks returns 400 when missing required fields', async () => {
    const invalidPayload = {
      amount: 500
    };

    const res = await request(app)
      .post('/api/v1/webhooks')
      .send(invalidPayload);

    assert.equal(res.status, 400);
  });
});