import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { prisma } from './lib/prisma';
import { initHotWallet } from './services/tonWallet';
import { startWithdrawalProcessor } from './services/withdrawalProcessor';
import { startBot } from './bot';
import userRouter from './routes/user';
import spinRouter from './routes/spin';
import gameRouter from './routes/game';
import earnRouter from './routes/earn';
import withdrawRouter from './routes/withdraw';
import adminRouter from './routes/admin';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.NODE_ENV === 'production'
      ? [process.env.MINI_APP_URL || ''].filter(Boolean)
      : '*',
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/user',     userRouter);
app.use('/api/spin',     spinRouter);
app.use('/api/game',     gameRouter);
app.use('/api/earn',     earnRouter);
app.use('/api/withdraw', withdrawRouter);
app.use('/api/admin',    adminRouter);

// ─── 404 handler ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
async function main() {
  try {
    // Verify DB connection
    await prisma.$connect();
    console.log('[DB] Connected to SQLite');
  } catch (err) {
    console.error('[DB] Connection failed:', err);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
  });

  // Initialize TON hot wallet (non-blocking — wallet failure won't crash the server)
  initHotWallet().catch((err) => console.error('[TON] Init error:', err));

  // Start withdrawal processor background job
  startWithdrawalProcessor();

  // Start Telegram bot (non-blocking — bot failure won't crash the server)
  try {
    startBot();
  } catch (err) {
    console.error('[Bot] Failed to start:', err);
  }
}

main();
