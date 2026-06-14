import 'dotenv/config';
import express from 'express';
import fixturesRouter from './routes/fixtures';
import playersRouter from './routes/players';
import friendsRouter from './routes/friends';
import authRouter from './routes/auth';
import workspacesRouter from './routes/workspaces';
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

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const origin = req.headers.origin ?? '';
  const allowed =
    !ALLOWED_ORIGINS.length ||
    ALLOWED_ORIGINS.includes(origin);

  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
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

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[roar-backend] listening on port ${PORT}`);
});

export default app;
 