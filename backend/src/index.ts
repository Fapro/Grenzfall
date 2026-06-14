import 'dotenv/config';
import express from 'express';
import fixturesRouter from './routes/fixtures';
import playersRouter from './routes/players';
import friendsRouter from './routes/friends';
import authRouter from './routes/auth';
import workspacesRouter from './routes/workspaces';
import chatRouter from './routes/chat';
import { runSeed } from './seed';
import {
  authSessionMiddleware,
  tenantResolutionMiddleware,
} from './middleware/tenant';

const app = express();
const PORT = Number(process.env.PORT ?? 3001);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((o: string) => o.trim())
  .filter(Boolean);

function normalizeOrigin(value: string): string {
  return value.trim().toLowerCase().replace(/\/+$/, '');
}

const NORMALIZED_ALLOWED_ORIGINS = ALLOWED_ORIGINS.map(normalizeOrigin);

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const origin = String(req.headers.origin ?? '');
  const normalizedOrigin = normalizeOrigin(origin);
  const isNetlifyAppOrigin = /^https:\/\/[a-z0-9-]+\.netlify\.app$/i.test(normalizedOrigin);
  const allowed =
    !NORMALIZED_ALLOWED_ORIGINS.length ||
    NORMALIZED_ALLOWED_ORIGINS.includes('*') ||
    NORMALIZED_ALLOWED_ORIGINS.includes(normalizedOrigin) ||
    isNetlifyAppOrigin;

  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Tenant-Slug');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json());
app.use(authSessionMiddleware);
app.use(tenantResolutionMiddleware);

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/fixtures', fixturesRouter);
app.use('/api/players', playersRouter);
app.use('/api/friends', friendsRouter);
app.use('/api/auth', authRouter);
app.use('/api/workspaces', workspacesRouter);
app.use('/api/chat', chatRouter);

// ── Start ─────────────────────────────────────────────────────────────────────
runSeed().then(() => {
  app.listen(PORT, () => {
    console.log(`[roar-backend] listening on port ${PORT}`);
  });
}).catch((err) => {
  console.error('[seed] Failed to run seed, starting anyway:', err);
  app.listen(PORT, () => {
    console.log(`[roar-backend] listening on port ${PORT}`);
  });
});

export default app;
 