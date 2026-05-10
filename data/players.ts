import { BACKEND_URL } from '@/config/api';
import { Platform } from 'react-native';

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

function buildPlayerApiBaseCandidates(): string[] {
  const candidates = [BACKEND_URL];

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const host = window.location?.hostname;
    if (host) {
      candidates.push(`http://${host}:3001`);
    }
    candidates.push('http://localhost:3001');
    candidates.push('http://127.0.0.1:3001');
  }

  return [...new Set(candidates.filter(Boolean))];
}

/**
 * Fetch team players from the backend (which calls SportMonks server-side).
 */
export async function fetchTeamPlayers(teamId: string): Promise<TeamPlayersPayload> {
  const bases = buildPlayerApiBaseCandidates();
  const errors: string[] = [];

  for (const base of bases) {
    const url = `${base}/api/players/${encodeURIComponent(teamId)}`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        let details = '';
        try {
          const body = (await res.json()) as { error?: string };
          details = body.error ? ` - ${body.error}` : '';
        } catch {
          // Keep status-only error if body is not JSON.
        }
        errors.push(`${base}: ${res.status}${details}`);
        continue;
      }

      const json = (await res.json()) as {
        data: Player[];
        trainer?: string | null;
      };
      return {
        players: json.data ?? [],
        trainer: json.trainer ?? null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      errors.push(`${base}: ${message}`);
    }
  }

  throw new Error(`Players fetch failed for ${teamId}. Tried: ${errors.join(' | ')}`);
}
