import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { FlagGrid } from '@/components/FlagGrid';
import type { Team } from '@/data/teams';

export default function HomeScreen() {
  const router = useRouter();

  const handleSelect = (team: Team) => {
    router.push(`/${team.id}`);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <FlagGrid onSelect={handleSelect} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
});
