import { Router, Request, Response } from 'express';
import { requireAuth, requireTenant } from '../middleware/tenant';
import {
  addTenant,
  addTenantMember,
  addWorkspaceInvite,
  consumeWorkspaceInvite,
  findTenantById,
  findTenantBySlug,
  findTenantMember,
  findWorkspaceInviteByToken,
  findUserByEmail,
  findUserById,
  getDb,
  listMembersByUserId,
  listMembersByTenantId,
  listWorkspaceInvitesByTenantId,
} from '../multitenant/store';
import { normalizeEmail, randomId, randomToken, validateWorkspaceSlug } from '../multitenant/auth';

const router = Router();

function getCurrentMembership(req: Request) {
  if (!req.currentUser || !req.currentTenant) {
    return null;
  }
  return findTenantMember(req.currentTenant.id, req.currentUser.id) ?? null;
}

function canManageInvites(role: 'owner' | 'admin' | 'member'): boolean {
  return role === 'owner' || role === 'admin';
}

router.get('/availability/:slug', (req: Request, res: Response) => {
  const result = validateWorkspaceSlug(String(req.params.slug ?? ''));
  if (!result.ok) {
    res.status(400).json({ available: false, error: result.error });
    return;
  }

  const existing = findTenantBySlug(result.slug);
  res.json({ available: !existing, slug: result.slug });
});

router.get('/mine', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.currentUser!.id;
  const memberships = listMembersByUserId(userId).map((member) => ({
    ...member,
    tenant: db.tenants.find((t) => t.id === member.tenantId) ?? null,
  }));

  res.json({ memberships });
});

router.post('/', requireAuth, (req: Request, res: Response) => {
  const name = String(req.body?.name ?? '').trim();
  const requestedSlug = String(req.body?.slug ?? name);

  if (!name) {
    res.status(400).json({ error: 'Workspace name is required' });
    return;
  }

  const result = validateWorkspaceSlug(requestedSlug);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }

  if (findTenantBySlug(result.slug)) {
    res.status(409).json({ error: 'Workspace slug is already taken' });
    return;
  }

  const now = new Date().toISOString();
  const tenant = addTenant({
    id: randomId('ten'),
    slug: result.slug,
    name,
    ownerUserId: req.currentUser!.id,
    createdAt: now,
  });

  const member = addTenantMember({
    id: randomId('mem'),
    tenantId: tenant.id,
    userId: req.currentUser!.id,
    role: 'owner',
    createdAt: now,
  });

  res.status(201).json({ tenant, membership: member });
});

router.get('/current', (req: Request, res: Response) => {
  const tenant = req.currentTenant ?? null;
  const members: any[] = [];

  if (tenant) {
    const tenantMembers = listMembersByTenantId(tenant.id);
    members.push(
      ...tenantMembers.map((member) => ({
        ...member,
        user: findUserById(member.userId),
      }))
    );
  }

  res.json({ tenant, members });
});

router.get('/current/invites', requireAuth, requireTenant, (req: Request, res: Response) => {
  const membership = getCurrentMembership(req);
  if (!membership || !canManageInvites(membership.role)) {
    res.status(403).json({ error: 'Only owner/admin can view invites' });
    return;
  }

  const invites = listWorkspaceInvitesByTenantId(req.currentTenant!.id).filter(
    (invite) => !invite.consumedAt
  );
  res.json(invites);
});

router.post('/current/invites', requireAuth, requireTenant, (req: Request, res: Response) => {
  const membership = getCurrentMembership(req);
  if (!membership || !canManageInvites(membership.role)) {
    res.status(403).json({ error: 'Only owner/admin can create invites' });
    return;
  }

  const emailRaw = String(req.body?.email ?? '').trim();
  const roleRaw = String(req.body?.role ?? 'member').trim().toLowerCase();
  const role = roleRaw === 'admin' ? 'admin' : 'member';

  if (emailRaw) {
    const normalized = normalizeEmail(emailRaw);
    const existingUser = findUserByEmail(normalized);
    if (existingUser && findTenantMember(req.currentTenant!.id, existingUser.id)) {
      res.status(409).json({ error: 'User is already a member of this workspace' });
      return;
    }
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14).toISOString();
  const token = randomToken();

  const invite = addWorkspaceInvite({
    id: randomId('inv'),
    token,
    tenantId: req.currentTenant!.id,
    invitedByUserId: req.currentUser!.id,
    email: emailRaw ? normalizeEmail(emailRaw) : undefined,
    role,
    createdAt: now.toISOString(),
    expiresAt,
  });

  const appBaseUrl = (process.env.APP_BASE_URL ?? '').trim();
  const inviteUrl = appBaseUrl
    ? `${appBaseUrl.replace(/\/$/, '')}/join?token=${encodeURIComponent(token)}`
    : null;

  res.status(201).json({ invite, inviteUrl });
});

router.post('/invites/accept', requireAuth, (req: Request, res: Response) => {
  const token = String(req.body?.token ?? '').trim();
  if (!token) {
    res.status(400).json({ error: 'Invite token is required' });
    return;
  }

  const invite = findWorkspaceInviteByToken(token);
  if (!invite) {
    res.status(404).json({ error: 'Invite not found' });
    return;
  }

  if (invite.consumedAt) {
    res.status(409).json({ error: 'Invite has already been used' });
    return;
  }

  if (new Date(invite.expiresAt).getTime() < Date.now()) {
    res.status(410).json({ error: 'Invite has expired' });
    return;
  }

  const user = req.currentUser!;
  if (invite.email && invite.email !== normalizeEmail(user.email)) {
    res.status(403).json({ error: 'Invite was created for a different email address' });
    return;
  }

  const tenant = findTenantById(invite.tenantId);
  if (!tenant) {
    res.status(404).json({ error: 'Workspace not found for invite' });
    return;
  }

  const existingMembership = findTenantMember(invite.tenantId, user.id);
  if (existingMembership) {
    consumeWorkspaceInvite(token);
    res.json({
      tenant,
      membership: existingMembership,
      alreadyMember: true,
    });
    return;
  }

  const membershipRow = addTenantMember({
    id: randomId('mem'),
    tenantId: invite.tenantId,
    userId: user.id,
    role: invite.role,
    createdAt: new Date().toISOString(),
  });

  consumeWorkspaceInvite(token);
  res.status(201).json({ tenant, membership: membershipRow });
});

export default router;
