import { Router, Request, Response } from 'express';
import { requireAuth, requireTenant } from '../middleware/tenant';
import {
  getTenantTeamFriends,
  setTenantTeamFriends,
  listMembersByTenantId,
  findUserById,
} from '../multitenant/store';
import { FriendEntry } from '../multitenant/types';
import { randomId } from '../multitenant/auth';

const router = Router();

function isValidFriendEntry(value: unknown): value is FriendEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as FriendEntry;
  if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string') {
    return false;
  }

  if (!candidate.tips || typeof candidate.tips !== 'object') {
    return false;
  }

  return Object.values(candidate.tips).every((tip) => {
    if (!tip || typeof tip !== 'object') {
      return false;
    }
    return typeof tip.home === 'string' && typeof tip.away === 'string';
  });
}

// Get all workspace members as friends with their tips
router.get('/:teamId', requireAuth, requireTenant, (req: Request, res: Response) => {
  const teamId = String(req.params.teamId ?? '').trim();
  const tenantId = req.currentTenant!.id;

  // Get all members of the workspace
  const members = listMembersByTenantId(tenantId);

  // Get stored tips for all members
  const allFriendsTips = getTenantTeamFriends(tenantId, teamId);

  // Build response with member names and their tips
  const memberFriends = members
    .map((member) => {
      const user = findUserById(member.userId);
      const memberTips = allFriendsTips.find((f) => f.id === member.userId);
      return {
        id: member.userId,
        name: user?.name || 'Unknown',
        email: user?.email,
        tips: memberTips?.tips || {},
      };
    });

  const memberIds = new Set(members.map((m) => m.userId));
  const manualFriends = allFriendsTips
    .filter((entry) => !memberIds.has(entry.id))
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      tips: entry.tips || {},
    }));

  const friends = [...memberFriends, ...manualFriends].sort((a, b) => a.name.localeCompare(b.name));

  res.json(friends);
});

// Save tips for current user in this team
router.post('/:teamId', requireAuth, requireTenant, (req: Request, res: Response) => {
  const teamId = String(req.params.teamId ?? '').trim();
  const tenantId = req.currentTenant!.id;
  const userId = req.currentUser!.id;
  const requestedFriendId = String(req.body?.friendId ?? '').trim();
  const friendId = requestedFriendId || userId;
  const tips = req.body?.tips;

  if (!tips || typeof tips !== 'object') {
    res.status(400).json({ error: 'Invalid tips payload' });
    return;
  }

  const members = listMembersByTenantId(tenantId);

  // Get current friends list
  let friends = getTenantTeamFriends(tenantId, teamId);
  const existingFriendEntry = friends.find((f) => f.id === friendId);
  const targetMember = members.find((member) => member.userId === friendId);

  if (!targetMember && !existingFriendEntry && friendId !== userId) {
    res.status(404).json({ error: 'Friend is not a member of this workspace' });
    return;
  }

  const targetUser = findUserById(friendId);

  // Find or create entry for selected member
  const existingIndex = friends.findIndex((f) => f.id === friendId);

  if (existingIndex >= 0) {
    // Update existing
    friends[existingIndex].tips = tips;
  } else {
    // Add new
    friends.push({
      id: friendId,
      name: targetUser?.name || existingFriendEntry?.name || req.currentUser?.name || 'Unknown',
      tips,
    });
  }

  setTenantTeamFriends(tenantId, teamId, friends);
  res.json({ ok: true });
});

router.post('/:teamId/manual', requireAuth, requireTenant, (req: Request, res: Response) => {
  const teamId = String(req.params.teamId ?? '').trim();
  const tenantId = req.currentTenant!.id;
  const name = String(req.body?.name ?? '').trim();

  if (!name) {
    res.status(400).json({ error: 'Friend name is required' });
    return;
  }

  if (name.length > 24) {
    res.status(400).json({ error: 'Friend name is too long (max 24 chars)' });
    return;
  }

  const friends = getTenantTeamFriends(tenantId, teamId);
  const alreadyExists = friends.some((entry) => entry.name.trim().toLowerCase() === name.toLowerCase());
  if (alreadyExists) {
    res.status(409).json({ error: 'Friend already exists' });
    return;
  }

  const nextEntry: FriendEntry = {
    id: randomId('manual'),
    name,
    tips: {},
  };

  setTenantTeamFriends(tenantId, teamId, [...friends, nextEntry]);
  res.status(201).json(nextEntry);
});

export default router;
