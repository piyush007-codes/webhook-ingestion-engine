const crypto = require('crypto');

const TEST_SECRET = process.env.WEBHOOK_SECRET || 'test_secret_key_123';

/**
 * Computes an HMAC SHA-256 hex signature matching engine requirements.
 * @param {string|Buffer} rawPayload 
 * @param {string} secret 
 * @returns {string} sha256=<hex>
 */
function generateSignature(rawPayload, secret = TEST_SECRET) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(rawPayload);
  return `sha256=${hmac.digest('hex')}`;
}

module.exports = {
  generateSignature,
  TEST_SECRET
};