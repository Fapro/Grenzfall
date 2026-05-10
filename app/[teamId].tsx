import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
  TextInput,
  Platform,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StadiumAnimation } from '@/components/StadiumAnimation';
import { TournamentStages } from '@/components/TournamentStages';
import { PlayerList } from '@/components/PlayerList';
import { useRoar } from '@/hooks/useRoar';
import { TEAMS } from '@/data/teams';
import {
  fetchTeamSchedule,
  formatInTimeZone,
  fetchAllGroupStageMatches,
  type TeamMatch,
} from '@/data/schedule';
import { fetchTeamPlayers, type Player } from '@/data/players';

type GroupMemberMatches = {
  id: string;
  name: string;
  flag: string;
  matches: Array<{
    id: string;
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
  }>;
};

type GroupTableRow = {
  id: string;
  name: string;
  rank?: number;
  played: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
};

type GroupStageGroupData = {
  teams: string[];
  results: string[];
};

type LiveFeedEvent = {
  id: string;
  timestamp: number;
  text: string;
  scoreLine: string;
  stage: string;
};

function toFormationLabel(player: Player): string {
  const shortName = player.name.trim().split(' ').slice(-1)[0] ?? player.name;
  if (Number.isFinite(player.number) && player.number > 0) {
    return `${player.number} ${shortName}`;
  }
  return shortName;
}

function isDefender(position: string): boolean {
  return /def|back/i.test(position);
}

function isMidfielder(position: string): boolean {
  return /mid/i.test(position);
}

function isForward(position: string): boolean {
  return /forw|att|strik|wing/i.test(position);
}

function pickUniquePlayers(pool: Player[], usedIds: Set<string>, count: number): Player[] {
  const picked: Player[] = [];
  for (const player of pool) {
    if (picked.length >= count) break;
    if (usedIds.has(player.id)) continue;
    usedIds.add(player.id);
    picked.push(player);
  }
  return picked;
}

function extractGroupLetterFromText(value: string): string | null {
  const letterMatch = value.match(/group\s*([a-l])/i);
  if (letterMatch?.[1]) {
    return letterMatch[1].toUpperCase();
  }

  const numberMatch = value.match(/group\s*(\d{1,2})/i);
  const groupNum = Number(numberMatch?.[1] ?? NaN);
  if (Number.isFinite(groupNum) && groupNum >= 1 && groupNum <= 12) {
    return String.fromCharCode(64 + groupNum);
  }

  return null;
}

function normalizeTeamName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function fallbackGroupLetterFromNames(teamNames: string[]): string {
  const key = teamNames
    .map((name) => normalizeTeamName(name))
    .sort()
    .join('|');

  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }

  return String.fromCharCode(65 + (hash % 12));
}

