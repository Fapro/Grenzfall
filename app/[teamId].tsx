import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StadiumAnimation } from '@/components/StadiumAnimation';
import { TournamentStages } from '@/components/TournamentStages';
import { PlayerList } from '@/components/PlayerList';
import { useRoar } from '@/hooks/useRoar';
import { TEAMS } from '@/data/teams';
import { fetchTeamSchedule, formatInTimeZone, type TeamMatch } from '@/data/schedule';
import { fetchTeamPlayers, type Player } from '@/data/players';

export default function TeamScreen() {
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const router = useRouter();
  const { play, isPlaying } = useRoar();
  const { width } = useWindowDimensions();

  const flagSize = Math.min(width * 0.26, 112);
  const teamTitleOffset = Math.min(width * 0.34, 132);

  const team = TEAMS.find((t) => t.id === teamId);
  const deviceTimeZone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  const [schedule, setSchedule] = useState<TeamMatch[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const scoreByFixtureRef = useRef<Record<string, number>>({});
  const [tipsByMatch, setTipsByMatch] = useState<
    Record<string, { home: string; away: string }>
  >({});

  const [players, setPlayers] = useState<Player[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [playersError, setPlayersError] = useState<string | null>(null);

  const setTipValue = useCallback(
    (matchId: string, side: 'home' | 'away', value: string) => {
      const cleaned = value.replace(/[^0-9]/g, '').slice(0, 2);
      setTipsByMatch((prev) => ({
        ...prev,
        [matchId]: {
          home: prev[matchId]?.home ?? '',
          away: prev[matchId]?.away ?? '',
          [side]: cleaned,
        },
      }));
    },
    []
  );

  const loadSchedule = useCallback(async (options?: {
    showLoader?: boolean;
    detectGoals?: boolean;
  }) => {
    const showLoader = options?.showLoader ?? true;
    const detectGoals = options?.detectGoals ?? false;

    if (!team) {
      setSchedule([]);
      return;
    }

    if (showLoader) {
      setScheduleLoading(true);
    }
    setScheduleError(null);
    try {
      const fixtures = await fetchTeamSchedule(team.id);
      if (detectGoals) {
        const goalDetected = fixtures.some((fixture) => {
          const prevTotal = scoreByFixtureRef.current[fixture.id];
          const nextTotal = fixture.homeScore + fixture.awayScore;
          return prevTotal !== undefined && nextTotal > prevTotal;
        });
        if (goalDetected) {
          play();
        }
      }

      scoreByFixtureRef.current = fixtures.reduce<Record<string, number>>(
        (acc, fixture) => {
          acc[fixture.id] = fixture.homeScore + fixture.awayScore;
          return acc;
        },
        {}
      );
      setSchedule(fixtures);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load schedule';
      setScheduleError(message);
    } finally {
      if (showLoader) {
        setScheduleLoading(false);
      }
    }
  }, [team, play]);

  const loadPlayers = useCallback(async () => {
    if (!team) {
      setPlayers([]);
      return;
    }

    setPlayersLoading(true);
    setPlayersError(null);
    try {
      const playerList = await fetchTeamPlayers(team.id);
      setPlayers(playerList);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load players';
      setPlayersError(message);
      setPlayers([]);
    } finally {
      setPlayersLoading(false);
    }
  }, [team]);

  useEffect(() => {
    if (!team) {
      return;
    }

    scoreByFixtureRef.current = {};
    play();
    void loadSchedule({ showLoader: true, detectGoals: false });
    void loadPlayers();

    const interval = setInterval(() => {
      void loadSchedule({ showLoader: false, detectGoals: true });
    }, 30000);

    return () => clearInterval(interval);
  }, [team, play, loadSchedule, loadPlayers]);

  if (!team) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>Team not found</Text>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={['#0a2e0a', '#0a0a0a', '#0a0a2e']}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <SafeAreaView style={styles.safe}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.scheduleHeaderCard}>
            <Text style={styles.scheduleTitle}>{team.name} Match Schedule</Text>
            <Text style={styles.scheduleSubTitle}>
              Device timezone: {deviceTimeZone}
            </Text>
          </View>

          {scheduleLoading && (
            <ActivityIndicator color="#4caf50" style={{ marginTop: 24 }} />
          )}

          {scheduleError != null && (
            <View style={styles.scheduleError}>
              <Text style={styles.scheduleErrorText}>⚠ {scheduleError}</Text>
            </View>
          )}

          {!scheduleLoading && !scheduleError && schedule.length === 0 && (
            <Text style={styles.scheduleEmptyText}>No fixtures found.</Text>
          )}

          {schedule.map((match) => {
            const tip = tipsByMatch[match.id] ?? { home: '', away: '' };
            return (
              <View key={match.id} style={styles.matchCard}>
                <View style={styles.matchTopRow}>
                  <Text style={styles.stage}>
                    {match.stage}{match.round ? ` · ${match.round}` : ''}
                  </Text>
                  <Text style={styles.versus}>
                    {match.homeTeam.name} {match.homeScore} - {match.awayScore} {match.awayTeam.name}
                  </Text>
                </View>

                <Text style={styles.venueLine}>
                  {match.venue.name}, {match.venue.city}, {match.venue.country}
                </Text>

                <View style={styles.resultBlock}>
                  <Text style={styles.resultLabel}>Ergebnis</Text>
                  <Text style={styles.resultValue}>
                    {match.homeTeam.name} {match.homeScore} - {match.awayScore} {match.awayTeam.name}
                  </Text>
                </View>

                <View style={styles.tipBlock}>
                  <Text style={styles.tipLabel}>Dein Tipp</Text>
                  <View style={styles.tipRow}>
                    <TextInput
                      value={tip.home}
                      onChangeText={(v) => setTipValue(match.id, 'home', v)}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor="#809b82"
                      style={styles.tipInput}
                    />
                    <Text style={styles.tipDash}>-</Text>
                    <TextInput
                      value={tip.away}
                      onChangeText={(v) => setTipValue(match.id, 'away', v)}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor="#809b82"
                      style={styles.tipInput}
                    />
                  </View>
                </View>

                <View style={styles.timeBlock}>
                  <Text style={styles.timeLabel}>Venue time ({match.venue.timeZone})</Text>
                  <Text style={styles.timeValue}>
                    {formatInTimeZone(match.kickoffUtc, match.venue.timeZone)}
                  </Text>
                </View>

                <View style={styles.timeBlock}>
                  <Text style={styles.timeLabel}>Your time ({deviceTimeZone})</Text>
                  <Text style={styles.timeValue}>
                    {formatInTimeZone(match.kickoffUtc, deviceTimeZone)}
                  </Text>
                </View>
              </View>
            );
          })}

          <TournamentStages />

          <PlayerList
            players={players}
            isLoading={playersLoading}
            error={playersError}
          />

          <View style={styles.hero}>
            <StadiumAnimation isPlaying={isPlaying} />

            <View style={styles.flagContainer}>
              <Text style={[styles.flag, { fontSize: flagSize }]}>{team.flag}</Text>
            </View>

            <Text style={[styles.teamName, { marginTop: teamTitleOffset }]}>{team.name}</Text>
            <Text style={styles.region}>{team.region}</Text>

            <Text style={styles.goalHint}>
              WAV plays once on selection and automatically on goals.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0a0a',
  },
  notFoundText: {
    color: '#888',
    fontSize: 16,
  },
  back: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
    alignSelf: 'flex-start',
  },
  backText: {
    color: '#4caf50',
    fontSize: 18,
    fontWeight: '600',
  },
  hero: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  flagContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flag: {
    textAlign: 'center',
  },
  teamName: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    width: '100%',
    letterSpacing: 0.5,
  },
  region: {
    color: '#4caf50',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 4,
    marginBottom: 20,
  },
  goalHint: {
    marginTop: 12,
    color: '#9cd6a0',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  scheduleHeaderCard: {
    marginTop: 22,
    width: '100%',
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(12, 18, 16, 0.82)',
    borderColor: '#2e7d32',
    borderWidth: 1,
  },
  scheduleTitle: {
    color: '#f2f2f2',
    fontSize: 20,
    fontWeight: '800',
  },
  scheduleSubTitle: {
    color: '#9cd6a0',
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  scheduleError: {
    width: '100%',
    marginTop: 12,
    padding: 12,
    backgroundColor: '#2e0a0a',
    borderRadius: 10,
    borderColor: '#7d2e2e',
    borderWidth: 1,
  },
  scheduleErrorText: {
    color: '#ff8a8a',
    fontSize: 13,
  },
  scheduleEmptyText: {
    color: '#666',
    textAlign: 'center',
    marginTop: 24,
    fontSize: 14,
  },
  matchCard: {
    marginTop: 12,
    width: '100%',
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(10, 10, 10, 0.86)',
    borderColor: '#2b3a2c',
    borderWidth: 1,
  },
  matchTopRow: {
    marginBottom: 8,
  },
  stage: {
    color: '#89c78f',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  versus: {
    marginTop: 4,
    color: '#f5f5f5',
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 1,
  },
  venueLine: {
    color: '#afafaf',
    fontSize: 13,
    marginBottom: 10,
  },
  resultBlock: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#2e7d32',
    marginBottom: 8,
  },
  resultLabel: {
    color: '#9cd6a0',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  resultValue: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  tipBlock: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#2b3a2c',
    marginBottom: 8,
  },
  tipLabel: {
    color: '#a7c9a9',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  tipInput: {
    width: 56,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3a5040',
    backgroundColor: '#111713',
    color: '#ffffff',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
  },
  tipDash: {
    color: '#d7e3d8',
    fontSize: 20,
    fontWeight: '700',
    marginHorizontal: 10,
  },
  timeBlock: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  timeLabel: {
    color: '#a7c9a9',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  timeValue: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
