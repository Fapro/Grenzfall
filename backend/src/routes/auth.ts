import { Router, Request, Response } from 'express';
import {
  addTenant,
  addTenantMember,
  addUser,
  createSession,
  findTenantBySlug,
  findUserByEmail,
  getDb,
  listMembersByUserId,
} from '../multitenant/store';
import {
  hashPassword,
  normalizeEmail,
  randomId,
  randomToken,
  slugify,
  validateWorkspaceSlug,
  verifyPassword,
} from '../multitenant/auth';
import { requireAuth } from '../middleware/tenant';

const router = Router();

const SHARED_LOGIN_PREFIX = 'win2026%';

function sanitizeUser(user: { id: string; email: string; name: string; username?: string }) {
  return { id: user.id, email: user.email, name: user.name, username: user.username };
}

function buildSharedLoginUsername(slug: string): string {
  return `${SHARED_LOGIN_PREFIX}${slug}`;
}

function buildSharedLoginEmail(slug: string): string {
  return `${slug}@win2026.local`;
}

function generateSharedPassword(length = 10): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = randomToken();
  let password = '';
  for (let i = 0; i < length; i += 1) {
    const pair = bytes.slice(i * 2, i * 2 + 2);
    const value = Number.parseInt(pair || '00', 16);
    password += alphabet[value % alphabet.length];
  }
  return password;
}

function resolveLoginEmailCandidates(rawIdentifier: string): string[] {
  const normalized = normalizeEmail(rawIdentifier);
  if (!normalized) {
    return [];
  }

  if (normalized.includes('@')) {
    return [normalized];
  }

  // Support both current and legacy shared-login usernames.
  const sharedMatch = /^(win2026|wm2026)%([a-z0-9-]+)$/.exec(normalized);
  if (sharedMatch?.[2]) {
    const slug = sharedMatch[2];
    return [`${slug}@win2026.local`, `${slug}@wm2026.local`];
  }

  return [normalized];
}

router.post('/signup', async (req: Request, res: Response) => {
  const nameRaw = String(req.body?.name ?? '');
  const workspaceNameRaw = String(req.body?.workspaceName ?? '').trim();
  const workspaceSlugInput = String(req.body?.workspaceSlug ?? workspaceNameRaw);

  const name = nameRaw.trim();
  if (!name || name.length < 2) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }

  if (!workspaceNameRaw) {
    res.status(400).json({ error: 'Workspace name is required' });
    return;
  }

  const slugResult = validateWorkspaceSlug(workspaceSlugInput);
  if (!slugResult.ok) {
    res.status(400).json({ error: slugResult.error });
    return;
  }
  if (findTenantBySlug(slugResult.slug)) {
    res.status(409).json({ error: 'Workspace slug is already taken' });
    return;
  }

  const sharedLoginUsername = buildSharedLoginUsername(slugResult.slug);
  const generatedPassword = generateSharedPassword();
  const sharedLoginEmail = buildSharedLoginEmail(slugResult.slug);

  if (findUserByEmail(sharedLoginEmail)) {
    res.status(409).json({ error: 'A shared login for this workspace already exists' });
    return;
  }

  const user = addUser({
    id: randomId('usr'),
    username: sharedLoginUsername,
    email: sharedLoginEmail,
    name,
    passwordHash: await hashPassword(generatedPassword),
    createdAt: new Date().toISOString(),
  });

  const createdTenant = addTenant({
    id: randomId('ten'),
    slug: slugResult.slug,
    name: workspaceNameRaw,
    ownerUserId: user.id,
    sharedLoginUsername,
    sharedLoginPassword: generatedPassword,
    createdAt: new Date().toISOString(),
  });

  const tenantMembership = addTenantMember({
    id: randomId('mem'),
    tenantId: createdTenant.id,
    userId: user.id,
    role: 'owner',
    createdAt: new Date().toISOString(),
  });

  const token = randomToken();
  createSession({
    token,
    userId: user.id,
    createdAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
  });

  res.status(201).json({
    token,
    user: sanitizeUser(user),
    tenant: createdTenant,
    membership: tenantMembership,
    generatedCredentials: {
      username: sharedLoginUsername,
      password: generatedPassword,
    },
  });
});

router.post('/login', async (req: Request, res: Response) => {
  const emailCandidates = resolveLoginEmailCandidates(String(req.body?.email ?? req.body?.username ?? ''));
  const password = String(req.body?.password ?? '');

  const user = emailCandidates
    .map((candidate) => findUserByEmail(candidate))
    .find((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));

  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = randomToken();
  createSession({
    token,
    userId: user.id,
    createdAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
  });

  const db = getDb();
  const memberRows = listMembersByUserId(user.id);
  const tenants = memberRows
    .map((m) => db.tenants.find((t) => t.id === m.tenantId))
    .filter(Boolean);

  res.json({
    token,
    user: sanitizeUser(user),
    tenants,
  });
});

router.get('/me', requireAuth, (req: Request, res: Response) => {
  const user = req.currentUser!;
  const db = getDb();
  const memberships = listMembersByUserId(user.id).map((member) => ({
    ...member,
    tenant: db.tenants.find((t) => t.id === member.tenantId) ?? null,
  }));

  res.json({
    user: sanitizeUser(user),
    memberships,
  });
});

router.get('/slugify/:name', (req: Request, res: Response) => {
  const slug = slugify(String(req.params.name ?? ''));
  res.json({ slug });
});

export default router;
