import React, { useState, useMemo } from 'react';
import {
  FlatList,
  TextInput,
  View,
  Text,
  StyleSheet,
  ListRenderItemInfo,
} from 'react-native';
import { FlagCard } from './FlagCard';
import { TEAMS } from '@/data/teams';
import type { Team } from '@/data/teams';

interface FlagGridProps {
  onSelect: (team: Team) => void;
}

export function FlagGrid({ onSelect }: FlagGridProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TEAMS;
    return TEAMS.filter(
      (t) => t.name.toLowerCase().includes(q) || t.region.toLowerCase().includes(q)
    );
  }, [query]);

  const renderItem = ({ item }: ListRenderItemInfo<Team>) => (
    <FlagCard team={item} onPress={onSelect} />
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🏆 World Cup 2026</Text>
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
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        numColumns={4}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
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
    justifyContent: 'flex-start',
  },
  list: {
    paddingBottom: 40,
  },
});
