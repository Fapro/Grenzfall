import { Router, Request, Response } from 'express';
import { APP_TO_SPORTMONKS_TEAM_ID } from '../teamIds';
import { APP_TEAM_NAME } from '../teamNames';
import * as cache from '../cache';

const router = Router();
const BASE = 'https://api.sportmonks.com/v3/football';

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

/**
 * GET /api/players/:appTeamId
 * Returns all squad players for the given app team ID.
 */
router.get('/:appTeamId', async (req: Request, res: Response) => {
  const appTeamId = String(req.params.appTeamId);
  const cacheKey = `players:${appTeamId}`;

  const cached = cache.get<unknown[]>(cacheKey);
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
    let sportMonksTeamId = APP_TO_SPORTMONKS_TEAM_ID[appTeamId];

    if (!sportMonksTeamId) {
      const resolved = await resolveTeamIdByName(appTeamName, apiKey);
      if (!resolved) {
        return res.status(404).json({ error: `Could not resolve team: ${appTeamName}` });
      }
      sportMonksTeamId = resolved;
    }

    const url =
      `${BASE}/teams/${sportMonksTeamId}/squad` +
      `?api_token=${apiKey}` +
      `&include=players`;

    const body = (await fetchFromSportMonks(url)) as {
      data?: Array<{
        player_id?: number;
        player?: {
          id: number;
          name: string;
          number?: number;
          position?: string;
          date_of_birth?: string;
          common_name?: string;
        };
      }>;
    };

    const players = (body.data ?? [])
      .map((entry) => {
        const p = entry.player;
        if (!p) return null;

        const birthDate = p.date_of_birth ? new Date(p.date_of_birth) : null;
        const age = birthDate
          ? new Date().getFullYear() - birthDate.getFullYear()
          : undefined;

        return {
          id: String(p.id),
          name: p.common_name || p.name || 'Unknown',
          number: p.number ?? 0,
          position: p.position ?? 'Unknown',
          age: age ?? undefined,
        };
      })
      .filter((p) => p !== null)
      .sort((a, b) => {
        // Sort by position priority, then by number
        const positionOrder: Record<string, number> = {
          'Goalkeeper': 1,
          'Defender': 2,
          'Midfielder': 3,
          'Forward': 4,
          'Attacker': 4,
        };
        const aPos = positionOrder[a!.position] ?? 99;
        const bPos = positionOrder[b!.position] ?? 99;
        if (aPos !== bPos) return aPos - bPos;
        return (a!.number || 0) - (b!.number || 0);
      });

    cache.set(cacheKey, players);
    return res.json({ data: players });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Players fetch error for ${appTeamId}:`, message);
    return res.status(500).json({ error: `Failed to fetch players: ${message}` });
  }
});

export default router;
