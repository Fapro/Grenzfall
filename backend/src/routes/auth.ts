import { Router, Request, Response } from 'express';
import {
  addTenant,
  addTenantMember,
  addUser,
  createSession,
  findTenantBySlug,
  findUserByEmail,
  findUserByUsername,
  getDb,
  listMembersByUserId,
} from '../multitenant/store';
import {
  hashPassword,
  isValidEmail,
  normalizeEmail,
  randomPassword,
  randomId,
  randomToken,
  slugify,
  validateWorkspaceSlug,
  verifyPassword,
} from '../multitenant/auth';
import { requireAuth } from '../middleware/tenant';

const router = Router();

function sanitizeUser(user: { id: string; username: string; email: string; name: string }) {
  return { id: user.id, username: user.username, email: user.email, name: user.name };
}

async function handleSignup(req: Request, res: Response) {
  const emailRaw = String(req.body?.email ?? '');
  const nameRaw = String(req.body?.name ?? '');
  const workspaceNameRaw = String(req.body?.workspaceName ?? '').trim();

  const email = normalizeEmail(emailRaw);
  const name = nameRaw.trim();
  if (!name || name.length < 2) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }
  if (!workspaceNameRaw) {
    res.status(400).json({ error: 'Workspace name is required' });
    return;
  }

  if (email && !isValidEmail(email)) {
    res.status(400).json({ error: 'Email has invalid format' });
    return;
  }

  if (email && findUserByEmail(email)) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  const slugResult = validateWorkspaceSlug(workspaceNameRaw);
  if (!slugResult.ok) {
    res.status(400).json({ error: slugResult.error });
    return;
  }
  if (findTenantBySlug(slugResult.slug)) {
    res.status(409).json({ error: 'Workspace slug is already taken' });
    return;
  }

  const generatedUsername = `wm2026%${slugResult.slug}`;
  if (findUserByUsername(generatedUsername)) {
    res.status(409).json({ error: 'Generated username already exists' });
    return;
  }

  const generatedPassword = randomPassword(10);
  const userEmail = email || `${slugResult.slug}@wm2026.local`;

  let createdTenant = {
    id: randomId('ten'),
    slug: slugResult.slug,
    name: workspaceNameRaw,
    ownerUserId: '',
    createdAt: new Date().toISOString(),
  };
  let tenantMembership = null;

  const user = addUser({
    id: randomId('usr'),
    username: generatedUsername,
    email: userEmail,
    name,
    passwordHash: await hashPassword(generatedPassword),
    createdAt: new Date().toISOString(),
  });

  createdTenant.ownerUserId = user.id;
  addTenant(createdTenant);
  tenantMembership = addTenantMember({
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
      username: generatedUsername,
      password: generatedPassword,
    },
  });
}

router.post('/signup', handleSignup);
router.post('/register', handleSignup);

router.post('/login', async (req: Request, res: Response) => {
  const username = String(req.body?.username ?? '').trim().toLowerCase();
  const email = normalizeEmail(String(req.body?.email ?? ''));
  const password = String(req.body?.password ?? '');

  const user = username ? findUserByUsername(username) : findUserByEmail(email);
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
