/** Normalised fixture shape the app consumes. */
export interface AppFixture {
  id: string;
  stage: string;
  round: string;
  kickoffUtc: string;            // ISO-8601 UTC e.g. "2026-06-14T18:00:00Z"
  homeTeam: { id: string; name: string; flag: string };
  awayTeam: { id: string; name: string; flag: string };
  venue: {
    name: string;
    city: string;
    country: string;
    timeZone: string;
  };
}

/** Shape returned by SportMonks v3 fixtures endpoint (partial – only what we need). */
interface SportMonksParticipant {
  id: number;
  name: string;
  short_code: string;
  image_path: string;
  meta: { location: 'home' | 'away' };
}

interface SportMonksVenue {
  name: string;
  city_name: string;
  country: { name: string };
  timezone: string;
}

interface SportMonksRound {
  name: string;
}

interface SportMonksStage {
  name: string;
}

export interface SportMonksFixture {
  id: number;
  name: string;
  season_id: number;
  starting_at: string;          // UTC datetime string
  participants?: SportMonksParticipant[];
  venue?: SportMonksVenue;
  round?: SportMonksRound;
  stage?: SportMonksStage;
}

/** Converts a SportMonks fixture into the app's simplified shape. */
export function normaliseFixture(
  raw: SportMonksFixture,
  appTeamId: string
): AppFixture {
  const home = raw.participants?.find((p) => p.meta.location === 'home');
  const away = raw.participants?.find((p) => p.meta.location === 'away');

  const kickoffUtc =
    raw.starting_at.includes('T')
      ? raw.starting_at
      : raw.starting_at.replace(' ', 'T');

  return {
    id: String(raw.id),
    stage: raw.stage?.name ?? 'Group Stage',
    round: raw.round?.name ?? '',
    kickoffUtc: kickoffUtc.endsWith('Z') ? kickoffUtc : kickoffUtc + 'Z',
    homeTeam: {
      id: String(home?.id ?? appTeamId),
      name: home?.name ?? 'TBD',
      flag: home?.image_path ?? '',
    },
    awayTeam: {
      id: String(away?.id ?? appTeamId),
      name: away?.name ?? 'TBD',
      flag: away?.image_path ?? '',
    },
    venue: {
      name: raw.venue?.name ?? 'TBD',
      city: raw.venue?.city_name ?? 'TBD',
      country: raw.venue?.country?.name ?? 'TBD',
      timeZone: raw.venue?.timezone ?? 'America/New_York',
    },
  };
}
