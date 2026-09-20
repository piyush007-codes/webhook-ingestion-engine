// server.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Import worker to start listening for queue events
require('./src/workers/webhookWorker');
console.log('DEBUG WEBHOOK_SECRET:', process.env.WEBHOOK_SECRET);
console.log('Loaded env keys:', Object.keys(process.env).filter(k => k.includes('MONGO') || k.includes('PORT')));

const app = require('./src/app');
const connectDB = require('./src/config/db');

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`[Server] Webhook Engine listening on port ${PORT}`);
  });
});