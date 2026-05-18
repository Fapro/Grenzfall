import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Image,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { formatInTimeZone, type TeamMatch } from '@/data/schedule';

import { BACKEND_URL } from '@/config/api';

export default function MatchDetailScreen() {
  const router = useRouter();
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.push('/');
  };
  const params = useLocalSearchParams<{ matchId: string }>();
  const { width: screenWidth } = useWindowDimensions();

  const [match, setMatch] = useState<TeamMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [venueImageFailed, setVenueImageFailed] = useState(false);

  const matchId = params?.matchId;
  const deviceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  useEffect(() => {
    if (!matchId) {
      setError('No match ID provided');
      setLoading(false);
      return;
    }

    // Fetch match details from backend
    const fetchMatch = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`${BACKEND_URL}/api/fixtures/match/${encodeURIComponent(matchId)}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch match: ${response.status}`);
        }
        const data = await response.json();
        setMatch(data.data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load match details');
      } finally {
        setLoading(false);
      }
    };

    void fetchMatch();
  }, [matchId]);

  const formattedDate = useMemo(() => {
    if (!match) return '';
    try {
      return formatInTimeZone(match.kickoffUtc, deviceTimeZone);
    } catch {
      return new Date(match.kickoffUtc).toLocaleString();
    }
  }, [deviceTimeZone, match]);

  const venueFormattedDate = useMemo(() => {
    if (!match) return '';
    try {
      return formatInTimeZone(match.kickoffUtc, match.venue.timeZone);
    } catch {
      return '';
    }
  }, [match]);

  const contentPadding = screenWidth > 1024 ? 32 : screenWidth > 768 ? 20 : 16;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={['#0c1210', '#152218']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
          <View style={[styles.topBar, { paddingHorizontal: contentPadding }]}> 
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.topBarBrandText} numberOfLines={1}>ROOAR WM 2026</Text>
            <TouchableOpacity style={styles.backButton} onPress={() => router.push('/')}>
              <Text style={styles.backButtonText}>Home</Text>
            </TouchableOpacity>
          </View>
          <ActivityIndicator size="large" color="#4caf50" style={{ marginTop: 40 }} />
        </LinearGradient>
      </SafeAreaView>
    );
  }

  if (error || !match) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={['#0c1210', '#152218']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
          <View style={[styles.content, { paddingHorizontal: contentPadding }]}>
            <View style={styles.topBar}>
              <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                <Text style={styles.backButtonText}>← Back</Text>
              </TouchableOpacity>
              <Text style={styles.topBarBrandText} numberOfLines={1}>ROOAR WM 2026</Text>
              <TouchableOpacity style={styles.backButton} onPress={() => router.push('/')}>
                <Text style={styles.backButtonText}>Home</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.errorText}>⚠ {error || 'Match not found'}</Text>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  const isPlayed = new Date(match.kickoffUtc).getTime() <= Date.now();
  const isFuture = new Date(match.kickoffUtc).getTime() > Date.now();

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#0c1210', '#152218']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingHorizontal: contentPadding }]}>
          {/* Header */}
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.topBarBrandText} numberOfLines={1}>ROOAR WM 2026</Text>
            <TouchableOpacity style={styles.backButton} onPress={() => router.push('/')}>
              <Text style={styles.backButtonText}>Home</Text>
            </TouchableOpacity>
          </View>

          {/* Stage Badge */}
          <View style={styles.stageBadge}>
            <Text style={styles.stageBadgeText}>{match.stage}</Text>
          </View>

          <View style={styles.kickoffHighlightCard}>
            <Text style={styles.kickoffHighlightLabel}>🕒 Nächster Anstoß ({deviceTimeZone})</Text>
            <Text style={styles.kickoffHighlightValue}>{formattedDate}</Text>
            {venueFormattedDate ? (
              <Text style={styles.kickoffHighlightVenue}>Stadionzeit ({match.venue.timeZone}): {venueFormattedDate}</Text>
            ) : null}
          </View>

          {/* Match Score Card */}
          <View style={styles.scoreCard}>
            <View style={styles.teamRow}>
              <View style={styles.teamInfo}>
                <Image
                  source={{ uri: match.homeTeam.flag }}
                  style={styles.flagImage}
                  onError={() => setVenueImageFailed(true)}
                />
                <Text style={styles.teamName}>{match.homeTeam.name}</Text>
              </View>
              <Text style={[styles.score, isPlayed ? styles.scorePlayed : null]}>
                {match.homeScore}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.versusText}>
              <Text style={styles.versus}>{isPlayed ? 'Final' : 'vs'}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.teamRow}>
              <Text style={[styles.score, isPlayed ? styles.scorePlayed : null]}>
                {match.awayScore}
              </Text>
              <View style={[styles.teamInfo, styles.teamInfoRight]}>
                <Text style={styles.teamName}>{match.awayTeam.name}</Text>
                <Image
                  source={{ uri: match.awayTeam.flag }}
                  style={styles.flagImage}
                  onError={() => setVenueImageFailed(true)}
                />
              </View>
            </View>
          </View>

          {/* Date & Time */}
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Deine Zeit ({deviceTimeZone})</Text>
            <Text style={styles.infoValue}>{formattedDate}</Text>
            {venueFormattedDate ? (
              <Text style={styles.infoSubValue}>Stadionzeit ({match.venue.timeZone}): {venueFormattedDate}</Text>
            ) : null}
          </View>

          {/* Venue Information */}
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Venue</Text>
            <Text style={styles.infoValue}>{match.venue.name}</Text>
            <Text style={styles.infoSubValue}>{match.venue.city}, {match.venue.country}</Text>
          </View>

          {/* Venue Image */}
          {match.venue.image && !venueImageFailed && (
            <View style={styles.venueImageContainer}>
              <Image
                source={{ uri: match.venue.image }}
                style={styles.venueImage}
                resizeMode="cover"
                onError={() => setVenueImageFailed(true)}
              />
            </View>
          )}

          {/* Round Information */}
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Round</Text>
            <Text style={styles.infoValue}>{match.round}</Text>
          </View>

          {/* Navigation Buttons */}
          <View style={styles.navigationButtons}>
            <TouchableOpacity style={styles.navButton} onPress={handleBack}>
              <Text style={styles.navButtonText}>← Previous Match</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navButton} onPress={() => router.push('/')}>
              <Text style={styles.navButtonText}>View All Matches →</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c1210',
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 20,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  topBarBrandText: {
    flex: 1,
    marginHorizontal: 10,
    color: '#dff5e1',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.8,
  },
  backButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2e7d32',
    backgroundColor: 'rgba(12, 18, 16, 0.5)',
  },
  backButtonText: {
    color: '#4caf50',
    fontSize: 14,
    fontWeight: '600',
  },
  stageBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#2e7d32',
    marginBottom: 20,
  },
  stageBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  kickoffHighlightCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2e7d32',
    backgroundColor: 'rgba(46, 125, 50, 0.16)',
    padding: 14,
    marginBottom: 20,
  },
  kickoffHighlightLabel: {
    color: '#dff5e1',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  kickoffHighlightValue: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  kickoffHighlightVenue: {
    color: '#bfe6c3',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },
  scoreCard: {
    backgroundColor: 'rgba(45, 125, 50, 0.1)',
    borderWidth: 1,
    borderColor: '#2e7d32',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  teamInfoRight: {
    justifyContent: 'flex-end',
    flexDirection: 'row-reverse',
  },
  flagImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  teamName: {
    color: '#a9d7ae',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  score: {
    color: '#7edb86',
    fontSize: 36,
    fontWeight: '900',
    textAlign: 'center',
    minWidth: 60,
  },
  scorePlayed: {
    color: '#4caf50',
  },
  divider: {
    height: 1,
    backgroundColor: '#2e7d32',
    marginVertical: 12,
  },
  versusText: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  versus: {
    color: '#a9d7ae',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  infoCard: {
    backgroundColor: 'rgba(76, 175, 80, 0.05)',
    borderWidth: 1,
    borderColor: '#35543a',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
  },
  infoLabel: {
    color: '#7edb86',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  infoValue: {
    color: '#a9d7ae',
    fontSize: 16,
    fontWeight: '600',
  },
  infoSubValue: {
    color: '#7edb86',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
  },
  venueImageContainer: {
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 24,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderWidth: 1,
    borderColor: '#35543a',
  },
  venueImage: {
    width: '100%',
    height: 240,
  },
  navigationButtons: {
    gap: 12,
    marginTop: 24,
  },
  navButton: {
    backgroundColor: 'rgba(46, 125, 50, 0.2)',
    borderWidth: 1,
    borderColor: '#2e7d32',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  navButtonText: {
    color: '#4caf50',
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 14,
  },
});
