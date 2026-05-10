import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StadiumAnimation } from '@/components/StadiumAnimation';
import { useRoar } from '@/hooks/useRoar';
import { TEAMS } from '@/data/teams';
import { fetchTeamSchedule, formatInTimeZone, type TeamMatch } from '@/data/schedule';

const { width } = Dimensions.get('window');

export default function TeamScreen() {
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const router = useRouter();
  const { play, isPlaying } = useRoar();

  const team = TEAMS.find((t) => t.id === teamId);
  const deviceTimeZone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  const [schedule, setSchedule] = useState<TeamMatch[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const loadSchedule = useCallback(async () => {
    if (!team) {
      setSchedule([]);
      return;
    }

    setScheduleLoading(true);
    setScheduleError(null);
    try {
      const fixtures = await fetchTeamSchedule(team.id);
      setSchedule(fixtures);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load schedule';
      setScheduleError(message);
    } finally {
      setScheduleLoading(false);
    }
  }, [team]);

  const handleRoarPress = useCallback(() => {
    play();
    void loadSchedule();
  }, [play, loadSchedule]);

  useEffect(() => {
    if (!team) {
      return;
    }

    play();
    void loadSchedule();
  }, [team, play, loadSchedule]);

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
            return (
              <View key={match.id} style={styles.matchCard}>
                <View style={styles.matchTopRow}>
                  <Text style={styles.stage}>
                    {match.stage}{match.round ? ` · ${match.round}` : ''}
                  </Text>
                  <Text style={styles.versus}>
                    {match.homeTeam.name} vs {match.awayTeam.name}
                  </Text>
                </View>

                <Text style={styles.venueLine}>
                  {match.venue.name}, {match.venue.city}, {match.venue.country}
                </Text>

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

          <View style={styles.hero}>
            <StadiumAnimation isPlaying={isPlaying} />

            <View style={styles.flagContainer}>
              <Text style={styles.flag}>{team.flag}</Text>
            </View>

            <Text style={styles.teamName}>{team.name}</Text>
            <Text style={styles.region}>{team.region}</Text>

            <TouchableOpacity
              style={[styles.roarButton, isPlaying && styles.roarButtonActive]}
              onPress={handleRoarPress}
              disabled={isPlaying}
              activeOpacity={0.8}
            >
              <Text style={styles.roarButtonText}>
                {isPlaying ? '📣 ROARING...' : '📣 ROAR AGAIN'}
              </Text>
            </TouchableOpacity>
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
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 4,
  },
  flagContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flag: {
    fontSize: Math.min(width * 0.28, 120),
  },
  teamName: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: width * 0.38,
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
  roarButton: {
    backgroundColor: '#1e5c1e',
    paddingHorizontal: 36,
    paddingVertical: 16,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#4caf50',
  },
  roarButtonActive: {
    backgroundColor: '#0a2e0a',
    borderColor: '#2e7d32',
  },
  roarButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 1,
  },
  scheduleHeaderCard: {
    marginTop: 22,
    marginHorizontal: 18,
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
    marginHorizontal: 18,
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
    marginHorizontal: 18,
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
  },
  venueLine: {
    color: '#afafaf',
    fontSize: 13,
    marginBottom: 10,
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
