import { Router, Request, Response } from 'express';
import { APP_TO_SPORTMONKS_TEAM_ID } from '../teamIds';
import { APP_TEAM_NAME } from '../teamNames';
import { normaliseFixture, SportMonksFixture, AppFixture } from '../types';
import * as cache from '../cache';

const router = Router();
const BASE = 'https://api.sportmonks.com/v3/football';
const INCLUDES =
  'fixtures;fixtures.participants;fixtures.scores;fixtures.venue;fixtures.venue.country;fixtures.round;fixtures.stage';
const RUNTIME_TEAM_ID_BY_APP_ID: Record<string, number> = {};

/** Canonical World Cup 2026 grouping (must mirror home page TEAM_GROUP_BY_ID). */
const APP_TEAM_GROUP_BY_ID: Record<string, string> = {
  cze: 'A',
  kor: 'A',
  mex: 'A',
  zaf: 'A',
  can: 'B',
  qat: 'B',
  sui: 'B',
  bih: 'B',
  bra: 'C',
  mar: 'C',
  sco: 'C',
  hai: 'C',
  aus: 'D',
  tur: 'D',
  usa: 'D',
  par: 'D',
  civ: 'E',
  ecu: 'E',
  ger: 'E',
  cuw: 'E',
  jpn: 'F',
  ned: 'F',
  tun: 'F',
  swe: 'F',
  bel: 'G',
  egy: 'G',
  irn: 'G',
  nzl: 'G',
  cpv: 'H',
  sau: 'H',
  esp: 'H',
  uru: 'H',
  fra: 'I',
  irq: 'I',
  nor: 'I',
  sen: 'I',
  arg: 'J',
  aut: 'J',
  jor: 'J',
  alg: 'J',
  col: 'K',
  drc: 'K',
  por: 'K',
  uzb: 'K',
  eng: 'L',
  pan: 'L',
  cro: 'L',
  gha: 'L',
};

const TEAM_NAME_TO_APP_ID: Record<string, string> = {
  germany: 'ger',
  france: 'fra',
  spain: 'esp',
  england: 'eng',
  portugal: 'por',
  netherlands: 'ned',
  belgium: 'bel',
  austria: 'aut',
  switzerland: 'sui',
  norway: 'nor',
  sweden: 'swe',
  scotland: 'sco',
  'czech republic': 'cze',
  czechia: 'cze',
  croatia: 'cro',
  'bosnia and herzegovina': 'bih',
  turkey: 'tur',
  turkiye: 'tur',
  brazil: 'bra',
  argentina: 'arg',
  colombia: 'col',
  paraguay: 'par',
  uruguay: 'uru',
  ecuador: 'ecu',
  usa: 'usa',
  'united states': 'usa',
  mexico: 'mex',
  canada: 'can',
  panama: 'pan',
  haiti: 'hai',
  curacao: 'cuw',
  algeria: 'alg',
  morocco: 'mar',
  senegal: 'sen',
  egypt: 'egy',
  ghana: 'gha',
  'south africa': 'zaf',
  'cape verde': 'cpv',
  "cote d'ivoire": 'civ',
  "côte d'ivoire": 'civ',
  'ivory coast': 'civ',
  'dr congo': 'drc',
  'congo dr': 'drc',
  japan: 'jpn',
  'korea republic': 'kor',
  'south korea': 'kor',
  australia: 'aus',
  iran: 'irn',
  'ir iran': 'irn',
  'saudi arabia': 'sau',
  qatar: 'qat',
  uzbekistan: 'uzb',
  jordan: 'jor',
  iraq: 'irq',
  'new zealand': 'nzl',
};

function deriveGroupLetterFromFixture(raw: SportMonksFixture): string | undefined {
  const home = raw.participants?.find((p) => p.meta.location === 'home');
  const away = raw.participants?.find((p) => p.meta.location === 'away');

  const teamNames: string[] = [];
  if (home?.name) teamNames.push(home.name);
  if (away?.name) teamNames.push(away.name);

  if (teamNames.length > 0) {
    return deriveGroupLetterFromTeamNames(teamNames);
  }

  return undefined;
}

