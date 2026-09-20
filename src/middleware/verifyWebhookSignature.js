
const crypto = require('crypto');

/**
 * Validates incoming webhook HMAC-SHA256 signature.
 * Prevents unauthorized callers and payload tampering.
 */
function verifyWebhookSignature(req, res, next) {
  const signatureHeader = req.headers['x-webhook-signature'];
  const secret = process.env.WEBHOOK_SECRET;

  if (!secret) {
    console.error('[Security Error] WEBHOOK_SECRET is not set in environment variables');
    return res.status(500).json({ error: 'Server security misconfiguration' });
  }

  // 1. Check if the signature header exists
  if (!signatureHeader) {
    return res.status(401).json({ error: 'Missing x-webhook-signature header' });
  }

  // 2. Check if rawBody was successfully captured by Express
  if (!req.rawBody) {
    return res.status(400).json({ error: 'Missing raw request body buffer for signature check' });
  }

  try {
    // 3. Compute the expected HMAC-SHA256 digest from the untouched raw bytes
    const computedSignature = crypto
      .createHmac('sha256', secret)
      .update(req.rawBody)
      .digest('hex');
    

    // 4. Convert both signatures to Buffers for timing-safe comparison
    const incomingBuffer = Buffer.from(signatureHeader, 'utf8');
    const computedBuffer = Buffer.from(computedSignature, 'utf8');

    // 5. Length check + constant-time comparison to prevent timing attacks
    if (
      incomingBuffer.length !== computedBuffer.length ||
      !crypto.timingSafeEqual(incomingBuffer, computedBuffer)
    ) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    // Signature matches! Proceed to route handler
    next();
  } catch (error) {
    return res.status(500).json({ error: 'Signature verification failed', details: error.message });
  }
}

module.exports = verifyWebhookSignature;