import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { fetchAllGroupStageMatches } from '@/data/schedule';
import { GROUP_LETTERS, TEAM_GROUP_BY_ID } from '@/data/groups';
import { TEAMS } from '@/data/teams';

function getTeamsForGroup(letter: string) {
  return TEAMS.filter((t) => TEAM_GROUP_BY_ID[t.id] === letter);
}

export default function GroupStatsPage() {
  const { groupLetter } = useLocalSearchParams<{ groupLetter: string }>();
  const [groupMatches, setGroupMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.push('/');
  };
  const normalizedGroupLetter = (groupLetter || 'A').toUpperCase();
  const currentGroupIndex = GROUP_LETTERS.indexOf(
    normalizedGroupLetter as (typeof GROUP_LETTERS)[number]
  );

  const goToGroup = (letter: string) => {
    router.push(`/group/${letter}`);
  };

  useEffect(() => {
    fetchAllGroupStageMatches().then((matches) => {
      setGroupMatches(matches.filter((m) => {
        const letter = (m.stage.match(/([A-L])/i) || [])[1];
        return letter && letter.toUpperCase() === groupLetter?.toUpperCase();
      }));
      setLoading(false);
    });
  }, [groupLetter]);

  const teams = getTeamsForGroup(normalizedGroupLetter);

  // Build standings
  const table = React.useMemo(() => {
    const rows = new Map();
    for (const t of teams) {
      rows.set(t.id, {
        id: t.id,
        name: t.name,
        played: 0,
        won: 0,
        draw: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDiff: 0,
        points: 0,
      });
    }
    for (const match of groupMatches) {
      const home = rows.get(match.homeTeam.id);
      const away = rows.get(match.awayTeam.id);
      if (!home || !away) continue;
      home.played += 1;
      away.played += 1;
      home.goalsFor += match.homeScore;
      home.goalsAgainst += match.awayScore;
      away.goalsFor += match.awayScore;
      away.goalsAgainst += match.homeScore;
      if (match.homeScore > match.awayScore) {
        home.won += 1; home.points += 3; away.lost += 1;
      } else if (match.homeScore < match.awayScore) {
        away.won += 1; away.points += 3; home.lost += 1;
      } else {
        home.draw += 1; away.draw += 1; home.points += 1; away.points += 1;
      }
    }
    return Array.from(rows.values()).map((row, i) => ({ ...row, goalDiff: row.goalsFor - row.goalsAgainst })).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return a.name.localeCompare(b.name);
    });
  }, [groupMatches, teams]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.navButton} onPress={handleBack}>
          <Text style={styles.navButtonText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.topBarBrandText} numberOfLines={1}>ROOAR WM 2026</Text>
        <TouchableOpacity style={styles.navButton} onPress={() => router.push('/')}>
          <Text style={styles.navButtonText}>Home</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.groupNavBar}>
        <View style={styles.groupLettersWrap}>
        {GROUP_LETTERS.map((letter) => {
          const isActive = letter === normalizedGroupLetter;
          return (
            <Pressable
              key={letter}
              style={[styles.groupLetterChip, isActive ? styles.groupLetterChipActive : null]}
              onPress={() => goToGroup(letter)}
            >
              <Text style={[styles.groupLetterChipText, isActive ? styles.groupLetterChipTextActive : null]}>
                {letter}
              </Text>
            </Pressable>
          );
        })}
        </View>
      </View>
      <Text style={styles.title}>Group {normalizedGroupLetter}</Text>
      {loading ? <ActivityIndicator /> : (
        <View style={styles.tableCard}>
          <View style={styles.tableHeaderRow}>
            <Text style={styles.cell}>Rang</Text>
            <Text style={[styles.cell, styles.teamCol]}>Mannschaft</Text>
            <Text style={styles.cell}>Sp</Text>
            <Text style={styles.cell}>S</Text>
            <Text style={styles.cell}>U</Text>
            <Text style={styles.cell}>N</Text>
            <Text style={styles.cell}>T</Text>
            <Text style={styles.cell}>GT</Text>
            <Text style={styles.cell}>TD</Text>
            <Text style={styles.cell}>Pkte</Text>
          </View>
          {table.map((row, idx) => (
            <View key={row.id} style={styles.tableDataRow}>
              <Text style={styles.cell}>{idx + 1}</Text>
              <Text style={[styles.cell, styles.teamCol]}>{row.name}</Text>
              <Text style={styles.cell}>{row.played}</Text>
              <Text style={styles.cell}>{row.won}</Text>
              <Text style={styles.cell}>{row.draw}</Text>
              <Text style={styles.cell}>{row.lost}</Text>
              <Text style={styles.cell}>{row.goalsFor}</Text>
              <Text style={styles.cell}>{row.goalsAgainst}</Text>
              <Text style={styles.cell}>{row.goalDiff}</Text>
              <Text style={styles.cell}>{row.points}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    marginBottom: 8,
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
    color: '#4caf50',
    fontSize: 14,
    fontWeight: '600',
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
  title: { color: '#a9d7ae', fontSize: 18, fontWeight: '800', marginBottom: 14 },
  groupNavBar: {
    width: '100%',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2e7d32',
    backgroundColor: '#132317',
    paddingVertical: 8,
    paddingHorizontal: 6,
    marginBottom: 10,
  },
  groupLettersWrap: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
  },
  groupLetterChip: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#35543a',
    backgroundColor: '#152218',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupLetterChipActive: {
    borderColor: '#7edb86',
    backgroundColor: '#24552b',
  },
  groupLetterChipText: {
    color: '#c6dfc8',
    fontSize: 11,
    fontWeight: '700',
  },
  groupLetterChipTextActive: {
    color: '#ffffff',
  },
  tableCard: { width: '100%', borderRadius: 12, backgroundColor: '#101c12', borderWidth: 1, borderColor: '#2b3a2c', marginBottom: 18 },
  tableHeaderRow: { flexDirection: 'row', padding: 8, borderBottomWidth: 1, borderBottomColor: '#2b3a2c', backgroundColor: '#1a2a1a' },
  tableDataRow: { flexDirection: 'row', padding: 8, borderBottomWidth: 1, borderBottomColor: '#1a2a1a' },
  cell: { flex: 1, color: '#eaf8ec', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  teamCol: { flex: 2, textAlign: 'left' },
});
