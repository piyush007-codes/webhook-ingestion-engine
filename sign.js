// sign.js
const crypto = require('crypto');
require('dotenv').config();

// Put whatever payload you want to test here (must match Thunder Client exactly)
const payload = JSON.stringify({
  eventId: "evt_fail_001",
  eventType: "payment.failed_test",
  data: { amount: 999 }
});

const signature = crypto
  .createHmac('sha256', process.env.WEBHOOK_SECRET)
  .update(payload)
  .digest('hex');

console.log('Payload:', payload);
console.log('Signature:', signature);