export default function TeamScreen() {
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const router = useRouter();
  const { play, isPlaying } = useRoar();
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= 1100;
  const isUltraWideWeb = Platform.OS === 'web' && width >= 1600;
  const contentHorizontalPadding = width >= 1700 ? 36 : width >= 1300 ? 24 : 16;

  const flagSize = Math.min(width * 0.26, 112);
  const formationTopOffset = flagSize + 4;

  const team = TEAMS.find((t) => t.id === teamId);
  const deviceTimeZone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  const [schedule, setSchedule] = useState<TeamMatch[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [groupStageMatches, setGroupStageMatches] = useState<TeamMatch[]>([]);
  const [groupStageLoading, setGroupStageLoading] = useState(false);
  const scoreByFixtureRef = useRef<Record<string, { home: number; away: number }>>({});
  const [liveFeedEvents, setLiveFeedEvents] = useState<LiveFeedEvent[]>([]);
  const [tipsByMatch, setTipsByMatch] = useState<
    Record<string, { home: string; away: string }>
  >({});

  const [players, setPlayers] = useState<Player[]>([]);
  const [trainerName, setTrainerName] = useState<string | null>(null);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [playersError, setPlayersError] = useState<string | null>(null);
  const [venueImageFailedByMatch, setVenueImageFailedByMatch] = useState<
    Record<string, boolean>
  >({});
  const tickerTranslateX = useRef(new Animated.Value(0)).current;
  const tickerAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const [tickerViewportWidth, setTickerViewportWidth] = useState(0);
  const [tickerContentWidth, setTickerContentWidth] = useState(0);

  const formationData = useMemo(() => {
    const fallback = {
      shape: '4-3-3',
      rows: [
        ['GK'],
        ['LB', 'CB', 'CB', 'RB'],
        ['CM', 'CM', 'CM'],
        ['LW', 'CF', 'RW'],
      ],
      fromPlayers: false,
    };

    if (players.length === 0) {
      return fallback;
    }

    const goalkeepers = players.filter((p) => /goal|keeper/i.test(p.position));
    const defenders = players.filter((p) => isDefender(p.position));
    const midfielders = players.filter((p) => isMidfielder(p.position));
    const forwards = players.filter((p) => isForward(p.position));

    const usedIds = new Set<string>();
    const gkPlayers = pickUniquePlayers(goalkeepers, usedIds, 1);
    const defPlayers = pickUniquePlayers(defenders, usedIds, 4);
    const midPlayers = pickUniquePlayers(midfielders, usedIds, 3);
    const fwdPlayers = pickUniquePlayers(forwards, usedIds, 3);

    const remaining = players.filter((p) => !usedIds.has(p.id));
    const fillLine = (line: Player[], desiredCount: number): Player[] => {
      const filled = [...line];
      while (filled.length < desiredCount && remaining.length > 0) {
        const next = remaining.shift();
        if (!next) break;
        usedIds.add(next.id);
        filled.push(next);
      }
      return filled;
    };

    const gkLine = gkPlayers.length > 0 ? gkPlayers : [];
    const defLine = fillLine(defPlayers, 4);
    const midLine = fillLine(midPlayers, 3);
    const fwdLine = fillLine(fwdPlayers, 3);

    const defCount = Math.max(1, defLine.length);
    const midCount = Math.max(1, midLine.length);
    const fwdCount = Math.max(1, fwdLine.length);

    return {
      shape: `${defCount}-${midCount}-${fwdCount}`,
      rows: [
        gkLine.length > 0 ? gkLine.map(toFormationLabel) : ['GK'],
        defLine.length > 0 ? defLine.map(toFormationLabel) : ['LB', 'CB', 'CB', 'RB'],
        midLine.length > 0 ? midLine.map(toFormationLabel) : ['CM', 'CM', 'CM'],
        fwdLine.length > 0 ? fwdLine.map(toFormationLabel) : ['LW', 'CF', 'RW'],
      ],
      fromPlayers: true,
    };
  }, [players]);

  const teamIdByNormalizedName = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of TEAMS) {
      map.set(normalizeTeamName(t.name), t.id);
    }
    return map;
  }, []);

  const selectedGroupMatches = useMemo<TeamMatch[]>(() => {
    if (!team) {
      return [];
    }

    const teamScheduleGroupMatches = schedule.filter((m) => {
      const isGroupStage = m.stage.toLowerCase().includes('group');
      const isYear2026 = new Date(m.kickoffUtc).getFullYear() === 2026;
      return isGroupStage && isYear2026;
    });

    // Fallback when shared group endpoint is unavailable.
    if (groupStageMatches.length === 0) {
      return teamScheduleGroupMatches;
    }

    const groupTeamIds = new Set<string>();
    for (const match of teamScheduleGroupMatches) {
      groupTeamIds.add(match.homeTeam.id);
      groupTeamIds.add(match.awayTeam.id);
    }

    if (groupTeamIds.size < 2) {
      return teamScheduleGroupMatches;
    }

    return groupStageMatches.filter(
      (m) => groupTeamIds.has(m.homeTeam.id) && groupTeamIds.has(m.awayTeam.id)
    );
  }, [groupStageMatches, schedule, team]);

  const groupMembers = useMemo<GroupMemberMatches[]>(() => {
    if (!team || selectedGroupMatches.length === 0) {
      return [];
    }

    const byOpponent = new Map<string, GroupMemberMatches>();

    for (const match of selectedGroupMatches) {
      const participants = [match.homeTeam, match.awayTeam];
      for (const participant of participants) {
        if (!participant?.id || participant.name === team.name) {
          continue;
        }

        const existing = byOpponent.get(participant.id) ?? {
          id: participant.id,
          name: participant.name,
          flag: participant.flag,
          matches: [],
        };

        existing.matches.push({
          id: match.id,
          homeTeam: match.homeTeam.name,
          awayTeam: match.awayTeam.name,
          homeScore: match.homeScore,
          awayScore: match.awayScore,
        });
        byOpponent.set(participant.id, existing);
      }
    }

    return Array.from(byOpponent.values()).slice(0, 4);
  }, [selectedGroupMatches, team]);

  const groupLetter = useMemo(() => {
    for (const match of selectedGroupMatches) {
      const fromStage = extractGroupLetterFromText(match.stage);
      if (fromStage) {
        return fromStage;
      }
      const fromRound = extractGroupLetterFromText(match.round);
      if (fromRound) {
        return fromRound;
      }
    }

    const inferredGroupTeams = groupMembers.map((m) => m.name);
    if (team) {
      inferredGroupTeams.unshift(team.name);
    }
    if (inferredGroupTeams.length >= 2) {
      return fallbackGroupLetterFromNames(inferredGroupTeams);
    }

    return '';
  }, [groupMembers, selectedGroupMatches, team]);

  const withGroupLetter = useCallback(
    (teamName: string) =>
      groupLetter ? `${teamName} (Group ${groupLetter})` : teamName,
    [groupLetter]
  );

  const groupStageLinePrefix = useCallback(
    (match: TeamMatch) =>
      match.stage.toLowerCase().includes('group') && groupLetter
        ? `Group ${groupLetter} · `
        : '',
    [groupLetter]
  );

  const formatTeamForMatch = useCallback(
    (match: TeamMatch, teamName: string) =>
      teamName,
    []
  );

  const groupTable = useMemo<GroupTableRow[]>(() => {
    if (!team || selectedGroupMatches.length === 0) {
      return [];
    }

    const rows = new Map<string, GroupTableRow>();

    function ensureRow(teamIdValue: string, teamName: string): GroupTableRow {
      const existing = rows.get(teamIdValue);
      if (existing) {
        return existing;
      }
      const next: GroupTableRow = {
        id: teamIdValue,
        name: teamName,
        played: 0,
        won: 0,
        draw: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDiff: 0,
        points: 0,
      };
      rows.set(teamIdValue, next);
      return next;
    }

    const now = Date.now();
    for (const match of selectedGroupMatches) {
      const home = ensureRow(match.homeTeam.id, match.homeTeam.name);
      const away = ensureRow(match.awayTeam.id, match.awayTeam.name);

      const isPlayed = new Date(match.kickoffUtc).getTime() <= now;
      if (!isPlayed) {
        continue;
      }

      home.played += 1;
      away.played += 1;

      home.goalsFor += match.homeScore;
      home.goalsAgainst += match.awayScore;
      away.goalsFor += match.awayScore;
      away.goalsAgainst += match.homeScore;

      if (match.homeScore > match.awayScore) {
        home.won += 1;
        home.points += 3;
        away.lost += 1;
      } else if (match.homeScore < match.awayScore) {
        away.won += 1;
        away.points += 3;
        home.lost += 1;
      } else {
        home.draw += 1;
        away.draw += 1;
        home.points += 1;
        away.points += 1;
      }
    }

    const table = Array.from(rows.values()).map((row) => ({
      ...row,
      goalDiff: row.goalsFor - row.goalsAgainst,
    }));

    const sorted = table.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return a.name.localeCompare(b.name);
    });

    return sorted.map((row, index) => ({
      ...row,
      rank: index + 1,
    }));
  }, [selectedGroupMatches, team]);

  const selectedTeamStanding = useMemo(
    () => groupTable.find((row) => row.name === team?.name) ?? null,
    [groupTable, team]
  );

  const tickerItems = useMemo(() => {
    const liveItems = liveFeedEvents.slice(0, 10).map(
      (event) =>
        `[LIVE] ${new Date(event.timestamp).toLocaleTimeString()} | ${event.text} | ${event.scoreLine}`
    );

    const newsItems: string[] = [];
    if (team) {
      newsItems.push(`[TEAM] ${team.name} national team updates`);
    }

    if (trainerName) {
      newsItems.push(`[TRAINER] ${trainerName}`);
    }

    if (selectedTeamStanding) {
      newsItems.push(
        `[TABLE] Position #${selectedTeamStanding.rank} with ${selectedTeamStanding.points} pts (GD ${selectedTeamStanding.goalDiff})`
      );
    }

    if (groupLetter) {
      newsItems.push(`[GROUP] Competing in Group ${groupLetter}`);
    }

    const now = Date.now();
    const upcomingMatch = schedule
      .filter((match) => new Date(match.kickoffUtc).getTime() > now)
      .sort(
        (a, b) =>
          new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime()
      )[0];
    if (upcomingMatch) {
      newsItems.push(
        `[NEXT] ${upcomingMatch.homeTeam.name} vs ${upcomingMatch.awayTeam.name} (${new Date(upcomingMatch.kickoffUtc).toLocaleString()})`
      );
    }

    const recentPlayedMatch = schedule
      .filter((match) => new Date(match.kickoffUtc).getTime() <= now)
      .sort(
        (a, b) =>
          new Date(b.kickoffUtc).getTime() - new Date(a.kickoffUtc).getTime()
      )[0];
    if (recentPlayedMatch) {
      newsItems.push(
        `[RESULT] ${recentPlayedMatch.homeTeam.name} ${recentPlayedMatch.homeScore}-${recentPlayedMatch.awayScore} ${recentPlayedMatch.awayTeam.name}`
      );
    }

    if (players.length > 0) {
      newsItems.push(`[SQUAD] ${players.length} players loaded`);
    } else if (playersError) {
      newsItems.push('[ALERT] Squad service temporarily unavailable');
    }

    return [...liveItems, ...newsItems].slice(0, 16);
  }, [groupLetter, liveFeedEvents, players.length, playersError, schedule, selectedTeamStanding, team, trainerName]);

  const tickerText = useMemo(() => {
    if (tickerItems.length === 0) {
      return '[INFO] Waiting for live updates...';
    }

    return tickerItems.join('   •   ');
  }, [tickerItems]);

  const groupStageDiagramData = useMemo(() => {
    const uniqueResults = new Map<string, string>();
    for (const match of selectedGroupMatches) {
      uniqueResults.set(
        match.id,
        `${match.homeTeam.name} ${match.homeScore} - ${match.awayScore} ${match.awayTeam.name}`
      );
    }

    const letters = Array.from({ length: 12 }, (_, index) =>
      String.fromCharCode(65 + index)
    );
    const baseGroups: Record<string, GroupStageGroupData> = {};
    letters.forEach((letter, index) => {
      const start = index * 4;
      const teams = TEAMS.slice(start, start + 4).map((entry) => entry.name);
      baseGroups[letter] = {
        teams,
        results: ['Results pending'],
      };
    });

    if (groupLetter && baseGroups[groupLetter]) {
      baseGroups[groupLetter] = {
        teams: groupTable.map((row) => row.name),
        results: Array.from(uniqueResults.values()),
      };
    }

    return {
      groupLetter,
      teams: groupTable.map((row) => row.name),
      results: Array.from(uniqueResults.values()),
      groups: baseGroups,
    };
  }, [groupLetter, groupTable, selectedGroupMatches]);

  const openTeamFromName = useCallback(
    (teamName: string) => {
      const nextTeamId = teamIdByNormalizedName.get(normalizeTeamName(teamName));
      if (!nextTeamId || nextTeamId === team?.id) {
        return;
      }
      router.push(`/${nextTeamId}`);
    },
    [router, team?.id, teamIdByNormalizedName]
  );

  const setTipValue = useCallback(
    (matchId: string, side: 'home' | 'away', value: string) => {
      const cleaned = value.replace(/[^0-9]/g, '').slice(0, 2);
      setTipsByMatch((prev) => ({
        ...prev,
        [matchId]: {
          home: prev[matchId]?.home ?? '',
          away: prev[matchId]?.away ?? '',
          [side]: cleaned,
        },
      }));
    },
    []
  );

  const loadSchedule = useCallback(async (options?: {
    showLoader?: boolean;
    detectGoals?: boolean;
  }) => {
    const showLoader = options?.showLoader ?? true;
    const detectGoals = options?.detectGoals ?? false;

    if (!team) {
      setSchedule([]);
      return;
    }

    if (showLoader) {
      setScheduleLoading(true);
    }
    setScheduleError(null);
    try {
      const fixtures = await fetchTeamSchedule(team.id);
      if (detectGoals) {
        const nextFeedEvents: LiveFeedEvent[] = [];
        const goalDetected = fixtures.some((fixture) => {
          const prevScore = scoreByFixtureRef.current[fixture.id];
          if (!prevScore) {
            return false;
          }

          const homeDelta = fixture.homeScore - prevScore.home;
          const awayDelta = fixture.awayScore - prevScore.away;
          const scoreLine = `${fixture.homeTeam.name} ${fixture.homeScore}-${fixture.awayScore} ${fixture.awayTeam.name}`;

          if (homeDelta > 0) {
            nextFeedEvents.push({
              id: `${fixture.id}-home-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              timestamp: Date.now(),
              text: `Goal for ${fixture.homeTeam.name}${homeDelta > 1 ? ` (+${homeDelta})` : ''}`,
              scoreLine,
              stage: fixture.stage,
            });
          }

          if (awayDelta > 0) {
            nextFeedEvents.push({
              id: `${fixture.id}-away-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              timestamp: Date.now(),
              text: `Goal for ${fixture.awayTeam.name}${awayDelta > 1 ? ` (+${awayDelta})` : ''}`,
              scoreLine,
              stage: fixture.stage,
            });
          }

          return homeDelta > 0 || awayDelta > 0;
        });

        if (nextFeedEvents.length > 0) {
          setLiveFeedEvents((prev) => [...nextFeedEvents, ...prev].slice(0, 12));
        }

        if (goalDetected) {
          play();
        }
      }

      scoreByFixtureRef.current = fixtures.reduce<
        Record<string, { home: number; away: number }>
      >(
        (acc, fixture) => {
          acc[fixture.id] = {
            home: fixture.homeScore,
            away: fixture.awayScore,
          };
          return acc;
        },
        {}
      );
      setSchedule(fixtures);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load schedule';
      setScheduleError(message);
    } finally {
      if (showLoader) {
        setScheduleLoading(false);
      }
    }
  }, [team, play]);

  const loadPlayers = useCallback(async () => {
    if (!team) {
      setPlayers([]);
      setTrainerName(null);
      return;
    }

    setPlayersLoading(true);
    setPlayersError(null);
    try {
      const payload = await fetchTeamPlayers(team.id);
      setPlayers(payload.players);
      setTrainerName(payload.trainer);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load players';
      setPlayersError(message);
      setPlayers([]);
      setTrainerName(null);
    } finally {
      setPlayersLoading(false);
    }
  }, [team]);


  useEffect(() => {
    if (!team) {
      return;
    }

    scoreByFixtureRef.current = {};
    setLiveFeedEvents([]);
    play();
    void loadSchedule({ showLoader: true, detectGoals: false });
    void loadPlayers();

    const interval = setInterval(() => {
      void loadSchedule({ showLoader: false, detectGoals: true });
    }, 30000);

    return () => clearInterval(interval);
  }, [team, play, loadSchedule, loadPlayers]);

  useEffect(() => {
    const loadGroupStage = async () => {
      setGroupStageLoading(true);
      try {
        const matches = await fetchAllGroupStageMatches();
        setGroupStageMatches(matches);
      } catch (e) {
        console.error('Failed to load group stage matches:', e);
        setGroupStageMatches([]);
      } finally {
        setGroupStageLoading(false);
      }
    };

    void loadGroupStage();
  }, []);

  useEffect(() => {
    if (tickerViewportWidth <= 0 || tickerContentWidth <= 0) {
      return;
    }

    tickerAnimationRef.current?.stop();

    const startX = tickerViewportWidth;
    const endX = -tickerContentWidth;
    const distance = startX - endX;
    const duration = Math.max(10000, Math.floor((distance / 55) * 1000));

    tickerTranslateX.setValue(startX);
    tickerAnimationRef.current = Animated.loop(
      Animated.timing(tickerTranslateX, {
        toValue: endX,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    tickerAnimationRef.current.start();

    return () => {
      tickerAnimationRef.current?.stop();
    };
  }, [tickerContentWidth, tickerText, tickerTranslateX, tickerViewportWidth]);

  if (!team) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>Team not found</Text>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={['#0a2e0a', '#0a0a0a', '#0a0a2e']}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.navButton} onPress={() => router.back()}>
            <Text style={styles.navButtonText}>‹ Back</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navButton} onPress={() => router.push('/')}>
            <Text style={styles.navButtonText}>Home</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingHorizontal: contentHorizontalPadding },
          ]}
        >
          <View style={styles.scheduleHeaderCard}>
            <Text style={styles.scheduleTitle}>{team.name} Match Schedule</Text>
            <Text style={styles.scheduleSubTitle}>
              Device timezone: {deviceTimeZone}
            </Text>

            <View style={styles.tickerBlock}>
              <Text style={styles.tickerLabel}>Team news ticker</Text>
              <View
                style={styles.tickerViewport}
                onLayout={(event) => {
                  setTickerViewportWidth(event.nativeEvent.layout.width);
                }}
              >
                <Animated.View
                  style={{ transform: [{ translateX: tickerTranslateX }] }}
                  onLayout={(event) => {
                    setTickerContentWidth(event.nativeEvent.layout.width);
                  }}
                >
                  <Text style={styles.tickerText}>{tickerText}</Text>
                </Animated.View>
              </View>
            </View>
          </View>

          <View
            style={[
              styles.mainLayout,
              isDesktopWeb ? styles.mainLayoutDesktop : null,
              isUltraWideWeb ? styles.mainLayoutUltraWide : null,
            ]}
          >
            <View
              style={[
                styles.scheduleColumn,
                isDesktopWeb ? styles.scheduleColumnDesktop : null,
                isUltraWideWeb ? styles.scheduleColumnUltraWide : null,
              ]}
            >
              {scheduleLoading && (
                <ActivityIndicator color="#4caf50" style={{ marginTop: 24 }} />
              )}

              {scheduleError != null && (
                <View style={styles.scheduleError}>
                  <Text style={styles.scheduleErrorText}>⚠ {scheduleError}</Text>
                </View>
              )}

              {!scheduleLoading && !scheduleError && schedule.length === 0 && (
                <Text style={styles.scheduleEmptyText}>No fixtures found.</Text>
              )}

              {schedule.map((match) => {
                const tip = tipsByMatch[match.id] ?? { home: '', away: '' };
                const isGroupStageMatch = match.stage.toLowerCase().includes('group');
                return (
                  <View
                    key={match.id}
                    style={[
                      styles.matchCard,
                      isGroupStageMatch ? styles.matchCardCompact : null,
                    ]}
                  >
                    <View
                      style={[
                        styles.matchTopRow,
                        isGroupStageMatch ? styles.matchTopRowCompact : null,
                      ]}
                    >
                      <Text style={[styles.stage, isGroupStageMatch ? styles.stageCompact : null]}>
                        {match.stage}
                      </Text>
                      <Text style={[styles.versus, isGroupStageMatch ? styles.versusCompact : null]}>
                        {groupStageLinePrefix(match)}{formatTeamForMatch(match, match.homeTeam.name)} {match.homeScore} - {match.awayScore} {formatTeamForMatch(match, match.awayTeam.name)}
                      </Text>
                    </View>

                      <View style={[styles.venueSection, isGroupStageMatch ? styles.venueSectionCompact : null]}>
                        {match.venue.image && !venueImageFailedByMatch[match.id] ? (
                          <Image
                            source={{
                              uri: match.venue.image,
                            }}
                            style={[styles.venueImage, isGroupStageMatch ? styles.venueImageCompact : null]}
                            resizeMode="cover"
                            onError={() => {
                              setVenueImageFailedByMatch((prev) => ({
                                ...prev,
                                [match.id]: true,
                              }));
                            }}
                          />
                        ) : (
                          <View style={[styles.venueImageFallbackBox, isGroupStageMatch ? styles.venueImageFallbackCompact : null]}>
                            <Text style={styles.venueImageFallbackText}>
                              Venue image unavailable
                            </Text>
                          </View>
                        )}

                        <View style={styles.venueDetails}>
                          <Text style={styles.venueLine}>
                            {match.venue.name}, {match.venue.city}, {match.venue.country}
                          </Text>

                          <View style={[styles.timeBlockInline, isGroupStageMatch ? styles.timeBlockCompact : null]}>
                            <Text style={styles.timeLabel}>Venue time ({match.venue.timeZone})</Text>
                            <Text style={styles.timeValue}>
                              {formatInTimeZone(match.kickoffUtc, match.venue.timeZone)}
                            </Text>
                          </View>

                          <View style={[styles.timeBlockInline, isGroupStageMatch ? styles.timeBlockCompact : null]}>
                            <Text style={styles.timeLabel}>Your time ({deviceTimeZone})</Text>
                            <Text style={styles.timeValue}>
                              {formatInTimeZone(match.kickoffUtc, deviceTimeZone)}
                            </Text>
                          </View>
                        </View>
                      </View>

                    <View style={[styles.resultBlock, isGroupStageMatch ? styles.resultBlockCompact : null]}>
                      <Text style={styles.resultLabel}>Ergebnis</Text>
                      <Text style={[styles.resultValue, isGroupStageMatch ? styles.resultValueCompact : null]}>
                        {formatTeamForMatch(match, match.homeTeam.name)} {match.homeScore} - {match.awayScore} {formatTeamForMatch(match, match.awayTeam.name)}
                      </Text>
                    </View>

                    <View style={[styles.tipBlock, isGroupStageMatch ? styles.tipBlockCompact : null]}>
                      <Text style={styles.tipLabel}>Dein Tipp</Text>
                      <View style={styles.tipRow}>
                        <TextInput
                          value={tip.home}
                          onChangeText={(v) => setTipValue(match.id, 'home', v)}
                          keyboardType="number-pad"
                          placeholder="0"
                          placeholderTextColor="#809b82"
                          style={[styles.tipInput, isGroupStageMatch ? styles.tipInputCompact : null]}
                        />
                        <Text style={styles.tipDash}>-</Text>
                        <TextInput
                          value={tip.away}
                          onChangeText={(v) => setTipValue(match.id, 'away', v)}
                          keyboardType="number-pad"
                          placeholder="0"
                          placeholderTextColor="#809b82"
                          style={[styles.tipInput, isGroupStageMatch ? styles.tipInputCompact : null]}
                        />
                      </View>
                    </View>

                  </View>
                );
              })}
            </View>

            <View
              style={[
                styles.sideColumn,
                isDesktopWeb ? styles.sideColumnDesktop : null,
                isUltraWideWeb ? styles.sideColumnUltraWide : null,
              ]}
            >
              <View style={styles.sideStack}>
                <View
                  style={[
                    styles.heroAndSquadRow,
                    isDesktopWeb ? styles.heroAndSquadRowDesktop : null,
                  ]}
                >
                  <View
                    style={[
                      styles.heroWrap,
                      isDesktopWeb ? styles.heroWrapDesktop : null,
                    ]}
                  >
                    <View style={styles.hero}>
                      <View style={styles.stadiumBackdrop}>
                        <StadiumAnimation isPlaying={isPlaying} />
                      </View>

                      <View style={styles.flagContainer}>
                        <Text style={[styles.flag, { fontSize: flagSize }]}>{team.flag}</Text>
                      </View>

                      <View style={[styles.formationCard, { marginTop: formationTopOffset }]}> 
                        <Text style={styles.formationTitle}>Team formation ({formationData.shape})</Text>
                        <View style={styles.formationPitch}>
                          {formationData.rows.map((row, rowIndex) => (
                            <View key={`formation-row-${rowIndex}`} style={styles.formationRow}>
                              {row.map((playerLabel, itemIndex) => (
                                <View key={`${playerLabel}-${itemIndex}`} style={styles.formationNode}>
                                  <Text style={styles.formationNodeText} numberOfLines={1}>
                                    {playerLabel}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          ))}
                        </View>
                        {playersLoading ? (
                          <Text style={styles.formationMeta}>Loading squad positions...</Text>
                        ) : playersError ? (
                          <Text style={styles.formationMeta}>Unable to load national team positions, showing fallback.</Text>
                        ) : !formationData.fromPlayers ? (
                          <Text style={styles.formationMeta}>Fallback formation shown.</Text>
                        ) : (
                          <Text style={styles.formationMeta}>Matched to {team.name} national team squad positions</Text>
                        )}
                      </View>

                      <View style={styles.groupPanel}>
                        <Text style={styles.groupPanelTitle}>Group View</Text>

                      {selectedTeamStanding && (
                        <View style={styles.standingSummaryCard}>
                          <Text style={styles.standingSummaryLabel}>Team Standing</Text>
                          <Text style={styles.standingSummaryValue}>
                            #{selectedTeamStanding.rank} {selectedTeamStanding.name}
                          </Text>
                          <Text style={styles.standingSummaryMeta}>
                            {selectedTeamStanding.points} pts · {selectedTeamStanding.played} played · GD {selectedTeamStanding.goalDiff}
                          </Text>
                        </View>
                      )}

                      {groupTable.length > 0 && (
                        <View style={styles.groupTableCard}>
                          <View style={styles.groupTableHeaderRow}>
                            <Text style={styles.groupCell}>#</Text>
                            <Text style={[styles.groupCell, styles.groupTeamCol]}>Team</Text>
                            <Text style={styles.groupCell}>P</Text>
                            <Text style={styles.groupCell}>W</Text>
                            <Text style={styles.groupCell}>D</Text>
                            <Text style={styles.groupCell}>L</Text>
                            <Text style={styles.groupCell}>GF</Text>
                            <Text style={styles.groupCell}>GA</Text>
                            <Text style={styles.groupCell}>GD</Text>
                            <Text style={styles.groupCell}>Pts</Text>
                          </View>

                          {groupTable.map((row) => (
                            <View key={row.id} style={styles.groupTableDataRow}>
                              <Text style={[styles.groupCell, row.name === team.name ? styles.groupPoints : null]}>
                                {row.rank}
                              </Text>
                              <Pressable
                                style={styles.groupTeamPressable}
                                onPress={() => openTeamFromName(row.name)}
                              >
                                <Text
                                  style={[
                                    styles.groupCell,
                                    styles.groupTeamCol,
                                    styles.groupTeamLink,
                                    row.name === team.name ? styles.groupCurrentTeam : null,
                                  ]}
                                  numberOfLines={1}
                                >
                                  {withGroupLetter(row.name)}
                                </Text>
                              </Pressable>
                              <Text style={styles.groupCell}>{row.played}</Text>
                              <Text style={styles.groupCell}>{row.won}</Text>
                              <Text style={styles.groupCell}>{row.draw}</Text>
                              <Text style={styles.groupCell}>{row.lost}</Text>
                              <Text style={styles.groupCell}>{row.goalsFor}</Text>
                              <Text style={styles.groupCell}>{row.goalsAgainst}</Text>
                              <Text style={styles.groupCell}>{row.goalDiff}</Text>
                              <Text style={[styles.groupCell, styles.groupPoints]}>{row.points}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      <Text style={styles.groupPanelSubTitle}>Matches and results</Text>
                      <Text style={styles.groupTapHint}>Tap a team name to open its page</Text>
                      {groupMembers.length === 0 ? (
                        <Text style={styles.groupEmpty}>No group member results yet.</Text>
                      ) : (
                        groupMembers.map((member) => (
                          <View key={member.id} style={styles.groupMemberCard}>
                            <Pressable onPress={() => openTeamFromName(member.name)}>
                              <Text style={[styles.groupMemberName, styles.groupTeamLink]}>
                                {withGroupLetter(member.name)}
                              </Text>
                            </Pressable>
                            {member.matches.map((m) => (
                              <Text key={m.id} style={styles.groupMemberMatch}>
                                {withGroupLetter(m.homeTeam)} {m.homeScore} - {m.awayScore} {withGroupLetter(m.awayTeam)}
                              </Text>
                            ))}
                          </View>
                        ))
                      )}
                      </View>

                      <Text style={styles.teamName}>{team.name}</Text>
                      <Text style={styles.region}>{team.region}</Text>

                      <Text style={styles.goalHint}>
                        WAV plays once on selection and automatically on goals.
                      </Text>
                    </View>
                  </View>

                  {isDesktopWeb ? (
                    <View style={styles.squadOutsideStackDesktop}>
                      <PlayerList
                        players={players}
                        isLoading={playersLoading}
                        error={playersError}
                        trainerName={trainerName}
                      />
                      <TournamentStages groupStageData={groupStageDiagramData} />
                    </View>
                  ) : (
                    <PlayerList
                      players={players}
                      isLoading={playersLoading}
                      error={playersError}
                      trainerName={trainerName}
                    />
                  )}
                </View>

                {!isDesktopWeb && (
                  <TournamentStages groupStageData={groupStageDiagramData} />
                )}
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
    width: '100%',
    maxWidth: 1920,
    alignSelf: 'center',
  },
  mainLayout: {
    width: '100%',
  },
  mainLayoutDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    gap: 16,
  },
  mainLayoutUltraWide: {
    gap: 24,
  },
  scheduleColumn: {
    width: '100%',
  },
  scheduleColumnDesktop: {
    flex: 1,
    maxWidth: 880,
  },
  scheduleColumnUltraWide: {
    maxWidth: 980,
  },
  sideColumn: {
    width: '100%',
  },
  sideColumnDesktop: {
    width: 640,
    alignSelf: 'flex-start',
  },
  sideColumnUltraWide: {
    width: 820,
  },
  sideStack: {
    width: '100%',
    gap: 12,
  },
  heroAndSquadRow: {
    width: '100%',
  },
  heroAndSquadRowDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroWrap: {
    width: '100%',
  },
  heroWrapDesktop: {
    flex: 1,
    minWidth: 0,
  },
  squadOutsideStackDesktop: {
    width: 240,
    flexShrink: 0,
    gap: 12,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0a0a',
  },
  notFoundText: {
    color: '#888',
    fontSize: 16,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
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
    fontSize: 16,
    fontWeight: '600',
  },
  hero: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(12, 18, 16, 0.82)',
    borderColor: '#2e7d32',
    borderWidth: 1,
    overflow: 'hidden',
  },
  stadiumBackdrop: {
    position: 'absolute',
    top: -36,
    left: -16,
    right: -16,
    opacity: 0.32,
  },
  flagContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flag: {
    textAlign: 'center',
  },
  teamName: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    width: '100%',
    letterSpacing: 0.5,
    marginTop: 10,
  },
  formationCard: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2e7d32',
    backgroundColor: 'rgba(8, 28, 11, 0.9)',
    padding: 10,
  },
  formationTitle: {
    color: '#e6f7e8',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  formationPitch: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3a6f42',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 10,
    gap: 8,
  },
  formationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  formationNode: {
    minWidth: 56,
    maxWidth: 92,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#4da65b',
    backgroundColor: 'rgba(17, 58, 23, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 5,
    alignItems: 'center',
  },
  formationNodeText: {
    color: '#eaf8ec',
    fontSize: 10,
    fontWeight: '700',
  },
  formationMeta: {
    color: '#9acfa0',
    fontSize: 10,
    marginTop: 8,
    textAlign: 'center',
  },
  region: {
    color: '#4caf50',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 4,
    marginBottom: 20,
  },
  goalHint: {
    marginTop: 12,
    color: '#9cd6a0',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  tickerBlock: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#35543a',
    paddingTop: 8,
  },
  tickerLabel: {
    color: '#9cd6a0',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 6,
  },
  tickerViewport: {
    overflow: 'hidden',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2e7d32',
    backgroundColor: 'rgba(8, 18, 12, 0.82)',
    minHeight: 34,
    justifyContent: 'center',
  },
  tickerText: {
    color: '#ddf4df',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  groupPanel: {
    width: '100%',
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2b3a2c',
    paddingTop: 14,
  },
  groupPanelTitle: {
    color: '#9cd6a0',
    fontSize: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 14,
  },
  groupPanelSubTitle: {
    color: '#89c78f',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
  },
  standingSummaryCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2e7d32',
    backgroundColor: 'rgba(76, 175, 80, 0.12)',
    padding: 14,
    marginBottom: 14,
  },
  standingSummaryLabel: {
    color: '#9cd6a0',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  standingSummaryValue: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  standingSummaryMeta: {
    color: '#d5ead6',
    fontSize: 13,
    fontWeight: '600',
  },
  groupTableCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2b3a2c',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 14,
  },
  groupTableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#3a5040',
    marginBottom: 6,
  },
  groupTableDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  groupTeamPressable: {
    flex: 1,
  },
  groupCell: {
    width: 28,
    color: '#d9e6da',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  groupTeamCol: {
    flex: 1,
    minWidth: 150,
    textAlign: 'left',
    paddingRight: 10,
  },
  groupCurrentTeam: {
    color: '#ffffff',
    fontWeight: '800',
  },
  groupTeamLink: {
    color: '#bcefc0',
    textDecorationLine: 'underline',
  },
  groupPoints: {
    color: '#9cd6a0',
    fontWeight: '800',
  },
  groupTapHint: {
    color: '#7ea083',
    fontSize: 12,
    marginBottom: 10,
  },
  groupMemberCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2b3a2c',
    padding: 12,
    marginBottom: 10,
  },
  groupMemberName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
  },
  groupMemberMatch: {
    color: '#cdd9ce',
    fontSize: 13,
    marginBottom: 3,
  },
  groupEmpty: {
    color: '#8fa890',
    fontSize: 13,
  },
  scheduleHeaderCard: {
    marginTop: 22,
    width: '100%',
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(12, 18, 16, 0.82)',
    borderColor: '#2e7d32',
    borderWidth: 1,
  },
  scheduleTitle: {
    color: '#f2f2f2',
    fontSize: 20,
    fontWeight: '800',
  },
  scheduleSubTitle: {
    color: '#9cd6a0',
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  scheduleError: {
    width: '100%',
    marginTop: 12,
    padding: 12,
    backgroundColor: '#2e0a0a',
    borderRadius: 10,
    borderColor: '#7d2e2e',
    borderWidth: 1,
  },
  scheduleErrorText: {
    color: '#ff8a8a',
    fontSize: 13,
  },
  scheduleEmptyText: {
    color: '#666',
    textAlign: 'center',
    marginTop: 24,
    fontSize: 14,
  },
  matchCard: {
    marginTop: 12,
    width: '100%',
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(10, 10, 10, 0.86)',
    borderColor: '#2b3a2c',
    borderWidth: 1,
  },
  matchCardCompact: {
    marginTop: 8,
    padding: 10,
  },
  matchTopRow: {
    marginBottom: 8,
  },
  matchTopRowCompact: {
    marginBottom: 6,
  },
  stage: {
    color: '#89c78f',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  stageCompact: {
    fontSize: 11,
  },
  versus: {
    marginTop: 4,
    color: '#f5f5f5',
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 1,
  },
  versusCompact: {
    fontSize: 14,
  },
  venueLine: {
    color: '#afafaf',
    fontSize: 13,
    marginBottom: 10,
  },
  venueSection: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    marginBottom: 10,
  },
  venueSectionCompact: {
    gap: 8,
    marginBottom: 8,
  },
  venueImage: {
    width: 190,
    height: 170,
    borderRadius: 10,
    backgroundColor: '#1a1f1a',
  },
  venueImageCompact: {
    width: 130,
    height: 96,
    borderRadius: 8,
  },
  venueImageFallbackBox: {
    width: 190,
    height: 170,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3a5040',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  venueImageFallbackCompact: {
    width: 130,
    height: 96,
    borderRadius: 8,
  },
  venueImageFallbackText: {
    color: '#9fb3a1',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  venueDetails: {
    flex: 1,
  },
  resultBlock: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#2e7d32',
    marginBottom: 8,
  },
  resultBlockCompact: {
    padding: 8,
    marginBottom: 6,
  },
  resultLabel: {
    color: '#9cd6a0',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  resultValue: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  resultValueCompact: {
    fontSize: 13,
  },
  tipBlock: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#2b3a2c',
    marginBottom: 8,
  },
  tipBlockCompact: {
    padding: 8,
    marginBottom: 0,
  },
  tipLabel: {
    color: '#a7c9a9',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  tipInput: {
    width: 56,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3a5040',
    backgroundColor: '#111713',
    color: '#ffffff',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
  },
  tipInputCompact: {
    width: 46,
    height: 34,
    fontSize: 15,
  },
  tipDash: {
    color: '#d7e3d8',
    fontSize: 20,
    fontWeight: '700',
    marginHorizontal: 10,
  },
  timeBlock: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  timeBlockInline: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  timeBlockCompact: {
    padding: 8,
    marginTop: 6,
  },
  timeLabel: {
    color: '#a7c9a9',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  timeValue: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
