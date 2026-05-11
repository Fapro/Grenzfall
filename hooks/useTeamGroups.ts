import { useState, useEffect } from 'react';
import { BACKEND_URL } from '@/config/api';

export function useTeamGroups(seasonId?: number) {
  const [groupsByTeamId, setGroupsByTeamId] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchGroups() {
      setLoading(true);
      setError(null);
      try {
        const url = seasonId
          ? `${BACKEND_URL}/api/groups/standings/${seasonId}`
          : `${BACKEND_URL}/api/groups/standings/26618`;

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch groups: ${response.statusText}`);
        }
        const result = (await response.json()) as { data?: Record<string, string> };
        setGroupsByTeamId(result.data || {});
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        // Silently fail - app will use hardcoded mapping
      } finally {
        setLoading(false);
      }
    }

    fetchGroups();
  }, [seasonId]);

  return { groupsByTeamId, loading, error };
}