function deriveGroupLetterFromTeamNames(teamNames: string[]): string | undefined {
  for (const name of teamNames) {
    const appId = TEAM_NAME_TO_APP_ID[normalizeName(name)] ?? TEAM_NAME_TO_APP_ID[name.toLowerCase()];
    if (!appId) {
      continue;
    }
    const group = APP_TEAM_GROUP_BY_ID[appId];
    if (group) {
      return group;
    }
  }

  return undefined;
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

function normalizeVenueToken(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

async function fetchWikipediaImageForQuery(query: string): Promise<string | null> {
  const searchUrl =
    'https://en.wikipedia.org/w/api.php' +
    `?action=query&list=search&srsearch=${encodeURIComponent(query)}` +
    '&srlimit=1&format=json&utf8=1';

  const searchBody = (await fetchFromSportMonks(searchUrl)) as {
    query?: { search?: Array<{ title: string }> };
  };
  const title = searchBody.query?.search?.[0]?.title;
  if (!title) {
    return null;
  }

  const summaryUrl =
    'https://en.wikipedia.org/api/rest_v1/page/summary/' +
    encodeURIComponent(title.replace(/\s+/g, '_'));

  const summary = (await fetchFromSportMonks(summaryUrl)) as {
    originalimage?: { source?: string };
    thumbnail?: { source?: string };
  };

  return summary.originalimage?.source ?? summary.thumbnail?.source ?? null;
}

async function resolveVenueImage(
  venueName: string,
  city: string,
  country: string
): Promise<string> {
  const imageCacheKey = `venue-image:${normalizeVenueToken(venueName)}:${normalizeVenueToken(city)}`;
  const cached = cache.get<string>(imageCacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const queries = [
    `${venueName} ${city} stadium`,
    `${venueName} stadium`,
    `${venueName} ${country}`,
  ];

  for (const query of queries) {
    try {
      const image = await fetchWikipediaImageForQuery(query);
      if (image) {
        cache.set(imageCacheKey, image);
        return image;
      }
    } catch {
      // Try next query candidate.
    }
  }

  cache.set(imageCacheKey, '');
  return '';
}

async function attachVenueImages(fixtures: AppFixture[]): Promise<AppFixture[]> {
  return Promise.all(
    fixtures.map(async (fixture) => {
      if (fixture.venue.image) {
        return fixture;
      }

      const image = await resolveVenueImage(
        fixture.venue.name,
        fixture.venue.city,
        fixture.venue.country
      );

      if (!image) {
        return fixture;
      }

      return {
        ...fixture,
        venue: {
          ...fixture.venue,
          image,
        },
      };
    })
  );
}

/**
 * GET /api/fixtures/by-sportmonks/:sportTeamId
 * Returns fixtures for a raw SportMonks team ID.
 */
router.get('/by-sportmonks/:sportTeamId', async (req: Request, res: Response) => {
  const sportTeamId = Number(req.params.sportTeamId);
  const seasonId = process.env.SPORTMONKS_SEASON_ID;
  const cacheKey = `fixtures:sport:${sportTeamId}:${seasonId ?? 'all'}`;

  if (!Number.isFinite(sportTeamId) || sportTeamId <= 0) {
    return res.status(400).json({ error: 'Invalid SportMonks team id' });
  }

  const cached = cache.get<AppFixture[]>(cacheKey);
  if (cached) {
    return res.json({ data: cached, source: 'cache' });
  }

  const apiKey = process.env.SPORTMONKS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const rawFixtures = await fetchTeamFixtures(sportTeamId, apiKey);
    const seasonIdNum = seasonId ? Number(seasonId) : null;
    const filteredBySeason =
      seasonIdNum && !Number.isNaN(seasonIdNum)
        ? rawFixtures.filter((raw) => raw.season_id === seasonIdNum)
        : rawFixtures;

    const selected = filteredBySeason.length
      ? filteredBySeason
      : rawFixtures.slice(0, 8);

    const fixtures = await attachVenueImages(
      selected.map((raw) => {
        const groupLetter = deriveGroupLetterFromFixture(raw);
        return normaliseFixture(raw, String(sportTeamId), groupLetter);
      })
    );
    if (fixtures.length) {
      cache.set(cacheKey, fixtures);
    }
    return res.json({ data: fixtures, source: 'api' });
  } catch (err) {
    console.error('[fixtures by-sportmonks]', err);

    if (isDnsResolutionError(err)) {
      return res.status(503).json({
        error:
          'Could not resolve SportMonks host (api.sportmonks.com). Check DNS/network and retry.',
      });
    }

    return res.status(502).json({ error: 'Failed to fetch from SportMonks' });
  }
});

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

    const fixtures = await attachVenueImages(
      selected.map((raw) => {
        const groupLetter = deriveGroupLetterFromFixture(raw);
        return normaliseFixture(raw, appTeamId, groupLetter);
      })
    );
    if (fixtures.length) {
      cache.set(cacheKey, fixtures);
    }
    return res.json({ data: fixtures, source: 'api' });
  } catch (err) {
    console.error('[fixtures]', err);

    if (isDnsResolutionError(err)) {
      return res.status(503).json({
        error:
          'Could not resolve SportMonks host (api.sportmonks.com). Check DNS/network and retry.',
      });
    }

    return res.status(502).json({ error: 'Failed to fetch from SportMonks' });
  }
});

