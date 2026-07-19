import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { apiFetch } from '@/config/api';
import { formatInTimeZone, type TeamMatch } from '@/data/schedule';

type QualificationRound = 'R32' | 'R16' | 'QF' | 'SF' | 'FINAL';

const QUALIFICATION_ROUNDS: Array<{ code: QualificationRound; label: string; title: string }> = [
  { code: 'R32', label: 'R32', title: 'Round of 32' },
  { code: 'R16', label: 'R16', title: 'Round of 16' },
  { code: 'QF', label: 'QF', title: 'Quarter-finals' },
  { code: 'SF', label: 'SF', title: 'Semi-finals' },
  { code: 'FINAL', label: 'FINAL', title: 'Final' },
];

function normalizeRound(value: string | undefined): QualificationRound {
  const upper = String(value ?? '').toUpperCase();
  if (upper === 'R16' || upper === 'QF' || upper === 'SF' || upper === 'FINAL') {
    return upper;
  }
  return 'R32';
}

function getStageShortcutForMatch(match: TeamMatch): QualificationRound | null {
  const source = `${match.stage} ${match.round}`.toLowerCase();
  if (source.includes('round of 32') || /\br32\b/.test(source)) return 'R32';
  if (source.includes('round of 16') || /\br16\b/.test(source)) return 'R16';
  if (source.includes('quarter') || /\bqf\b/.test(source)) return 'QF';
  if (source.includes('semi') || /\bsf\b/.test(source)) return 'SF';
  if (source.includes('final') && !source.includes('semi') && !source.includes('quarter')) return 'FINAL';
  return null;
}

export default function QualificationRoundScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ round?: string; teamId?: string }>();
  const deviceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  const selectedRound = normalizeRound(params.round);
  const selectedRoundMeta =
    QUALIFICATION_ROUNDS.find((item) => item.code === selectedRound) ?? QUALIFICATION_ROUNDS[0];

  const [matches, setMatches] = useState<TeamMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadAllFixtures = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiFetch('/api/fixtures/all');
        if (!response.ok) {
          throw new Error(`Failed to load fixtures: ${response.status}`);
        }

        const payload = (await response.json()) as { data?: TeamMatch[] };
        if (!cancelled) {
          setMatches(payload.data ?? []);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : 'Failed to load fixtures');
          setMatches([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadAllFixtures();

    return () => {
      cancelled = true;
    };
  }, []);

  const roundMatches = useMemo(() => {
    return matches
      .filter((match) => getStageShortcutForMatch(match) === selectedRound)
      .sort((a, b) => new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime());
  }, [matches, selectedRound]);

  const teamId = typeof params.teamId === 'string' ? params.teamId : undefined;

  const handleBack = () => {
    if (teamId) {
      router.push(`/${teamId}`);
      return;
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.push('/');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={['#0a2e0a', '#0a0a0a', '#0a0a2e']} style={styles.gradient}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.navButton} onPress={handleBack}>
            <Text style={styles.navButtonText}>‹ Team</Text>
          </TouchableOpacity>

          <Text style={styles.title} numberOfLines={1}>
            Qualification {selectedRoundMeta.title}
          </Text>

          <TouchableOpacity style={styles.navButton} onPress={() => router.push('/')}>
            <Text style={styles.navButtonText}>Home</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.roundTabsRow}
        >
          {QUALIFICATION_ROUNDS.map((round) => {
            const active = round.code === selectedRound;
            return (
              <Pressable
                key={round.code}
                style={[styles.roundTab, active ? styles.roundTabActive : null]}
                onPress={() =>
                  router.push({
                    pathname: '/qualification/[round]',
                    params: { round: round.code, teamId },
                  })
                }
              >
                <Text style={[styles.roundTabText, active ? styles.roundTabTextActive : null]}>{round.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView contentContainerStyle={styles.content}>
          {loading ? <ActivityIndicator color="#4caf50" style={styles.loader} /> : null}

          {!loading && error ? <Text style={styles.errorText}>⚠ {error}</Text> : null}

          {!loading && !error && roundMatches.length === 0 ? (
            <Text style={styles.emptyText}>Keine Spiele für diese Runde gefunden.</Text>
          ) : null}

          {!loading && !error
            ? roundMatches.map((match) => {
                const isPlayed = new Date(match.kickoffUtc).getTime() <= Date.now();
                return (
                  <Pressable key={match.id} style={styles.matchCard} onPress={() => router.push(`/match/${match.id}`)}>
                    <Text style={styles.matchStage}>{match.stage || selectedRoundMeta.title}</Text>
                    <Text style={styles.matchTeams}>
                      {match.homeTeam.name} vs {match.awayTeam.name}
                    </Text>
                    <Text style={styles.matchTime}>{formatInTimeZone(match.kickoffUtc, deviceTimeZone)}</Text>
                    <Text style={styles.matchVenue}>
                      {match.venue.name}, {match.venue.city}
                    </Text>
                    <Text style={styles.matchScore}>
                      {isPlayed ? `${match.homeScore} : ${match.awayScore}` : 'Noch nicht gespielt'}
                    </Text>
                  </Pressable>
                );
              })
            : null}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  gradient: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  navButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2e7d32',
    backgroundColor: 'rgba(12, 18, 16, 0.7)',
  },
  navButtonText: {
    color: '#d7f0da',
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    flex: 1,
    marginHorizontal: 10,
    color: '#dff5e1',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.4,
  },
  roundTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  roundTab: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#35543a',
    backgroundColor: '#152218',
  },
  roundTabActive: {
    borderColor: '#7edb86',
    backgroundColor: '#24552b',
  },
  roundTabText: {
    color: '#c6dfc8',
    fontSize: 12,
    fontWeight: '700',
  },
  roundTabTextActive: {
    color: '#ffffff',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  loader: {
    marginTop: 40,
  },
  errorText: {
    marginTop: 20,
    color: '#ff8a8a',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    marginTop: 20,
    color: '#d6e2d8',
    fontSize: 14,
  },
  matchCard: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2f4733',
    backgroundColor: 'rgba(18, 30, 21, 0.86)',
    padding: 12,
    gap: 4,
  },
  matchStage: {
    color: '#86e291',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  matchTeams: {
    color: '#edf8ee',
    fontSize: 15,
    fontWeight: '800',
  },
  matchTime: {
    color: '#c8ddcb',
    fontSize: 12,
  },
  matchVenue: {
    color: '#9fc4a6',
    fontSize: 12,
  },
  matchScore: {
    color: '#f3fff4',
    fontSize: 13,
    fontWeight: '700',
  },
});
