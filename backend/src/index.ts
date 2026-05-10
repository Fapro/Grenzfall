import 'dotenv/config';
import express from 'express';
import fixturesRouter from './routes/fixtures';

const app = express();
const PORT = Number(process.env.PORT ?? 3001);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((o: string) => o.trim())
  .filter(Boolean);

function isLocalDevOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
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

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[roar-backend] listening on http://localhost:${PORT}`);
});

export default app;
