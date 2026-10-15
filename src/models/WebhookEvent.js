// src/models/WebhookEvent.js
import mongoose from 'mongoose';

const webhookEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true },
    eventType: { type: String, required: true },
    payload: { type: Object, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
      default: 'PENDING',
    },
    attempts: { type: Number, default: 0 },
    result: { type: Object, default: null },
    errorMessage: { type: String, default: null },
    processedAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const WebhookEvent =
  mongoose.models.WebhookEvent || mongoose.model('WebhookEvent', webhookEventSchema);

export { WebhookEvent };
export default WebhookEvent;