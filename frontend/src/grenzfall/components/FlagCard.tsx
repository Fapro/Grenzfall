import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { Team } from '@/data/teams';

interface FlagCardProps {
  team: Team;
  onPress: (team: Team) => void;
}

export function FlagCard({ team, onPress }: FlagCardProps) {
  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onPress(team);
  };

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.7}>
      <Text style={styles.flag}>{team.flag}</Text>
      <Text style={styles.name} numberOfLines={2}>{team.name}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    margin: 6,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2e2e2e',
  },
  flag: {
    fontSize: 40,
    marginBottom: 6,
  },
  name: {
    color: '#e0e0e0',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 14,
  },
});