/**
 * GET /api/fixtures/group-stage/all
 * Returns all group stage fixtures for the 2026 World Cup season.
 * This is used to calculate proper group standings across all teams.
 */
router.get('/group-stage/all', async (req: Request, res: Response) => {
  const seasonId = process.env.SPORTMONKS_SEASON_ID;
  const cacheKey = `fixtures:group-stage:${seasonId ?? 'all'}`;

  const cached = cache.get<AppFixture[]>(cacheKey);
  if (cached) {
    return res.json({ data: cached, source: 'cache' });
  }

  const apiKey = process.env.SPORTMONKS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const seasonIdNum = seasonId ? Number(seasonId) : 26618;
    // Fetch season fixtures via season endpoint; includes are valid here.
    const fixtureIncludes =
      'fixtures;fixtures.participants;fixtures.scores;fixtures.venue;fixtures.venue.country;fixtures.round;fixtures.stage';
    const url =
      `${BASE}/seasons/${seasonIdNum}` +
      `?api_token=${apiKey}` +
      `&include=${encodeURIComponent(fixtureIncludes)}`;

    const body = (await fetchFromSportMonks(url)) as {
      data?: { fixtures?: SportMonksFixture[] };
    };

    const allFixtures = body.data?.fixtures ?? [];
    
    // Filter to only group stage matches
    const groupStageMatches = allFixtures.filter((raw) => {
      const stage = raw.stage?.name ?? '';
      return stage.toLowerCase().includes('group');
    });

    const fixtures = await attachVenueImages(
      groupStageMatches.map((raw) => normaliseFixture(raw, 'all-group-stage'))
    );

    if (fixtures.length) {
      cache.set(cacheKey, fixtures);
    }
    return res.json({ data: fixtures, source: 'api' });
  } catch (err) {
    console.error('[fixtures group-stage]', err);

    if (isDnsResolutionError(err)) {
      return res.status(503).json({
        error:
          'Could not resolve SportMonks host (api.sportmonks.com). Check DNS/network and retry.',
      });
    }

    return res.status(502).json({ error: 'Failed to fetch from SportMonks' });
  }
});

/**
 * GET /api/match/:matchId
 * Returns details for a specific match by ID.
 */
router.get('/match/:matchId', async (req: Request, res: Response) => {
  const matchId = String(req.params.matchId);
  const seasonId = process.env.SPORTMONKS_SEASON_ID;
  const cacheKey = `match:${matchId}`;

  const cached = cache.get<AppFixture>(cacheKey);
  if (cached) {
    return res.json({ data: cached, source: 'cache' });
  }

  const apiKey = process.env.SPORTMONKS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const seasonIdNum = seasonId ? Number(seasonId) : 26618;
    const fixtureIncludes =
      'fixtures;fixtures.participants;fixtures.scores;fixtures.venue;fixtures.venue.country;fixtures.round;fixtures.stage';
    const url =
      `${BASE}/seasons/${seasonIdNum}` +
      `?api_token=${apiKey}` +
      `&include=${encodeURIComponent(fixtureIncludes)}`;

    const body = (await fetchFromSportMonks(url)) as {
      data?: { fixtures?: SportMonksFixture[] };
    };

    const allFixtures = body.data?.fixtures ?? [];
    const match = allFixtures.find((f) => String(f.id) === matchId);

    if (!match) {
      return res.status(404).json({ error: `Match not found: ${matchId}` });
    }

    const groupLetter = deriveGroupLetterFromFixture(match);
    const fixture = normaliseFixture(match, 'match-detail', groupLetter);
    const withImage = (await attachVenueImages([fixture]))[0];

    cache.set(cacheKey, withImage);
    return res.json({ data: withImage, source: 'api' });
  } catch (err) {
    console.error('[match detail]', err);

    if (isDnsResolutionError(err)) {
      return res.status(503).json({
        error:
          'Could not resolve SportMonks host (api.sportmonks.com). Check DNS/network and retry.',
      });
    }

    return res.status(502).json({ error: 'Failed to fetch match details' });
  }
});

export default router;
