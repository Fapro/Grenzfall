import { Router, Request, Response } from 'express';
import { APP_TO_SPORTMONKS_TEAM_ID } from '../teamIds';
import { APP_TEAM_NAME } from '../teamNames';
import { normaliseFixture, SportMonksFixture, AppFixture } from '../types';
import * as cache from '../cache';

const router = Router();
const BASE = 'https://api.sportmonks.com/v3/football';
const INCLUDES =
  'fixtures;fixtures.participants;fixtures.venue;fixtures.venue.country;fixtures.round;fixtures.stage';
const RUNTIME_TEAM_ID_BY_APP_ID: Record<string, number> = {};

async function fetchFromSportMonks(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`SportMonks ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

async function resolveTeamIdByName(
  appTeamName: string,
  apiKey: string
): Promise<number | null> {
  const url =
    `${BASE}/teams/search/${encodeURIComponent(appTeamName)}` +
    `?api_token=${apiKey}`;

  const body = (await fetchFromSportMonks(url)) as {
    data?: Array<{ id: number; name: string; type?: string }>;
  };

  const teams = body.data ?? [];
  if (!teams.length) {
    return null;
  }

  const nationals = teams.filter((t) => t.type === 'national');
  const candidates = nationals.length ? nationals : teams;
  const target = normalizeName(appTeamName);

  const exact = candidates.find((t) => normalizeName(t.name) === target);
  if (exact) {
    return exact.id;
  }

  const close = candidates.find((t) => {
    const candidate = normalizeName(t.name);
    return candidate.includes(target) || target.includes(candidate);
  });

  return (close ?? candidates[0])?.id ?? null;
}

async function fetchTeamFixtures(teamId: number, apiKey: string): Promise<SportMonksFixture[]> {
  const url =
    `${BASE}/teams/${teamId}` +
    `?api_token=${apiKey}` +
    `&include=${encodeURIComponent(INCLUDES)}`;

  const body = (await fetchFromSportMonks(url)) as {
    data?: { fixtures?: SportMonksFixture[] };
  };

  return body.data?.fixtures ?? [];
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

  const appTeamName = APP_TEAM_NAME[appTeamId];
  if (!appTeamName) {
    return res.status(404).json({ error: `Unknown team id: ${appTeamId}` });
  }

  const apiKey = process.env.SPORTMONKS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    let sportMonksId =
      RUNTIME_TEAM_ID_BY_APP_ID[appTeamId] ?? APP_TO_SPORTMONKS_TEAM_ID[appTeamId];

    if (!sportMonksId) {
      const resolvedId = await resolveTeamIdByName(appTeamName, apiKey);
      if (!resolvedId) {
        return res.status(404).json({ error: `No SportMonks team found for ${appTeamId}` });
      }
      sportMonksId = resolvedId;
      RUNTIME_TEAM_ID_BY_APP_ID[appTeamId] = resolvedId;
    }

    let rawFixtures = await fetchTeamFixtures(sportMonksId, apiKey);

    if (!rawFixtures.length) {
      const resolvedId = await resolveTeamIdByName(appTeamName, apiKey);
      if (resolvedId && resolvedId !== sportMonksId) {
        sportMonksId = resolvedId;
        RUNTIME_TEAM_ID_BY_APP_ID[appTeamId] = resolvedId;
        rawFixtures = await fetchTeamFixtures(sportMonksId, apiKey);
      }
    }

    const seasonIdNum = seasonId ? Number(seasonId) : null;
    const filteredBySeason =
      seasonIdNum && !Number.isNaN(seasonIdNum)
        ? rawFixtures.filter((raw) => raw.season_id === seasonIdNum)
        : rawFixtures;

    const selected = filteredBySeason.length
      ? filteredBySeason
      : rawFixtures.slice(0, 8);

    const fixtures = selected.map((raw) => normaliseFixture(raw, appTeamId));
    if (fixtures.length) {
      cache.set(cacheKey, fixtures);
    }
    return res.json({ data: fixtures, source: 'api' });
  } catch (err) {
    console.error('[fixtures]', err);
    return res.status(502).json({ error: 'Failed to fetch from SportMonks' });
  }
});

export default router;
