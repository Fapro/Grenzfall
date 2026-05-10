import React from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';

const STAGES = [
  { label: 'Group\nStage', teams: '48 teams\n12 groups' },
  { label: 'Round of 16', teams: '16 teams' },
  { label: 'Quarter-\nfinals', teams: '8 teams' },
  { label: 'Semi-\nfinals', teams: '4 teams' },
  { label: 'Final', teams: '2 teams' },
];

export function TournamentStages() {
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 600;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>FIFA World Cup 2026</Text>
      <Text style={styles.subtitle}>Tournament Structure</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.stagesRow}>
          {STAGES.map((stage, index) => (
            <View key={index} style={styles.stageWrapper}>
              <View style={styles.stageBox}>
                <Text style={styles.stageLabel}>{stage.label}</Text>
                <Text style={styles.stageTeams}>{stage.teams}</Text>
              </View>

              {index < STAGES.length - 1 && (
                <View style={styles.arrowContainer}>
                  <Text style={styles.arrow}>→</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.legendContainer}>
        <Text style={styles.legendTitle}>2026 Format:</Text>
        <Text style={styles.legendText}>🏟 16 stadiums across USA, Canada, and Mexico</Text>
        <Text style={styles.legendText}>📅 June - July 2026</Text>
        <Text style={styles.legendText}>🎯 80 total matches</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(20, 35, 20, 0.9)',
    borderRadius: 12,
    padding: 14,
    borderColor: '#2e7d32',
    borderWidth: 1,
    marginVertical: 12,
  },
  title: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  subtitle: {
    color: '#9cd6a0',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  scrollContent: {
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  stagesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stageWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stageBox: {
    backgroundColor: 'rgba(10, 10, 10, 0.8)',
    borderRadius: 8,
    padding: 10,
    borderColor: '#4caf50',
    borderWidth: 1.5,
    minWidth: 85,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageLabel: {
    color: '#4caf50',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 14,
  },
  stageTeams: {
    color: '#b3e5b3',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 13,
  },
  arrowContainer: {
    marginHorizontal: 2,
  },
  arrow: {
    color: '#4caf50',
    fontSize: 18,
    fontWeight: '600',
  },
  legendContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopColor: '#2b3a2c',
    borderTopWidth: 1,
  },
  legendTitle: {
    color: '#9cd6a0',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  legendText: {
    color: '#b3e5b3',
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
    lineHeight: 16,
  },
});
