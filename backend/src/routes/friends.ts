import express from 'express';

const router = express.Router();

// In-memory store for demo
const friendsByTeam: Record<string, { id: string; name: string; tips: Record<string, { home: string; away: string }> }[]> = {};

// Get friends for a team
router.get('/:teamId', (req, res) => {
  const { teamId } = req.params;
  res.json(friendsByTeam[teamId] || []);
});

// Add/update friends and tips for a team
router.post('/:teamId', (req, res) => {
  const { teamId } = req.params;
  const { friends } = req.body;
  if (!Array.isArray(friends)) return res.status(400).json({ error: 'Invalid friends' });
  friendsByTeam[teamId] = friends;
  res.json({ ok: true });
});

export default router;
