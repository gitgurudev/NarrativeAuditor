import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import authRoutes     from './routes/auth.js';
import evaluateRoutes from './routes/evaluate.js';
import judgeRoutes    from './routes/judge.js';
import { resolveSrvUri } from './utils/dns.js';

async function startServer() {
  const app  = express();
  const PORT = process.env.PORT || 5001;

  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    process.env.FRONTEND_URL,
  ].filter(Boolean);

  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(express.json({ limit: '4mb' }));  // chunks can be large

  app.use('/api/auth',     authRoutes);
  app.use('/api/evaluate', evaluateRoutes);
  app.use('/api',          judgeRoutes);    // judge-criterion, synthesize, analyze-*
  app.get('/api/health',   (_, res) => res.json({ status: 'ok', service: 'NarrativeAuditor', model: 'google/gemini-2.0-flash-exp:free' }));

  try {
    let uri = process.env.MONGODB_URI;
    if (uri?.startsWith('mongodb+srv://')) {
      uri = await resolveSrvUri(uri);
    }
    await mongoose.connect(uri, { family: 4 });
    console.log('✅ MongoDB connected');
    app.listen(PORT, () => console.log(`🚀 NarrativeAuditor backend → http://localhost:${PORT}`));
  } catch (err) {
    console.error('❌ Startup failed:', err.message);
    process.exit(1);
  }
}

startServer();
