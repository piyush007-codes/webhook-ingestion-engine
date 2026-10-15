// server.js
import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import app from './src/app.js';

// Recreate __dirname for ES modules if needed
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

async function startServer() {
  try {
    if (MONGODB_URI) {
      await mongoose.connect(MONGODB_URI);
      console.log('[Database] Connected to MongoDB Atlas');
    } else {
      console.warn('[Database] MONGODB_URI not found in .env, running without DB connection.');
    }

    app.listen(PORT, () => {
      console.log(`[Server] Webhook Engine running on port ${PORT}`);
    });
  } catch (error) {
    console.error('[Server Error] Failed to start server:', error);
    process.exit(1);
  }
}

startServer();