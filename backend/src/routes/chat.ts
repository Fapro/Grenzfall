import { Router, Request, Response } from 'express';
import { getDb, updateDb } from '../multitenant/store';
import { requireAuth } from '../middleware/tenant';
import { randomId } from '../multitenant/auth';
import type { ChatMessage } from '../multitenant/types';

const router = Router();

const MAX_MESSAGES_PER_TENANT = 200;
const MAX_MESSAGE_LENGTH = 500;

/**
 * GET /api/chat
 * Returns the last 50 messages for the current tenant.
 * Requires authentication + tenant context.
 */
router.get('/', requireAuth, (req: Request, res: Response) => {
  const tenantId = req.currentTenant?.id;
  if (!tenantId) {
    return res.status(400).json({ error: 'No workspace context' });
  }

  const db = getDb();
  const messages = (db.chatByTenant[tenantId] ?? []).slice(-50);
  return res.json({ data: messages });
});

/**
 * POST /api/chat
 * Posts a new message to the current tenant chat.
 * Body: { text: string }
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  const tenantId = req.currentTenant?.id;
  const user = req.currentUser!;

  if (!tenantId) {
    return res.status(400).json({ error: 'No workspace context' });
  }

  const text = String(req.body?.text ?? '').trim();
  if (!text) {
    return res.status(400).json({ error: 'Message text is required' });
  }
  if (text.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: `Message must be at most ${MAX_MESSAGE_LENGTH} characters` });
  }

  const message: ChatMessage = {
    id: randomId('msg'),
    tenantId,
    userId: user.id,
    userName: user.name || user.username || 'Unknown',
    text,
    createdAt: new Date().toISOString(),
  };

  updateDb((state) => {
    if (!state.chatByTenant[tenantId]) {
      state.chatByTenant[tenantId] = [];
    }
    state.chatByTenant[tenantId].push(message);

    // Keep only the last MAX_MESSAGES_PER_TENANT messages
    if (state.chatByTenant[tenantId].length > MAX_MESSAGES_PER_TENANT) {
      state.chatByTenant[tenantId] = state.chatByTenant[tenantId].slice(-MAX_MESSAGES_PER_TENANT);
    }
  });

  return res.status(201).json({ data: message });
});

export default router;
