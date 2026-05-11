import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { FlagGrid } from '@/components/FlagGrid';
import type { Team } from '@/data/teams';

export default function HomeScreen() {
  const router = useRouter();

  const handleSelect = (team: Team, groupLetter?: string) => {
    if (groupLetter) {
      router.push({ pathname: `/${team.id}`, params: { group: groupLetter } });
      return;
    }
    router.push(`/${team.id}`);
  };

  const handleGroupSelect = (groupLetter: string) => {
    router.push(`/group/${groupLetter}`);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <FlagGrid onSelect={handleSelect} onGroupSelect={handleGroupSelect} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
});
