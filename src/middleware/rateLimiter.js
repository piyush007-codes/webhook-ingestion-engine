const rateLimit = require('express-rate-limit');

const webhookRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 100, // Limit each IP to 100 requests per `window`
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    status: 'TOO_MANY_REQUESTS',
    message: 'Too many requests from this IP, please try again after a minute.'
  }
});

module.exports = { webhookRateLimiter };