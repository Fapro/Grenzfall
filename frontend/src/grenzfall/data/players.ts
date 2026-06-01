import { apiFetch } from '@/config/api';

export interface Player {
  id: string;
  name: string;
  number: number;
  position: string;
  age: number;
  club?: string;
}

export interface TeamPlayers {
  teamId: string;
  teamName: string;
  players: Player[];
}

export interface TeamPlayersPayload {
  players: Player[];
  trainer: string | null;
}

/**
 * Fetch team players from the backend (which calls SportMonks server-side).
 */
export async function fetchTeamPlayers(teamId: string): Promise<TeamPlayersPayload> {
  const res = await apiFetch(`/api/players/${encodeURIComponent(teamId)}`);
  if (!res.ok) {
    throw new Error(`Players fetch failed for ${teamId}: ${res.status}`);
  }

  const json = (await res.json()) as {
    data: Player[];
    trainer?: string | null;
  };

  return {
    players: json.data ?? [],
    trainer: json.trainer ?? null,
  };
}
