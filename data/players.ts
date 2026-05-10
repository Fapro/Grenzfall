import { BACKEND_URL } from '@/config/api';

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

/**
 * Fetch team players from the backend (which calls SportMonks server-side).
 */
export async function fetchTeamPlayers(teamId: string): Promise<Player[]> {
  const url = `${BACKEND_URL}/api/players/${encodeURIComponent(teamId)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Players fetch failed: ${res.status}`);
  }
  const json = (await res.json()) as { data: Player[] };
  return json.data ?? [];
}
