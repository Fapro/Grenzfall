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
  isValidEmail,
  normalizeEmail,
  randomId,
  randomToken,
  slugify,
  validateWorkspaceSlug,
  verifyPassword,
} from '../multitenant/auth';
import { requireAuth } from '../middleware/tenant';

const router = Router();

function sanitizeUser(user: { id: string; email: string; name: string }) {
  return { id: user.id, email: user.email, name: user.name };
}

router.post('/signup', async (req: Request, res: Response) => {
  const emailRaw = String(req.body?.email ?? '');
  const nameRaw = String(req.body?.name ?? '');
  const password = String(req.body?.password ?? '');
  const workspaceNameRaw = String(req.body?.workspaceName ?? '').trim();
  const workspaceSlugInput = String(req.body?.workspaceSlug ?? workspaceNameRaw);

  const email = normalizeEmail(emailRaw);
  const name = nameRaw.trim();
  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'Valid email is required' });
    return;
  }
  if (!name || name.length < 2) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }
  if (!password || password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }

  if (findUserByEmail(email)) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  let createdTenant = null;
  let tenantMembership = null;

  if (workspaceNameRaw) {
    const slugResult = validateWorkspaceSlug(workspaceSlugInput);
    if (!slugResult.ok) {
      res.status(400).json({ error: slugResult.error });
      return;
    }
    if (findTenantBySlug(slugResult.slug)) {
      res.status(409).json({ error: 'Workspace slug is already taken' });
      return;
    }

    createdTenant = {
      id: randomId('ten'),
      slug: slugResult.slug,
      name: workspaceNameRaw,
      ownerUserId: '',
      createdAt: new Date().toISOString(),
    };
  }

  const user = addUser({
    id: randomId('usr'),
    email,
    name,
    passwordHash: await hashPassword(password),
    createdAt: new Date().toISOString(),
  });

  if (createdTenant) {
    createdTenant.ownerUserId = user.id;
    addTenant(createdTenant);
    tenantMembership = addTenantMember({
      id: randomId('mem'),
      tenantId: createdTenant.id,
      userId: user.id,
      role: 'owner',
      createdAt: new Date().toISOString(),
    });
  }

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
  });
});

router.post('/login', async (req: Request, res: Response) => {
  const email = normalizeEmail(String(req.body?.email ?? ''));
  const password = String(req.body?.password ?? '');

  const user = findUserByEmail(email);
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
