import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { fetchAllGroupStageMatches } from '@/data/schedule';
import { TEAMS } from '@/data/teams';

const TEAM_GROUP_BY_ID: Record<string, string> = {
  cze: 'A', kor: 'A', mex: 'A', zaf: 'A',
  can: 'B', qat: 'B', sui: 'B', bih: 'B',
  bra: 'C', mar: 'C', sco: 'C', hai: 'C',
  aus: 'D', tur: 'D', usa: 'D', par: 'D',
  civ: 'E', ecu: 'E', ger: 'E', cuw: 'E',
  jpn: 'F', ned: 'F', tun: 'F', swe: 'F',
  bel: 'G', egy: 'G', irn: 'G', nzl: 'G',
  cpv: 'H', sau: 'H', esp: 'H', uru: 'H',
  fra: 'I', irq: 'I', nor: 'I', sen: 'I',
  arg: 'J', aut: 'J', jor: 'J', alg: 'J',
  col: 'K', drc: 'K', por: 'K', uzb: 'K',
  eng: 'L', pan: 'L', cro: 'L', gha: 'L',
};

const GROUP_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'] as const;

function getTeamsForGroup(letter: string) {
  return TEAMS.filter((t) => TEAM_GROUP_BY_ID[t.id] === letter);
}

export default function GroupStatsPage() {
  const { groupLetter } = useLocalSearchParams<{ groupLetter: string }>();
  const [groupMatches, setGroupMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const normalizedGroupLetter = (groupLetter || 'A').toUpperCase();
  const currentGroupIndex = GROUP_LETTERS.indexOf(
    normalizedGroupLetter as (typeof GROUP_LETTERS)[number]
  );

  const goToGroup = (letter: string) => {
    router.push(`/group/${letter}`);
  };

  const goToPrevGroup = () => {
    if (currentGroupIndex < 0) return;
    const prevIndex = (currentGroupIndex - 1 + GROUP_LETTERS.length) % GROUP_LETTERS.length;
    goToGroup(GROUP_LETTERS[prevIndex]);
  };

  const goToNextGroup = () => {
    if (currentGroupIndex < 0) return;
    const nextIndex = (currentGroupIndex + 1) % GROUP_LETTERS.length;
    goToGroup(GROUP_LETTERS[nextIndex]);
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
      <Text style={styles.title}>Gruppe {normalizedGroupLetter}</Text>
      <View style={styles.groupNavRow}>
        <Pressable style={styles.groupNavButton} onPress={goToPrevGroup}>
          <Text style={styles.groupNavButtonText}>‹ Prev</Text>
        </Pressable>
        <Pressable style={styles.groupNavButton} onPress={goToNextGroup}>
          <Text style={styles.groupNavButtonText}>Next ›</Text>
        </Pressable>
      </View>
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
      <Pressable style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backBtnText}>Zurück</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, alignItems: 'center' },
  title: { color: '#a9d7ae', fontSize: 22, fontWeight: '800', marginBottom: 18 },
  groupNavRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  groupNavButton: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2e7d32',
    backgroundColor: '#16311a',
    paddingVertical: 8,
    alignItems: 'center',
  },
  groupNavButtonText: {
    color: '#dff5e1',
    fontSize: 14,
    fontWeight: '700',
  },
  groupLettersWrap: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
    justifyContent: 'center',
  },
  groupLetterChip: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
    fontSize: 14,
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
  backBtn: { marginTop: 18, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8, backgroundColor: '#2e7d32' },
  backBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
