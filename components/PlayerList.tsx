import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Player } from '@/data/players';

interface PlayerListProps {
  players: Player[];
  isLoading?: boolean;
  error?: string | null;
}

const POSITION_COLORS: Record<string, string> = {
  'Goalkeeper': '#ff6b6b',
  'Defender': '#4ecdc4',
  'Midfielder': '#45b7d1',
  'Forward': '#f9ca24',
  'Attacker': '#f9ca24',
};

function getPositionColor(position: string): string {
  return POSITION_COLORS[position] || '#b3e5b3';
}

function getPositionShort(position: string): string {
  const map: Record<string, string> = {
    'Goalkeeper': 'GK',
    'Defender': 'DEF',
    'Midfielder': 'MID',
    'Forward': 'FWD',
    'Attacker': 'ATK',
  };
  return map[position] || position.slice(0, 3).toUpperCase();
}

export function PlayerList({ players, isLoading = false, error }: PlayerListProps) {
  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Squad</Text>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#4caf50" size="small" />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Squad</Text>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>⚠ {error}</Text>
        </View>
      </View>
    );
  }

  if (players.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Squad</Text>
        <Text style={styles.emptyText}>No players available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Squad ({players.length} players)</Text>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
      >
        {players.map((player) => (
          <View key={player.id} style={styles.playerRow}>
            <View style={[styles.numberBadge, { backgroundColor: getPositionColor(player.position) }]}>
              <Text style={styles.numberText}>{player.number}</Text>
            </View>

            <View style={styles.playerInfo}>
              <Text style={styles.playerName}>{player.name}</Text>
              <View style={styles.playerMeta}>
                <Text style={[styles.positionBadge, { color: getPositionColor(player.position) }]}>
                  {getPositionShort(player.position)}
                </Text>
                {player.age && (
                  <Text style={styles.playerAge}>{player.age}y</Text>
                )}
                {player.club && (
                  <Text style={styles.playerClub}>{player.club}</Text>
                )}
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
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
    maxHeight: 500,
  },
  title: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  scrollView: {
    flex: 1,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomColor: '#2b3a2c',
    borderBottomWidth: 1,
  },
  numberBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  numberText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  playerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  positionBadge: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  playerAge: {
    color: '#b3e5b3',
    fontSize: 11,
    fontWeight: '600',
  },
  playerClub: {
    color: '#9cd6a0',
    fontSize: 10,
    fontWeight: '500',
    maxWidth: 100,
  },
  loadingContainer: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    height: 60,
    justifyContent: 'center',
    backgroundColor: '#2e0a0a',
    borderRadius: 8,
    padding: 10,
    borderColor: '#7d2e2e',
    borderWidth: 1,
  },
  errorText: {
    color: '#ff8a8a',
    fontSize: 12,
  },
  emptyText: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 20,
  },
});
