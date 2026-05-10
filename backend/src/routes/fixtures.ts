import { Router, Request, Response } from 'express';
import { APP_TO_SPORTMONKS_TEAM_ID } from '../teamIds';
import { normaliseFixture, SportMonksFixture, AppFixture } from '../types';
import * as cache from '../cache';

const router = Router();
const BASE = 'https://api.sportmonks.com/v3/football';
const INCLUDES =
  'fixtures;fixtures.participants;fixtures.venue;fixtures.venue.country;fixtures.round;fixtures.stage';

async function fetchFromSportMonks(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`SportMonks ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

/**
 * GET /api/fixtures/:appTeamId
 * Returns all fixtures for the WC 2026 season for the given app team ID.
 */
router.get('/:appTeamId', async (req: Request, res: Response) => {
  const appTeamId = String(req.params.appTeamId);
  const seasonId = process.env.SPORTMONKS_SEASON_ID;
  const cacheKey = `fixtures:${appTeamId}:${seasonId ?? 'all'}`;

  const cached = cache.get<AppFixture[]>(cacheKey);
  if (cached) {
    return res.json({ data: cached, source: 'cache' });
  }

  const sportMonksId = APP_TO_SPORTMONKS_TEAM_ID[appTeamId];
  if (!sportMonksId) {
    return res.status(404).json({ error: `Unknown team id: ${appTeamId}` });
  }

  const apiKey = process.env.SPORTMONKS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const url =
    `${BASE}/teams/${sportMonksId}` +
    `?api_token=${apiKey}` +
    `&include=${encodeURIComponent(INCLUDES)}`;

  try {
    const body = (await fetchFromSportMonks(url)) as {
      data?: { fixtures?: SportMonksFixture[] };
    };

    const seasonIdNum = seasonId ? Number(seasonId) : null;
    const rawFixtures = body.data?.fixtures ?? [];
    const filtered =
      seasonIdNum && !Number.isNaN(seasonIdNum)
        ? rawFixtures.filter((raw) => raw.season_id === seasonIdNum)
        : rawFixtures;

    const fixtures = filtered.map((raw) => normaliseFixture(raw, appTeamId));
    cache.set(cacheKey, fixtures);
    return res.json({ data: fixtures, source: 'api' });
  } catch (err) {
    console.error('[fixtures]', err);
    return res.status(502).json({ error: 'Failed to fetch from SportMonks' });
  }
});

export default router;
