import { Router, Request, Response } from 'express';
import {
  addTenant,
  addTenantMember,
  addUser,
  createSession,
  findTenantBySlug,
  findUserByEmail,
  findUserByUsername,
  findTenantMember,
  listMembersByUserId,
  updateTenantSharedCredentials,
  updateDb,
  getDb,
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
    sharedLoginUsername: generatedUsername,
    sharedLoginPassword: generatedPassword,
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

  // Backward-compatible login: older clients may send the username in the email field.
  const user = username
    ? findUserByUsername(username)
    : (findUserByEmail(email) ?? findUserByUsername(email));
  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  let isValidViaSharedFallback = false;

  if (!isValid) {
    const db = getDb();
    const matchingTenant = db.tenants.find(
      (tenant) =>
        String(tenant.sharedLoginUsername ?? '').trim().toLowerCase() ===
        String(user.username ?? '').trim().toLowerCase()
    );

    if (matchingTenant?.sharedLoginPassword === password) {
      isValidViaSharedFallback = true;
      const repairedHash = await hashPassword(password);
      updateDb((state) => {
        const mutableUser = state.users.find((entry) => entry.id === user.id);
        if (mutableUser) {
          mutableUser.passwordHash = repairedHash;
        }
      });
    }
  }

  if (!isValid && !isValidViaSharedFallback) {
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

router.post('/reset-group-password', requireAuth, async (req: Request, res: Response) => {
  const user = req.currentUser!;
  const db = getDb();

  // Find the tenant where this user is owner
  const ownedTenant = db.tenants.find((t) => t.ownerUserId === user.id);
  if (!ownedTenant) {
    res.status(403).json({ error: 'Only the group owner can reset the shared password' });
    return;
  }

  const membership = findTenantMember(ownedTenant.id, user.id);
  if (membership?.role !== 'owner') {
    res.status(403).json({ error: 'Only the group owner can reset the shared password' });
    return;
  }

  const newPassword = randomPassword(10);
  const username = ownedTenant.sharedLoginUsername || `wm2026%${ownedTenant.slug}`;

  // Update the shared user's password hash
  const sharedUser = findUserByUsername(username);
  if (sharedUser) {
    const newHash = await hashPassword(newPassword);
    db.users.forEach((u) => {
      if (u.id === sharedUser.id) {
        u.passwordHash = newHash;
      }
    });
    // persist via updateTenantSharedCredentials which calls persist()
  }

  const updatedTenant = updateTenantSharedCredentials(ownedTenant.id, username, newPassword);
  if (!updatedTenant) {
    res.status(500).json({ error: 'Failed to update shared credentials' });
    return;
  }

  res.json({
    ok: true,
    generatedCredentials: { username, password: newPassword },
  });
});

router.post('/recovery/reset-shared-password', async (req: Request, res: Response) => {
  const configuredRecoveryToken = String(process.env.RECOVERY_RESET_TOKEN ?? '').trim();
  if (!configuredRecoveryToken) {
    res.status(503).json({ error: 'Recovery reset is not configured' });
    return;
  }

  const providedRecoveryToken = String(req.body?.recoveryToken ?? '').trim();
  if (!providedRecoveryToken || providedRecoveryToken !== configuredRecoveryToken) {
    res.status(401).json({ error: 'Invalid recovery token' });
    return;
  }

  const requestedSlug = slugify(String(req.body?.workspaceSlug ?? ''));
  const requestedGroupName = String(req.body?.groupName ?? '').trim().toLowerCase();
  const requestedUsername = String(req.body?.username ?? '').trim().toLowerCase();
  if (!requestedSlug && !requestedGroupName && !requestedUsername) {
    res.status(400).json({ error: 'workspaceSlug, groupName, or username is required' });
    return;
  }

  const db = getDb();
  const bySlug = requestedSlug ? findTenantBySlug(requestedSlug) : undefined;
  const byGroupName = requestedGroupName
    ? db.tenants.find(
      (tenant) => String(tenant.sharedLoginUsername ?? '').trim().toLowerCase() === requestedGroupName
    )
    : undefined;
  const bySharedUsername = requestedUsername
    ? db.tenants.find(
      (tenant) => String(tenant.sharedLoginUsername ?? '').trim().toLowerCase() === requestedUsername
    )
    : undefined;

  const byUserMembership = requestedUsername
    ? (() => {
        const user = findUserByUsername(requestedUsername);
        if (!user) {
          return undefined;
        }

        const membership = listMembersByUserId(user.id)[0];
        if (!membership) {
          return undefined;
        }

        return db.tenants.find((tenant) => tenant.id === membership.tenantId);
      })()
    : undefined;

  const targetTenant = bySlug ?? byGroupName ?? bySharedUsername ?? byUserMembership;

  if (!targetTenant) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }

  const canonicalUsername = String(targetTenant.sharedLoginUsername || `wm2026%${targetTenant.slug}`)
    .trim()
    .toLowerCase();
  const requestedIdentity = requestedGroupName || requestedUsername;
  if (requestedIdentity && requestedIdentity !== canonicalUsername) {
    res.status(400).json({ error: 'Username does not match workspace' });
    return;
  }

  const newPassword = randomPassword(10);
  const newHash = await hashPassword(newPassword);

  const sharedUser = findUserByUsername(canonicalUsername);
  if (sharedUser) {
    updateDb((state) => {
      const mutableUser = state.users.find((u) => u.id === sharedUser.id);
      if (mutableUser) {
        mutableUser.passwordHash = newHash;
      }
    });
  }

  const updatedTenant = updateTenantSharedCredentials(targetTenant.id, canonicalUsername, newPassword);
  if (!updatedTenant) {
    res.status(500).json({ error: 'Failed to update shared credentials' });
    return;
  }

  res.json({
    ok: true,
    workspaceSlug: targetTenant.slug,
    generatedCredentials: {
      username: canonicalUsername,
      password: newPassword,
    },
  });
});

export default router;
