import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { FlagCard } from './FlagCard';
import type { Fixture } from '@/data/schedule';

interface NextMatchesProps {
  fixtures: Fixture[];
  selectedTeamId?: string;
  selectedTeamName?: string;
}

const COLORS = {
  deepBg: '#08110a',
  midBg: '#0f1711',
  line: '#29412d',
  lineStrong: '#2e7d32',
  textMain: '#e7f4e8',
  textSoft: '#9cd6a0',
  accent: '#4caf50',
  accentStrong: '#7edb86',
};

export function NextMatches({ fixtures, selectedTeamId, selectedTeamName }: NextMatchesProps) {
  const nextMatches = useMemo(() => {
    if (!Array.isArray(fixtures)) return [];
    
    const nowMs = Date.now();
    const upcoming = fixtures
      .filter((fixture) => {
        if (!fixture.kickoffUtc) return false;
        const kickoffMs = new Date(fixture.kickoffUtc).getTime();
        return !isNaN(kickoffMs) && kickoffMs >= nowMs;
      })
      .sort((a, b) => {
        const aTime = new Date(a.kickoffUtc || '').getTime();
        const bTime = new Date(b.kickoffUtc || '').getTime();
        return aTime - bTime;
      })
      .slice(0, 5);

    return upcoming;
  }, [fixtures]);

  const formatDate = (isoDate?: string): string => {
    if (!isoDate) return 'Time TBD';
    try {
      const date = new Date(isoDate);
      if (isNaN(date.getTime())) return 'Time TBD';
      
      const options: Intl.DateTimeFormatOptions = {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      };
      return date.toLocaleString('de-DE', options);
    } catch {
      return 'Time TBD';
    }
  };

  if (nextMatches.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>Keine anstehenden Spiele vorhanden.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} scrollEnabled={false}>
      {nextMatches.map((fixture, idx) => (
        <View key={`match-${fixture.id || idx}`} style={styles.matchCard}>
          <Text style={styles.matchDate}>{formatDate(fixture.kickoffUtc)}</Text>
          
          <View style={styles.teamRow}>
            <View style={styles.team}>
              <Text style={styles.teamName} numberOfLines={1}>
                {fixture.homeTeam?.name || 'TBD'}
              </Text>
            </View>
            
            <Text style={styles.separator}>vs</Text>
            
            <View style={styles.team}>
              <Text style={styles.teamName} numberOfLines={1}>
                {fixture.awayTeam?.name || 'TBD'}
              </Text>
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  matchCard: {
    borderWidth: 1,
    borderColor: COLORS.lineStrong,
    borderRadius: 8,
    backgroundColor: `rgba(76, 175, 80, 0.1)`,
    padding: 12,
    marginBottom: 10,
  },
  matchDate: {
    fontSize: 11,
    color: COLORS.accentStrong,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
    marginBottom: 8,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  team: {
    flex: 1,
    paddingHorizontal: 8,
  },
  teamName: {
    fontSize: 13,
    color: COLORS.textMain,
    fontWeight: '600',
  },
  separator: {
    fontSize: 11,
    color: '#7ea083',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginHorizontal: 6,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textSoft,
    textAlign: 'center',
    paddingVertical: 16,
  },
});
