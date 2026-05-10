import 'dotenv/config';
import express from 'express';
import fixturesRouter from './routes/fixtures';
import playersRouter from './routes/players';

const app = express();
const PORT = Number(process.env.PORT ?? 3001);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((o: string) => o.trim())
  .filter(Boolean);

function isLocalDevOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(origin)
    || /^https?:\/\/[a-z0-9-]+\.exp\.direct$/i.test(origin);
}

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const origin = req.headers.origin ?? '';
  const allowed =
    !ALLOWED_ORIGINS.length ||
    ALLOWED_ORIGINS.includes(origin) ||
    isLocalDevOrigin(origin);

  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/fixtures', fixturesRouter);
app.use('/api/players', playersRouter);

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[roar-backend] listening on http://localhost:${PORT}`);
});

export default app;
