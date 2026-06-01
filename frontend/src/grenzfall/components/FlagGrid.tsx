import React, { useState, useMemo } from 'react';
import {
  TextInput,
  ScrollView,
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { FlagCard } from './FlagCard';
import { TEAMS } from '@/data/teams';
import { GROUP_LETTERS, TEAM_GROUP_BY_ID } from '@/data/groups';
import type { Team } from '@/data/teams';


interface FlagGridProps {
  onSelect: (team: Team, groupLetter?: string) => void;
  onGroupSelect?: (groupLetter: string) => void;
}

export function FlagGrid({ onSelect, onGroupSelect }: FlagGridProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matching = !q
      ? TEAMS
      : TEAMS.filter(
      (t) => t.name.toLowerCase().includes(q) || t.region.toLowerCase().includes(q)
    );

    return [...matching].sort((a, b) => a.name.localeCompare(b.name));
  }, [query]);

  const groupedTeams = useMemo(() => {
    const groups: Array<[string, Team[]]> = GROUP_LETTERS.map((letter) => [letter, []]);
    const indexByLetter = new Map(GROUP_LETTERS.map((letter, index) => [letter, index]));

    for (const team of filtered) {
      const letter = TEAM_GROUP_BY_ID[team.id] ?? 'L';
      const index = indexByLetter.get(letter);
      if (index === undefined) {
        continue;
      }
      groups[index][1].push(team);
    }

    groups.forEach(([, teams]) => teams.sort((a, b) => a.name.localeCompare(b.name)));

    if (!query.trim()) {
      return groups;
    }

    return groups.filter(([, teams]) => teams.length > 0);
  }, [filtered, query]);

  const chunkTeams = (teams: Team[]): Team[][] => {
    const rows: Team[][] = [];
    for (let i = 0; i < teams.length; i += 4) {
      rows.push(teams.slice(i, i + 4));
    }
    return rows;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ROOAR 🏆 World Cup 2026</Text>
      <Text style={styles.subtitle}>Pick your team and hear the roar</Text>
      <TextInput
        style={styles.search}
        placeholder="Search team or region…"
        placeholderTextColor="#555"
        value={query}
        onChangeText={setQuery}
        clearButtonMode="while-editing"
        autoCorrect={false}
      />

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {groupedTeams.map(([letter, teams]) => (
          <View key={letter} style={styles.groupSectionRow}>
            <View style={styles.groupLetterRail}>
              <Text
                style={styles.groupLetter}
                onPress={onGroupSelect ? () => onGroupSelect(letter) : undefined}
              >
                {letter}
              </Text>
            </View>
            <View style={styles.groupTeamsBlock}>
              {chunkTeams(teams).map((rowTeams, rowIndex) => (
                <View key={`${letter}-${rowIndex}`} style={styles.row}>
                  {rowTeams.map((item) => (
                    <View key={item.id} style={styles.cardSlot}>
                      <FlagCard
                        team={item}
                        onPress={(team) => onSelect(team, TEAM_GROUP_BY_ID[team.id] ?? undefined)}
                      />
                    </View>
                  ))}
                  {Array.from({ length: 4 - rowTeams.length }).map((_, spacerIndex) => (
                    <View key={`${letter}-${rowIndex}-spacer-${spacerIndex}`} style={styles.cardSlot} />
                  ))}
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    paddingHorizontal: 8,
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 16,
  },
  subtitle: {
    color: '#888',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
    marginTop: 2,
  },
  search: {
    backgroundColor: '#1a1a1a',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2e2e2e',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  list: {
    paddingBottom: 40,
  },
  groupSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  groupLetterRail: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 0,
  },
  groupLetter: {
    color: '#ffffff',
    fontSize: 56,
    lineHeight: 56,
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
  },
  groupTeamsBlock: {
    flex: 1,
  },
  cardSlot: {
    flex: 1,
  },
});
