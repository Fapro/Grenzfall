import { Router, Request, Response } from 'express';
import * as cache from '../cache';

const router = Router();
const BASE = 'https://api.sportmonks.com/v3/football';

function getSportMonksApiKey(): string {
  return String(process.env.SPORTMONKS_API_KEY || process.env.SPORTMONKS_API_TOKEN || '').trim();
}

interface StandingsRow {
  team_id: number;
  team: {
    name: string;
  };
  group_name?: string;
}

interface StandingsData {
  data?: Array<{
    group_name: string;
    standings: {
      data: StandingsRow[];
    };
  }>;
}

async function fetchFromSportMonks(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`SportMonks ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

function isDnsResolutionError(err: unknown): boolean {
  if (!(err instanceof Error)) {
    return false;
  }

  const cause = (err as Error & { cause?: unknown }).cause as
    | { code?: string }
    | undefined;
  return cause?.code === 'ENOTFOUND';
}

/**
 * GET /api/groups/standings/:seasonId
 * Returns team group assignments from SportMonks standings
 * Response: { groupsByTeamId: Record<teamId, groupLetter> }
 */
router.get('/standings/:seasonId', async (req: Request, res: Response) => {
  const seasonId = Number(req.params.seasonId) || Number(process.env.SPORTMONKS_SEASON_ID) || 26618;
  const cacheKey = `groups:standings:${seasonId}`;

  const cached = cache.get<Record<string, string>>(cacheKey);
  if (cached) {
    return res.json({ data: cached, source: 'cache' });
  }

  const apiKey = getSportMonksApiKey();
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    // Fetch standings for the season which includes group info
    const url = `${BASE}/standings?seasons=${seasonId}&api_token=${apiKey}&include=standings.team`;
    const body = (await fetchFromSportMonks(url)) as StandingsData;

    const groupsByTeamId: Record<string, string> = {};

    // Parse standings and extract group letters
    if (body.data) {
      for (const stageData of body.data) {
        const groupName = stageData.group_name || '';
        // Extract letter from group name (e.g., "Group A" -> "A")
        const letterMatch = groupName.match(/([A-L])/i);
        const groupLetter = letterMatch?.[1]?.toUpperCase() || '';

        if (!groupLetter || !stageData.standings?.data) {
          continue;
        }

        for (const row of stageData.standings.data) {
          if (row.team?.name && row.team_id) {
            groupsByTeamId[String(row.team_id)] = groupLetter;
          }
        }
      }
    }

    cache.set(cacheKey, groupsByTeamId);
    return res.json({ data: groupsByTeamId, source: 'api' });
  } catch (err) {
    console.error('[groups standings]', err);

    if (isDnsResolutionError(err)) {
      return res.status(503).json({
        error:
          'Could not resolve SportMonks host (api.sportmonks.com). Check DNS/network and retry.',
      });
    }

    // Return empty data instead of 502 to allow fallback to hardcoded mapping
    return res.json({ data: {}, source: 'fallback' });
  }
});

export default router;
