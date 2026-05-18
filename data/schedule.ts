import { apiFetch } from '@/config/api';

export interface TeamMatch {
  id: string;
  stage: string;
  round: string;
  groupLetter?: string;
  kickoffUtc: string;
  homeScore: number;
  awayScore: number;
  homeTeam: { id: string; name: string; flag: string };
  awayTeam: { id: string; name: string; flag: string };
  venue: {
    name: string;
    city: string;
    country: string;
    timeZone: string;
    image: string;
  };
}

/** Fetch team schedule from the backend (which calls SportMonks server-side). */
export async function fetchTeamSchedule(teamId: string): Promise<TeamMatch[]> {
  const res = await apiFetch(`/api/fixtures/${encodeURIComponent(teamId)}`);
  if (!res.ok) {
    throw new Error(`Schedule fetch failed: ${res.status}`);
  }
  const json = (await res.json()) as { data: TeamMatch[] };
  return json.data ?? [];
}

/** Fetch fixtures by raw SportMonks team ID (used for opponent/group member results). */
export async function fetchSportMonksTeamSchedule(
  sportTeamId: string
): Promise<TeamMatch[]> {
  const res = await apiFetch(`/api/fixtures/by-sportmonks/${encodeURIComponent(sportTeamId)}`);
  if (!res.ok) {
    throw new Error(`Opponent schedule fetch failed: ${res.status}`);
  }
  const json = (await res.json()) as { data: TeamMatch[] };
  return json.data ?? [];
}

/** Fetch all group stage fixtures for 2026 World Cup (used for standings). */
export async function fetchAllGroupStageMatches(): Promise<TeamMatch[]> {
  const res = await apiFetch('/api/fixtures/group-stage/all');
  if (!res.ok) {
    throw new Error(`Group stage fetch failed: ${res.status}`);
  }
  const json = (await res.json()) as { data: TeamMatch[] };
  return json.data ?? [];
}

/** Format an ISO UTC datetime string into a readable string in the given IANA timezone. */
export function formatInTimeZone(
  kickoffUtc: string,
  timeZone: string
): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(kickoffUtc));
}
