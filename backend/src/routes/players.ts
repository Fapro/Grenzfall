import { Router, Request, Response } from 'express';
import { APP_TO_SPORTMONKS_TEAM_ID } from '../teamIds';
import { APP_TEAM_NAME } from '../teamNames';
import * as cache from '../cache';

const router = Router();
const BASE = 'https://api.sportmonks.com/v3/football';

function getSportMonksApiKey(): string {
  return String(process.env.SPORTMONKS_API_KEY || process.env.SPORTMONKS_API_TOKEN || '').trim();
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

function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function isExcludedNationalVariant(name: string): boolean {
  const normalized = normalizeName(name);
  return /u\d{2}|women|wnt|olympic|futsal|beachsoccer/.test(normalized);
}

function isNameCloseMatch(candidateName: string, appTeamName: string): boolean {
  const candidate = normalizeName(candidateName);
  const target = normalizeName(appTeamName);
  return candidate === target || candidate.includes(target) || target.includes(candidate);
}

function scoreNameMatch(candidateName: string, appTeamName: string): number {
  const candidate = normalizeName(candidateName);
  const target = normalizeName(appTeamName);
  if (candidate === target) return 100;
  if (candidate.startsWith(target) || target.startsWith(candidate)) return 80;
  if (candidate.includes(target) || target.includes(candidate)) return 60;
  return 0;
}

function isTrainerPosition(positionName: string): boolean {
  const normalized = positionName.toLowerCase();
  if (!/(coach|manager|trainer)/.test(normalized)) {
    return false;
  }
  return !/(assistant|goalkeeping|fitness|analyst|director|doctor|physio)/.test(normalized);
}

function isStaffPosition(positionName: string): boolean {
  return /(coach|manager|trainer|assistant|director|analyst|doctor|physio|staff|scout)/i.test(
    positionName
  );
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

  const nationals = teams.filter(
    (t) => t.type === 'national' && !isExcludedNationalVariant(t.name)
  );
  const candidates = nationals.length ? nationals : teams;

  const exact = candidates.find((t) => isNameCloseMatch(t.name, appTeamName));
  if (exact) {
    return exact.id;
  }

  const ranked = [...candidates].sort(
    (a, b) => scoreNameMatch(b.name, appTeamName) - scoreNameMatch(a.name, appTeamName)
  );
  return ranked[0]?.id ?? null;
}

async function fetchPlayersByTeamId(teamId: number, apiKey: string): Promise<Array<{
  id: number;
  common_name?: string;
  name?: string;
  display_name?: string;
  firstname?: string;
  lastname?: string;
  jersey_number?: number;
  shirt_number?: number;
  number?: number;
  position?: { id: number; name: string } | null;
  date_of_birth?: string;
}>> {
  const hasUsableName = (player: {
    common_name?: string;
    name?: string;
    display_name?: string;
    firstname?: string;
    lastname?: string;
  }): boolean => {
    const fullFromParts = [player.firstname, player.lastname]
      .filter(Boolean)
      .join(' ')
      .trim();
    return Boolean(player.common_name || player.name || player.display_name || fullFromParts);
  };

  // Prefer team include with nested player relation to ensure team-specific squads
  // with usable player names.
  const candidateUrls = [
    `${BASE}/teams/${teamId}` +
      `?api_token=${apiKey}` +
      `&include=${encodeURIComponent('players;players.player;players.position;players.player.position')}`,
    `${BASE}/players` +
      `?team_id=${teamId}` +
      `&api_token=${apiKey}` +
      `&include=position`,
    `${BASE}/players` +
      `?filters=${encodeURIComponent(`teamId:${teamId}`)}` +
      `&api_token=${apiKey}` +
      `&include=position`,
  ];

  let lastError: unknown = null;

  for (const url of candidateUrls) {
    try {
      const body = (await fetchFromSportMonks(url)) as {
        data?:
          | Array<{
              id: number;
              common_name?: string;
              name?: string;
              display_name?: string;
              firstname?: string;
              lastname?: string;
              jersey_number?: number;
              shirt_number?: number;
              number?: number;
              position?: { id: number; name: string } | null;
              date_of_birth?: string;
            }>
          | {
              players?: Array<{
                id: number;
                player_id?: number;
                player?: {
                  id: number;
                  common_name?: string;
                  name?: string;
                  display_name?: string;
                  firstname?: string;
                  lastname?: string;
                  jersey_number?: number;
                  shirt_number?: number;
                  number?: number;
                  position?: { id: number; name: string } | null;
                  date_of_birth?: string;
                };
                common_name?: string;
                name?: string;
                display_name?: string;
                firstname?: string;
                lastname?: string;
                jersey_number?: number;
                shirt_number?: number;
                number?: number;
                position?: { id: number; name: string } | null;
                date_of_birth?: string;
              }>;
            };
      };

      if (Array.isArray(body.data) && body.data.length > 0) {
        const namedPlayers = body.data.filter(hasUsableName);
        if (namedPlayers.length > 0) {
          return namedPlayers;
        }
      }

      if (!Array.isArray(body.data) && body.data?.players?.length) {
        const normalizedPlayers = body.data.players.map((row) => {
          const player = row.player;
          if (player) {
            return {
              ...player,
              id: player.id,
              jersey_number: row.jersey_number ?? player.jersey_number,
              position: player.position ?? row.position,
            };
          }

          return {
            id: row.player_id ?? row.id,
            common_name: row.common_name,
            name: row.name,
            display_name: row.display_name,
            firstname: row.firstname,
            lastname: row.lastname,
            jersey_number: row.jersey_number,
            shirt_number: row.shirt_number,
            number: row.number,
            position: row.position,
            date_of_birth: row.date_of_birth,
          };
        });

        const namedPlayers = normalizedPlayers.filter(hasUsableName);
        if (namedPlayers.length > 0) {
          return namedPlayers;
        }
      }
    } catch (err) {
      lastError = err;
      continue;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return [];
}

async function fetchTeamMetaById(
  teamId: number,
  apiKey: string
): Promise<{ id: number; name: string; type?: string } | null> {
  const url = `${BASE}/teams/${teamId}?api_token=${apiKey}`;
  const body = (await fetchFromSportMonks(url)) as {
    data?: { id: number; name: string; type?: string };
  };
  return body.data ?? null;
}

async function fetchTrainerByTeamId(
  teamId: number,
  apiKey: string
): Promise<string | null> {
  const url =
    `${BASE}/teams/${teamId}` +
    `?api_token=${apiKey}` +
    `&include=${encodeURIComponent('coaches;coaches.coach')}`;

  const body = (await fetchFromSportMonks(url)) as {
    data?: {
      coaches?: Array<{
        active?: boolean;
        coach?: {
          common_name?: string;
          display_name?: string;
          name?: string;
          firstname?: string;
          lastname?: string;
        };
      }>;
    };
  };

  const coaches = body.data?.coaches ?? [];
  const preferredOrder = [
    ...coaches.filter((c) => c.active),
    ...coaches.filter((c) => !c.active),
  ];

  for (const row of preferredOrder) {
    const coach = row.coach;
    if (!coach) {
      continue;
    }

    const fallbackNameFromParts = [coach.firstname, coach.lastname]
      .filter(Boolean)
      .join(' ')
      .trim();
    const trainerName =
      coach.common_name || coach.display_name || coach.name || fallbackNameFromParts;

    if (trainerName) {
      return trainerName;
    }
  }

  return null;
}

async function resolveWorkingTeamIdForPlayers(
  appTeamName: string,
  currentTeamId: number,
  apiKey: string
): Promise<number> {
  const searchUrl =
    `${BASE}/teams/search/${encodeURIComponent(appTeamName)}` +
    `?api_token=${apiKey}`;
  const searchBody = (await fetchFromSportMonks(searchUrl)) as {
    data?: Array<{ id: number; name: string; type?: string }>;
  };

  const rankedFromSearch = (searchBody.data ?? [])
    .filter((t) => t.type === 'national')
    .filter((t) => !isExcludedNationalVariant(t.name))
    .filter((t) => isNameCloseMatch(t.name, appTeamName))
    .sort((a, b) => scoreNameMatch(b.name, appTeamName) - scoreNameMatch(a.name, appTeamName))
    .map((t) => t.id)
    .filter((id, index, arr) => arr.indexOf(id) === index)
    .slice(0, 6);

  const candidates = [...rankedFromSearch, currentTeamId]
    .filter((id, index, arr) => arr.indexOf(id) === index)
    .slice(0, 8);

  for (const candidateId of candidates) {
    const meta = await fetchTeamMetaById(candidateId, apiKey);
    if (!meta) {
      continue;
    }

    if (meta.type !== 'national') {
      continue;
    }

    if (isExcludedNationalVariant(meta.name)) {
      continue;
    }

    if (!isNameCloseMatch(meta.name, appTeamName)) {
      continue;
    }

    const players = await fetchPlayersByTeamId(candidateId, apiKey);
    if (players.length > 0) {
      return candidateId;
    }
  }

  return currentTeamId;
}

/**
 * GET /api/players/:appTeamId
 * Returns all squad players for the given app team ID.
 */
router.get('/:appTeamId', async (req: Request, res: Response) => {
  const appTeamId = String(req.params.appTeamId);
  const cacheKey = `players:v7:${appTeamId}`;

  const cached = cache.get<{ data: unknown[]; trainer: string | null }>(cacheKey);
  if (cached && cached.data.length > 0) {
    return res.json({ ...cached, source: 'cache' });
  }

  const appTeamName = APP_TEAM_NAME[appTeamId];
  if (!appTeamName) {
    return res.status(404).json({ error: `Unknown team id: ${appTeamId}` });
  }

  const apiKey = getSportMonksApiKey();
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const mappedTeamId = APP_TO_SPORTMONKS_TEAM_ID[appTeamId];
    const resolvedByName = await resolveTeamIdByName(appTeamName, apiKey);

    const sportMonksTeamId = resolvedByName ?? mappedTeamId;
    if (!sportMonksTeamId) {
      return res.status(404).json({ error: `Could not resolve team: ${appTeamName}` });
    }

    const workingTeamId = await resolveWorkingTeamIdForPlayers(
      appTeamName,
      sportMonksTeamId,
      apiKey
    );
    const explicitTrainer = await fetchTrainerByTeamId(workingTeamId, apiKey);
    const rawPlayers = await fetchPlayersByTeamId(workingTeamId, apiKey);

    const normalizedRows = rawPlayers
      .map((p) => {
        const birthDate = p.date_of_birth ? new Date(p.date_of_birth) : null;
        const age = birthDate
          ? new Date().getFullYear() - birthDate.getFullYear()
          : undefined;

        const fallbackNameFromParts = [p.firstname, p.lastname]
          .filter(Boolean)
          .join(' ')
          .trim();
        const normalizedName =
          p.common_name || p.display_name || p.name || fallbackNameFromParts || 'Unknown';

        const rawNumber = p.jersey_number ?? p.shirt_number ?? p.number;
        const number =
          typeof rawNumber === 'number' && Number.isFinite(rawNumber) ? rawNumber : 0;

        // Try to get a number from the data if available, otherwise use a placeholder
        // SportMonks doesn't always provide jersey numbers in players endpoint
        const positionName = p.position?.name || 'Unknown';

        return {
          id: String(p.id),
          name: normalizedName,
          number,
          position: positionName,
          age: age ?? undefined,
        };
      })
      .filter((p) => p !== null);

    const inferredTrainer =
      normalizedRows.find((p) => isTrainerPosition(p.position))?.name ?? null;
    const trainer = explicitTrainer ?? inferredTrainer;

    const players = normalizedRows
      .filter((p) => !isStaffPosition(p.position))
      .sort((a, b) => {
        // Sort by position priority, then by name
        const positionOrder: Record<string, number> = {
          'Goalkeeper': 1,
          'Defender': 2,
          'Midfielder': 3,
          'Forward': 4,
          'Attacker': 4,
        };
        const aPos = positionOrder[a.position] ?? 99;
        const bPos = positionOrder[b.position] ?? 99;
        if (aPos !== bPos) return aPos - bPos;
        return a.name.localeCompare(b.name);
      });

    if (players.length > 0) {
      cache.set(cacheKey, { data: players, trainer });
    }
    return res.json({ data: players, trainer });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Players fetch error for ${appTeamId}:`, message);

    if (isDnsResolutionError(err)) {
      return res.status(503).json({
        error:
          'Could not resolve SportMonks host (api.sportmonks.com). Check DNS/network and retry.',
      });
    }

    return res.status(500).json({ error: `Failed to fetch players: ${message}` });
  }
});

export default router;
