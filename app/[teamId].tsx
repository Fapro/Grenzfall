import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  View,
  Text,
  Alert,
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
  Modal,
  Switch,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StadiumAnimation } from '@/components/StadiumAnimation';
import { TournamentStages } from '@/components/TournamentStages';
import { PlayerList } from '@/components/PlayerList';
import { useRoar } from '@/hooks/useRoar';
import { useTeamGroups } from '@/hooks/useTeamGroups';
import { TEAMS } from '@/data/teams';
import { APP_TO_SPORTMONKS_TEAM_ID } from '@/data/sportmonksTeamIds';
import {
  fetchTeamSchedule,
  formatInTimeZone,
  fetchAllGroupStageMatches,
  type TeamMatch,
} from '@/data/schedule';
import { fetchTeamPlayers, type Player } from '@/data/players';
import { BACKEND_URL } from '@/config/api';

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

type MatchTip = { home: string; away: string };

type Friend = {
  id: string;
  name: string;
};

type FriendPayload = {
  id: string;
  name: string;
  tips: Record<string, MatchTip>;
};

const MAX_FRIENDS = 7;
const GROUP_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'] as const;
const TEAM_GROUP_BY_ID: Record<string, string> = {
  cze: 'A',
  kor: 'A',
  mex: 'A',
  zaf: 'A',
  can: 'B',
  qat: 'B',
  sui: 'B',
  bih: 'B',
  bra: 'C',
  mar: 'C',
  sco: 'C',
  hai: 'C',
  aus: 'D',
  tur: 'D',
  usa: 'D',
  par: 'D',
  civ: 'E',
  ecu: 'E',
  ger: 'E',
  cuw: 'E',
  jpn: 'F',
  ned: 'F',
  tun: 'F',
  swe: 'F',
  bel: 'G',
  egy: 'G',
  irn: 'G',
  nzl: 'G',
  cpv: 'H',
  sau: 'H',
  esp: 'H',
  uru: 'H',
  fra: 'I',
  irq: 'I',
  nor: 'I',
  sen: 'I',
  arg: 'J',
  aut: 'J',
  jor: 'J',
  alg: 'J',
  col: 'K',
  drc: 'K',
  por: 'K',
  uzb: 'K',
  eng: 'L',
  pan: 'L',
  cro: 'L',
  gha: 'L',
};

function toIcsDateTime(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function buildTeamCalendarIcs(teamName: string, matches: TeamMatch[]): string {
  const dtStamp = toIcsDateTime(new Date().toISOString());
  const events = matches
    .map((match) => {
      const start = toIcsDateTime(match.kickoffUtc);
      const summary = escapeIcs(`${match.homeTeam.name} vs ${match.awayTeam.name}`);
      const location = escapeIcs(`${match.venue.name}, ${match.venue.city}, ${match.venue.country}`);
      const description = escapeIcs(
        `${match.stage}${match.round ? ` - ${match.round}` : ''} | ${teamName} schedule`
      );
      return [
        'BEGIN:VEVENT',
        `UID:${match.id}@roar.local`,
        `DTSTAMP:${dtStamp}`,
        `DTSTART:${start}`,
        `SUMMARY:${summary}`,
        `LOCATION:${location}`,
        `DESCRIPTION:${description}`,
        'END:VEVENT',
      ].join('\n');
    })
    .join('\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ROAR//TEAM-SCHEDULE//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    events,
    'END:VCALENDAR',
    '',
  ].join('\n');
}

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
  const letterMatch = value.match(/(?:group|grp)\s*([a-l])/i);
  if (letterMatch?.[1]) {
    return letterMatch[1].toUpperCase();
  }

  const numberMatch = value.match(/(?:group|grp)\s*(\d{1,2})/i);
  const groupNum = Number(numberMatch?.[1] ?? NaN);
  if (Number.isFinite(groupNum) && groupNum >= 1 && groupNum <= 12) {
    return String.fromCharCode(64 + groupNum);
  }

  return null;
}

function isGroupStageMatch(stage: string, round: string): boolean {
  const combined = `${stage} ${round}`.toLowerCase().trim();
  if (!combined) {
    return false;
  }
  return /\bgroup\b/.test(combined) || /\bgrp\b/.test(combined);
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
  const { teamId, group } = useLocalSearchParams<{ teamId: string; group?: string }>();
  const router = useRouter();
  const { play, isPlaying } = useRoar();
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= 1100;
  const isUltraWideWeb = Platform.OS === 'web' && width >= 1600;
  const isSmallMobile = Platform.OS !== 'web' && width < 420;
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
  const [roarConsentGranted, setRoarConsentGranted] = useState(false);
  const roarConsentRef = useRef(false);
  const [tipsByMatch, setTipsByMatch] = useState<
    Record<string, { home: string; away: string }>
  >({});
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendTips, setFriendTips] = useState<Record<string, Record<string, MatchTip>>>({});
  const [friendNameInput, setFriendNameInput] = useState('');
  const [friendsModalVisible, setFriendsModalVisible] = useState(false);

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

  const { groupsByTeamId } = useTeamGroups();

  const calendarIcs = useMemo(() => {
    if (!team || schedule.length === 0) {
      return '';
    }
    return buildTeamCalendarIcs(team.name, schedule);
  }, [schedule, team]);

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
      const isGroupStage = isGroupStageMatch(m.stage, m.round);
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

  const preferredGroupLetter = useMemo(() => {
    const candidate = (group ?? '').toUpperCase();
    return /^[A-L]$/.test(candidate) ? candidate : '';
  }, [group]);

  const resolvedGroupLetter = groupLetter || preferredGroupLetter;

  const currentGroupLetter = useMemo(() => {
    // First, try Sportmonks data (most reliable)
    if (team?.id && groupsByTeamId) {
      const sportmonksTeamId = APP_TO_SPORTMONKS_TEAM_ID[team.id];
      if (sportmonksTeamId && groupsByTeamId[String(sportmonksTeamId)]) {
        return groupsByTeamId[String(sportmonksTeamId)];
      }
    }

    // Then try hardcoded mapping (known correct)
    const hardcodedGroup = TEAM_GROUP_BY_ID[team?.id ?? ''];
    if (hardcodedGroup) {
      return hardcodedGroup;
    }

    // Finally, fall back to fixture analysis
    if (resolvedGroupLetter) {
      return resolvedGroupLetter;
    }

    return '';
  }, [team?.id, groupsByTeamId, resolvedGroupLetter]);

  const goToNextGroup = useCallback(() => {
    const currentIndex = GROUP_LETTERS.indexOf(currentGroupLetter as (typeof GROUP_LETTERS)[number]);
    if (currentIndex < 0) {
      Alert.alert('Group not found', 'Unable to determine current group.');
      return;
    }

    // Helper to check if a team belongs to a group
    const isTeamInGroup = (teamId: string, groupLetter: string): boolean => {
      const sportmonksTeamId = APP_TO_SPORTMONKS_TEAM_ID[teamId];
      if (sportmonksTeamId && groupsByTeamId[String(sportmonksTeamId)]) {
        return groupsByTeamId[String(sportmonksTeamId)] === groupLetter;
      }
      return TEAM_GROUP_BY_ID[teamId] === groupLetter;
    };

    for (let step = 1; step <= GROUP_LETTERS.length; step += 1) {
      const nextLetter = GROUP_LETTERS[(currentIndex + step) % GROUP_LETTERS.length];
      const nextGroupTeams = TEAMS
        .filter((entry) => isTeamInGroup(entry.id, nextLetter))
        .sort((a, b) => a.name.localeCompare(b.name));

      if (nextGroupTeams.length > 0) {
        router.push({ pathname: `/${nextGroupTeams[0].id}`, params: { group: nextLetter } });
        return;
      }
    }

    Alert.alert('No group available', 'Could not find a team in the next group.');
  }, [currentGroupLetter, router, groupsByTeamId]);

  const withGroupLetter = useCallback(
    (teamName: string) =>
      resolvedGroupLetter ? `${teamName} (Group ${resolvedGroupLetter})` : teamName,
    [resolvedGroupLetter]
  );

  const groupStageLinePrefix = useCallback(
    (match: TeamMatch) =>
      isGroupStageMatch(match.stage, match.round) && resolvedGroupLetter
        ? `Group ${resolvedGroupLetter} · `
        : '',
    [resolvedGroupLetter]
  );

  const getGroupLabelForMatch = useCallback(
    (match: TeamMatch) => {
      const fromStage = extractGroupLetterFromText(match.stage);
      const fromRound = extractGroupLetterFromText(match.round);
      const letter = fromStage || fromRound || resolvedGroupLetter || currentGroupLetter;
      return letter ? `Group ${letter}` : 'Group Stage';
    },
    [currentGroupLetter, resolvedGroupLetter]
  );

  const formatTeamForMatch = useCallback(
    (_match: TeamMatch, teamName: string, _isHome: boolean = false) => teamName,
    []
  );

  const topBarGroupLabel = useMemo(
    () => `Group (${currentGroupLetter || '-'})`,
    [currentGroupLetter]
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

    if (resolvedGroupLetter) {
      newsItems.push(`[GROUP] Competing in Group ${resolvedGroupLetter}`);
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
  }, [liveFeedEvents, players.length, playersError, resolvedGroupLetter, schedule, selectedTeamStanding, team, trainerName]);

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

    const teamsByGroup = new Map<string, Set<string>>();
    const resultsByGroup = new Map<string, Map<string, string>>();
    for (const match of groupStageMatches) {
      const detectedLetter =
        extractGroupLetterFromText(match.stage) ??
        extractGroupLetterFromText(match.round);
      if (!detectedLetter) {
        continue;
      }

      const letter = detectedLetter.toUpperCase();
      if (!teamsByGroup.has(letter)) {
        teamsByGroup.set(letter, new Set<string>());
      }
      if (!resultsByGroup.has(letter)) {
        resultsByGroup.set(letter, new Map<string, string>());
      }

      teamsByGroup.get(letter)?.add(match.homeTeam.name);
      teamsByGroup.get(letter)?.add(match.awayTeam.name);
      resultsByGroup.get(letter)?.set(
        match.id,
        `${match.homeTeam.name} ${match.homeScore} - ${match.awayScore} ${match.awayTeam.name}`
      );
    }

    const baseGroups: Record<string, GroupStageGroupData> = {};
    letters.forEach((letter) => {
      const teams = Array.from(teamsByGroup.get(letter) ?? []).sort((a, b) =>
        a.localeCompare(b)
      );
      const results = Array.from(resultsByGroup.get(letter)?.values() ?? []);

      baseGroups[letter] = {
        teams,
        results: results.length > 0 ? results : ['Results pending'],
      };
    });

    if (currentGroupLetter && baseGroups[currentGroupLetter]) {
      baseGroups[currentGroupLetter] = {
        teams: groupTable.map((row) => row.name),
        results: Array.from(uniqueResults.values()),
      };
    }

    return {
      groupLetter: currentGroupLetter,
      teams: groupTable.map((row) => row.name),
      results: Array.from(uniqueResults.values()),
      groups: baseGroups,
    };
  }, [currentGroupLetter, groupStageMatches, groupTable, selectedGroupMatches]);

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

  const saveFriendsToBackend = useCallback(
    async (nextFriends: Friend[], nextTips: Record<string, Record<string, MatchTip>>) => {
      if (!team) {
        return;
      }

      const payloadFriends: FriendPayload[] = nextFriends.map((friend) => ({
        id: friend.id,
        name: friend.name,
        tips: nextTips[friend.id] ?? {},
      }));

      try {
        await fetch(`${BACKEND_URL}/api/friends/${encodeURIComponent(team.id)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ friends: payloadFriends }),
        });
      } catch (error) {
        console.warn('Failed to persist friends:', error);
      }
    },
    [team]
  );

  const setFriendTip = useCallback(
    (friendId: string, matchId: string, side: 'home' | 'away', value: string) => {
      const cleaned = value.replace(/[^0-9]/g, '').slice(0, 2);

      setFriendTips((prev) => {
        const next = {
          ...prev,
          [friendId]: {
            ...(prev[friendId] ?? {}),
            [matchId]: {
              home: prev[friendId]?.[matchId]?.home ?? '',
              away: prev[friendId]?.[matchId]?.away ?? '',
              [side]: cleaned,
            },
          },
        };

        void saveFriendsToBackend(friends, next);
        return next;
      });
    },
    [friends, saveFriendsToBackend]
  );

  const addFriend = useCallback(() => {
    const name = friendNameInput.trim().slice(0, 24);
    if (!name) {
      return;
    }

    if (friends.length >= MAX_FRIENDS) {
      Alert.alert('Friends limit reached', `You can add up to ${MAX_FRIENDS} friends.`);
      return;
    }

    const newFriend: Friend = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
    };

    setFriends((prev) => {
      const next = [...prev, newFriend];
      void saveFriendsToBackend(next, friendTips);
      return next;
    });
    setFriendNameInput('');
  }, [friendNameInput, friendTips, friends.length, saveFriendsToBackend]);

  const removeFriend = useCallback(
    (friendId: string) => {
      setFriends((prev) => {
        const next = prev.filter((friend) => friend.id !== friendId);

        setFriendTips((prevTips) => {
          const nextTips = { ...prevTips };
          delete nextTips[friendId];
          void saveFriendsToBackend(next, nextTips);
          return nextTips;
        });

        return next;
      });
    },
    [saveFriendsToBackend]
  );

  const requestRoarToDevice = useCallback(() => {
    play();
    Alert.alert(
      'Roar sent',
      'Roar test sent to this device. Enable Auto to hear future goal roars automatically.'
    );
  }, [play]);

  const toggleRoarAlerts = useCallback((value: boolean) => {
    setRoarConsentGranted(value);
    roarConsentRef.current = value;
    Alert.alert(
      value ? 'Auto roar enabled' : 'Auto roar disabled',
      value
        ? 'You will hear an in-app roar when new goals are detected.'
        : 'Automatic roar alerts are now turned off.'
    );
  }, []);

  const downloadCalendarFile = useCallback(async () => {
    if (!team || !calendarIcs) {
      Alert.alert('No matches yet', 'Calendar export will be available once fixtures are loaded.');
      return;
    }

    const safeName = team.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    try {
      if (Platform.OS === 'web') {
        const blob = new Blob([calendarIcs], { type: 'text/calendar;charset=utf-8' });
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = `${safeName}-schedule.ics`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
        return;
      }

      const dataUrl = `data:text/calendar;charset=utf-8,${encodeURIComponent(calendarIcs)}`;
      const canOpen = await Linking.canOpenURL(dataUrl);
      if (canOpen) {
        await Linking.openURL(dataUrl);
      } else {
        Alert.alert('Export ready', 'Use web to download the .ics file directly.');
      }
    } catch (error) {
      Alert.alert('Export failed', 'Could not create calendar file right now.');
      console.warn('Calendar export failed:', error);
    }
  }, [calendarIcs, team]);

  const openGoogleImport = useCallback(async () => {
    if (!calendarIcs) {
      Alert.alert('No matches yet', 'Load fixtures first, then import the .ics file.');
      return;
    }

    await downloadCalendarFile();
    const url = 'https://calendar.google.com/calendar/u/0/r/settings/export';
    await Linking.openURL(url);
    Alert.alert('Gmail / Google Calendar', 'Upload the downloaded .ics in Google Calendar import settings.');
  }, [calendarIcs, downloadCalendarFile]);

  const openOutlookImport = useCallback(async () => {
    if (!calendarIcs) {
      Alert.alert('No matches yet', 'Load fixtures first, then import the .ics file.');
      return;
    }

    await downloadCalendarFile();
    const url = 'https://outlook.live.com/calendar/0/';
    await Linking.openURL(url);
    Alert.alert('Outlook', 'Use Add calendar -> Upload from file and pick the downloaded .ics.');
  }, [calendarIcs, downloadCalendarFile]);

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

        if (goalDetected && roarConsentRef.current) {
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
    roarConsentRef.current = roarConsentGranted;
  }, [roarConsentGranted]);

  useEffect(() => {
    const loadFriends = async () => {
      if (!team) {
        setFriends([]);
        setFriendTips({});
        return;
      }

      try {
        const res = await fetch(`${BACKEND_URL}/api/friends/${encodeURIComponent(team.id)}`);
        if (!res.ok) {
          return;
        }
        const payload = (await res.json()) as FriendPayload[];
        const nextFriends: Friend[] = payload.map((item) => ({ id: item.id, name: item.name }));
        const nextTips: Record<string, Record<string, MatchTip>> = {};
        payload.forEach((item) => {
          nextTips[item.id] = item.tips ?? {};
        });
        setFriends(nextFriends);
        setFriendTips(nextTips);
      } catch (error) {
        console.warn('Failed to load friends:', error);
      }
    };

    void loadFriends();
  }, [team]);

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
           <View style={styles.navLeftControls}>
             <View style={styles.navGroupLetterRail}>
               <Text style={styles.navGroupLetter}>{currentGroupLetter || '-'}</Text>
             </View>
             <TouchableOpacity style={styles.navButton} onPress={() => router.back()}>
               <Text style={styles.navButtonText}>‹ Back</Text>
             </TouchableOpacity>
             <TouchableOpacity style={styles.navButton} onPress={goToNextGroup}>
               <Text style={styles.navButtonText}>Next ›</Text>
             </TouchableOpacity>
            <View style={styles.groupChip}>
              <Text style={styles.groupChipText}>{topBarGroupLabel}</Text>
            </View>
           </View>
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
            <View style={[styles.scheduleHeaderTopRow, isSmallMobile ? styles.scheduleHeaderTopRowCompact : null]}>
              <Text style={[styles.scheduleTitle, isSmallMobile ? styles.scheduleTitleCompact : null]}>
                {currentGroupLetter
                  ? `GROUP ${currentGroupLetter} ${team.name} Match Schedule`
                  : `${team.name} Match Schedule`}
              </Text>
              <View style={[styles.roarActionFrame, isSmallMobile ? styles.roarActionFrameCompact : null]}>
                <View style={[styles.calendarActionsRow, isSmallMobile ? styles.calendarActionsRowCompact : null]}>
                  <TouchableOpacity
                    style={[
                      styles.calendarActionButton,
                      isSmallMobile ? styles.calendarActionButtonCompact : null,
                      !calendarIcs ? styles.calendarActionButtonDisabled : null,
                    ]}
                    onPress={downloadCalendarFile}
                    disabled={!calendarIcs}
                  >
                    <Text style={[styles.calendarActionText, isSmallMobile ? styles.calendarActionTextCompact : null]}>.ics</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.calendarActionButton,
                      isSmallMobile ? styles.calendarActionButtonCompact : null,
                      !calendarIcs ? styles.calendarActionButtonDisabled : null,
                    ]}
                    onPress={openOutlookImport}
                    disabled={!calendarIcs}
                  >
                    <Text style={[styles.calendarActionText, isSmallMobile ? styles.calendarActionTextCompact : null]}>Outlook</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.calendarActionButton,
                      isSmallMobile ? styles.calendarActionButtonCompact : null,
                      !calendarIcs ? styles.calendarActionButtonDisabled : null,
                    ]}
                    onPress={openGoogleImport}
                    disabled={!calendarIcs}
                  >
                    <Text style={[styles.calendarActionText, isSmallMobile ? styles.calendarActionTextCompact : null]}>Gmail</Text>
                  </TouchableOpacity>
                </View>
                {!(isDesktopWeb || isUltraWideWeb) && (
                  <TouchableOpacity
                    style={[styles.friendsHeaderButton, isSmallMobile ? styles.friendsHeaderButtonCompact : null]}
                    onPress={() => setFriendsModalVisible(true)}
                  >
                    <Text style={[styles.friendsHeaderButtonText, isSmallMobile ? styles.friendsHeaderButtonTextCompact : null]}>Friends</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.roarSendButton, isSmallMobile ? styles.roarSendButtonCompact : null]}
                  onPress={requestRoarToDevice}
                >
                  <Text style={[styles.roarSendButtonText, isSmallMobile ? styles.roarSendButtonTextCompact : null]}>Send Roar</Text>
                </TouchableOpacity>
                <View style={[styles.roarSwitchWrap, isSmallMobile ? styles.roarSwitchWrapCompact : null]}>
                  <Text style={[styles.roarSwitchLabel, isSmallMobile ? styles.roarSwitchLabelCompact : null]}>Auto</Text>
                  <Switch
                    value={roarConsentGranted}
                    onValueChange={toggleRoarAlerts}
                    trackColor={{ false: '#28402a', true: '#2e7d32' }}
                    thumbColor={roarConsentGranted ? '#e9ffe8' : '#9fb8a0'}
                    ios_backgroundColor="#28402a"
                  />
                </View>
              </View>
            </View>
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
                const isGroupFixture = isGroupStageMatch(match.stage, match.round);
                // Only show group label if the current team is actually in that group
                let stageLabel = match.stage || match.round || 'Fixture';
                if (isGroupFixture) {
                  const groupLetter = extractGroupLetterFromText(match.stage) || extractGroupLetterFromText(match.round);
                  // Only show group label if the current team is in that group
                  if (groupLetter && (TEAM_GROUP_BY_ID[team?.id ?? ''] === groupLetter)) {
                    stageLabel = `GROUP ${groupLetter}`;
                  } else {
                    stageLabel = '';
                  }
                }
                return (
                  <View
                    key={match.id}
                    style={[
                      styles.matchCard,
                      isGroupFixture ? styles.matchCardCompact : null,
                    ]}
                  >
                    <View
                      style={[
                        styles.matchTopRow,
                        isGroupFixture ? styles.matchTopRowCompact : null,
                      ]}
                    >
                      <Text style={[styles.stage, isGroupFixture ? styles.stageCompact : null]}>
                        {stageLabel}
                      </Text>
                      {!!match.round && !isGroupFixture && (
                        <Text style={styles.roundLine}>{match.round}</Text>
                      )}
                    </View>

                      <View style={[styles.venueSection, isGroupFixture ? styles.venueSectionCompact : null]}>
                        {match.venue.image && !venueImageFailedByMatch[match.id] ? (
                          <Image
                            source={{
                              uri: match.venue.image,
                            }}
                            style={[styles.venueImage, isGroupFixture ? styles.venueImageCompact : null]}
                            resizeMode="cover"
                            onError={() => {
                              setVenueImageFailedByMatch((prev) => ({
                                ...prev,
                                [match.id]: true,
                              }));
                            }}
                          />
                        ) : (
                          <View style={[styles.venueImageFallbackBox, isGroupFixture ? styles.venueImageFallbackCompact : null]}>
                            <Text style={styles.venueImageFallbackText}>
                              Venue image unavailable
                            </Text>
                          </View>
                        )}

                        <View style={styles.venueDetails}>
                          <Text style={styles.venueMetaTitle}>Venue & schedule</Text>
                          <Text style={styles.venueLine}>
                            {match.venue.name}, {match.venue.city}, {match.venue.country}
                          </Text>

                          <Text style={[styles.venueScoreLine, isGroupFixture ? styles.venueScoreLineCompact : null]}>
                            {formatTeamForMatch(match, match.homeTeam.name, true)} {match.homeScore}:{match.awayScore} {formatTeamForMatch(match, match.awayTeam.name, false)}
                          </Text>

                          <View style={[styles.timeBlockInline, isGroupFixture ? styles.timeBlockCompact : null]}>
                            <Text style={styles.timeLabel}>Venue time ({match.venue.timeZone})</Text>
                            <Text style={styles.timeValue}>
                              {formatInTimeZone(match.kickoffUtc, match.venue.timeZone)}
                            </Text>
                          </View>

                          <View style={[styles.timeBlockInline, isGroupFixture ? styles.timeBlockCompact : null]}>
                            <Text style={styles.timeLabel}>Your time ({deviceTimeZone})</Text>
                            <Text style={styles.timeValue}>
                              {formatInTimeZone(match.kickoffUtc, deviceTimeZone)}
                            </Text>
                          </View>
                        </View>
                      </View>

                    <View style={[styles.resultBlock, isGroupFixture ? styles.resultBlockCompact : null]}>
                      <Text style={styles.resultLabel}>Ergebnis</Text>
                      <Text style={[styles.resultValue, isGroupFixture ? styles.resultValueCompact : null]}>
                        {formatTeamForMatch(match, match.homeTeam.name, true)} {match.homeScore}:{match.awayScore} {formatTeamForMatch(match, match.awayTeam.name, false)}
                      </Text>
                    </View>

                    <View style={[styles.tipBlock, isGroupFixture ? styles.tipBlockCompact : null]}>
                      <Text style={styles.tipLabel}>Dein Tipp</Text>
                      <View style={styles.tipRow}>
                        <TextInput
                          value={tip.home}
                          onChangeText={(v) => setTipValue(match.id, 'home', v)}
                          keyboardType="number-pad"
                          placeholder="0"
                          placeholderTextColor="#809b82"
                          style={[styles.tipInput, isGroupFixture ? styles.tipInputCompact : null]}
                        />
                        <Text style={styles.tipDash}>-</Text>
                        <TextInput
                          value={tip.away}
                          onChangeText={(v) => setTipValue(match.id, 'away', v)}
                          keyboardType="number-pad"
                          placeholder="0"
                          placeholderTextColor="#809b82"
                          style={[styles.tipInput, isGroupFixture ? styles.tipInputCompact : null]}
                        />
                      </View>
                      {friends.length > 0 && (
                        <View
                          style={[
                            styles.friendsTipsInlineList,
                            isSmallMobile ? styles.friendsTipsInlineListCompact : null,
                          ]}
                        >
                          <Text
                            style={[
                              styles.friendsTipsInlineTitle,
                              isSmallMobile ? styles.friendsTipsInlineTitleCompact : null,
                            ]}
                          >
                            Friends Tipps
                          </Text>
                          <View
                            style={[
                              styles.friendsTipsInlineGrid,
                              isSmallMobile ? styles.friendsTipsInlineGridCompact : null,
                            ]}
                          >
                            {friends.map((friend) => {
                              const friendTip = friendTips[friend.id]?.[match.id] ?? { home: '', away: '' };
                              const hasTip = friendTip.home !== '' || friendTip.away !== '';
                              return (
                                <View
                                  key={`${friend.id}-${match.id}`}
                                  style={[
                                    styles.friendsTipInlineCard,
                                    isSmallMobile ? styles.friendsTipInlineCardCompact : null,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.friendsTipInlineName,
                                      isSmallMobile ? styles.friendsTipInlineNameCompact : null,
                                    ]}
                                    numberOfLines={1}
                                  >
                                    {friend.name}
                                  </Text>
                                  <View
                                    style={[
                                      styles.friendsTipInlineScoreRow,
                                      isSmallMobile ? styles.friendsTipInlineScoreRowCompact : null,
                                    ]}
                                  >
                                    <View
                                      style={[
                                        styles.friendsTipInlineBox,
                                        isSmallMobile ? styles.friendsTipInlineBoxCompact : null,
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          styles.friendsTipInlineBoxText,
                                          isSmallMobile ? styles.friendsTipInlineBoxTextCompact : null,
                                        ]}
                                      >
                                        {hasTip ? friendTip.home || '0' : '-'}
                                      </Text>
                                    </View>
                                    <Text
                                      style={[
                                        styles.friendsTipInlineDash,
                                        isSmallMobile ? styles.friendsTipInlineDashCompact : null,
                                      ]}
                                    >
                                      -
                                    </Text>
                                    <View
                                      style={[
                                        styles.friendsTipInlineBox,
                                        isSmallMobile ? styles.friendsTipInlineBoxCompact : null,
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          styles.friendsTipInlineBoxText,
                                          isSmallMobile ? styles.friendsTipInlineBoxTextCompact : null,
                                        ]}
                                      >
                                        {hasTip ? friendTip.away || '0' : '-'}
                                      </Text>
                                    </View>
                                  </View>
                                </View>
                              );
                            })}
                          </View>
                        </View>
                      )}
                    </View>

                  </View>
                );
              })}

              {!(isDesktopWeb || isUltraWideWeb) && (
                <>
                  <TouchableOpacity style={styles.friendsMobileOpenBtn} onPress={() => setFriendsModalVisible(true)}>
                    <Text style={styles.friendsMobileOpenBtnText}>Friends</Text>
                  </TouchableOpacity>
                  <Modal
                    visible={friendsModalVisible}
                    animationType="slide"
                    transparent
                    onRequestClose={() => setFriendsModalVisible(false)}
                  >
                    <View style={styles.friendsModalBackdrop}>
                      <View style={styles.friendsModalPanel}>
                        <View style={styles.friendsModalHeader}>
                          <Text style={styles.friendsPanelTitle}>Friends</Text>
                          <TouchableOpacity onPress={() => setFriendsModalVisible(false)}>
                            <Text style={styles.friendRemoveBtnText}>x</Text>
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.friendsLimitText}>{friends.length}/{MAX_FRIENDS} friends</Text>
                        <View style={styles.friendsAddRow}>
                          <TextInput
                            style={styles.friendsAddInput}
                            value={friendNameInput}
                            onChangeText={setFriendNameInput}
                            placeholder="Add friend..."
                            maxLength={24}
                          />
                          <TouchableOpacity
                            style={[
                              styles.friendsAddButton,
                              friends.length >= MAX_FRIENDS ? styles.friendsAddButtonDisabled : null,
                            ]}
                            onPress={addFriend}
                            disabled={friends.length >= MAX_FRIENDS}
                          >
                            <Text style={styles.friendsAddButtonText}>Add</Text>
                          </TouchableOpacity>
                        </View>
                        <ScrollView>
                          {friends.length === 0 && <Text style={styles.friendsEmpty}>No friends yet.</Text>}
                          {friends.map((friend) => (
                            <View key={friend.id} style={styles.friendCard}>
                              <View style={styles.friendCardHeader}>
                                <Text style={styles.friendName}>{friend.name}</Text>
                                <TouchableOpacity style={styles.friendRemoveBtn} onPress={() => removeFriend(friend.id)}>
                                  <Text style={styles.friendRemoveBtnText}>x</Text>
                                </TouchableOpacity>
                              </View>
                              {schedule.map((match) => {
                                const tip = friendTips[friend.id]?.[match.id] ?? { home: '', away: '' };
                                return (
                                  <View key={match.id} style={styles.friendTipRow}>
                                    <Text style={styles.friendTipMatch}>
                                      {formatTeamForMatch(match, match.homeTeam.name, true)} vs {formatTeamForMatch(match, match.awayTeam.name, false)}
                                    </Text>
                                    <TextInput
                                      style={styles.friendTipInput}
                                      value={tip.home}
                                      onChangeText={(v) => setFriendTip(friend.id, match.id, 'home', v)}
                                      keyboardType="numeric"
                                      maxLength={2}
                                      placeholder="H"
                                    />
                                    <Text style={styles.tipDash}>-</Text>
                                    <TextInput
                                      style={styles.friendTipInput}
                                      value={tip.away}
                                      onChangeText={(v) => setFriendTip(friend.id, match.id, 'away', v)}
                                      keyboardType="numeric"
                                      maxLength={2}
                                      placeholder="A"
                                    />
                                  </View>
                                );
                              })}
                            </View>
                          ))}
                        </ScrollView>
                      </View>
                    </View>
                  </Modal>
                </>
              )}
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
                            <Text style={[styles.groupCell, styles.groupTeamCol]}>Team</Text>
                            <Text style={styles.groupCell}>Sp</Text>
                            <Text style={styles.groupCell}>S</Text>
                            <Text style={styles.groupCell}>U</Text>
                            <Text style={styles.groupCell}>N</Text>
                            <Text style={styles.groupCell}>T</Text>
                            <Text style={styles.groupCell}>GT</Text>
                            <Text style={styles.groupCell}>TD</Text>
                            <Text style={styles.groupCell}>Pkte</Text>
                          </View>

                          {groupTable.map((row) => (
                            <View key={row.id} style={styles.groupTableDataRow}>
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
                                  {row.name}
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
                                {member.name}
                              </Text>
                            </Pressable>
                            {member.matches.map((m) => (
                              <Text key={m.id} style={styles.groupMemberMatch}>
                                {m.homeTeam} {m.homeScore} - {m.awayScore} {m.awayTeam}
                              </Text>
                            ))}
                          </View>
                        ))
                      )}
                      </View>

                      <Text style={styles.teamName}>{team.name}</Text>
                      <Text style={styles.region}>{team.region}</Text>

                      <Text style={styles.goalHint}>
                        Tap Send Roar for a test. Enable Auto for in-app goal roar alerts.
                      </Text>
                    </View>
                  </View>

                  {isDesktopWeb ? (
                    <View style={styles.squadOutsideStackDesktop}>
                      <View style={styles.squadAndFriendsRowDesktop}>
                        <View style={styles.squadPanelDesktop}>
                          <PlayerList
                            players={players}
                            isLoading={playersLoading}
                            error={playersError}
                            trainerName={trainerName}
                          />
                        </View>
                        <View style={[styles.friendsPanel, styles.friendsPanelDesktop]}>
                          <Text style={styles.friendsPanelTitle}>Friends</Text>
                          <Text style={styles.friendsLimitText}>{friends.length}/{MAX_FRIENDS} friends</Text>
                          <View style={styles.friendsAddRow}>
                            <TextInput
                              style={styles.friendsAddInput}
                              value={friendNameInput}
                              onChangeText={setFriendNameInput}
                              placeholder="Add friend..."
                              maxLength={24}
                            />
                            <TouchableOpacity
                              style={[
                                styles.friendsAddButton,
                                friends.length >= MAX_FRIENDS ? styles.friendsAddButtonDisabled : null,
                              ]}
                              onPress={addFriend}
                              disabled={friends.length >= MAX_FRIENDS}
                            >
                              <Text style={styles.friendsAddButtonText}>Add</Text>
                            </TouchableOpacity>
                          </View>
                          {friends.length === 0 && <Text style={styles.friendsEmpty}>No friends yet.</Text>}
                          {friends.map((friend) => (
                            <View key={friend.id} style={styles.friendCard}>
                              <View style={styles.friendCardHeader}>
                                <Text style={styles.friendName}>{friend.name}</Text>
                                <TouchableOpacity style={styles.friendRemoveBtn} onPress={() => removeFriend(friend.id)}>
                                  <Text style={styles.friendRemoveBtnText}>x</Text>
                                </TouchableOpacity>
                              </View>
                              {schedule.map((match) => {
                                const tip = friendTips[friend.id]?.[match.id] ?? { home: '', away: '' };
                                return (
                                  <View key={match.id} style={styles.friendTipRow}>
                                    <Text style={styles.friendTipMatch}>
                                      {formatTeamForMatch(match, match.homeTeam.name, true)} vs {formatTeamForMatch(match, match.awayTeam.name, false)}
                                    </Text>
                                    <TextInput
                                      style={styles.friendTipInput}
                                      value={tip.home}
                                      onChangeText={(v) => setFriendTip(friend.id, match.id, 'home', v)}
                                      keyboardType="numeric"
                                      maxLength={2}
                                      placeholder="H"
                                    />
                                    <Text style={styles.tipDash}>-</Text>
                                    <TextInput
                                      style={styles.friendTipInput}
                                      value={tip.away}
                                      onChangeText={(v) => setFriendTip(friend.id, match.id, 'away', v)}
                                      keyboardType="numeric"
                                      maxLength={2}
                                      placeholder="A"
                                    />
                                  </View>
                                );
                              })}
                            </View>
                          ))}
                        </View>
                      </View>
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
    flex: 1,
    minWidth: 0,
    gap: 12,
  },
  squadAndFriendsRowDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  squadPanelDesktop: {
    flex: 1,
    minWidth: 220,
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
  navLeftControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  groupChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#35543a',
    backgroundColor: 'rgba(10, 20, 13, 0.75)',
  },
  groupChipText: {
    color: '#a9d7ae',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
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
  navGroupLetterRail: {
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#101c12',
    borderWidth: 2,
    borderColor: '#2e7d32',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  navGroupLetter: {
    color: '#a9d7ae',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginTop: 1,
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
    flex: 1,
  },
  scheduleTitleCompact: {
    flex: 0,
    fontSize: 18,
    lineHeight: 22,
  },
  scheduleHeaderTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  scheduleHeaderTopRowCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
  },
  roarActionFrame: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  roarActionFrameCompact: {
    justifyContent: 'flex-start',
    width: '100%',
    gap: 6,
  },
  roarSendButton: {
    borderWidth: 1,
    borderColor: '#2e7d32',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(8, 24, 10, 0.9)',
  },
  roarSendButtonCompact: {
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  roarSendButtonText: {
    color: '#d4f5d7',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  roarSendButtonTextCompact: {
    fontSize: 10,
    letterSpacing: 0.3,
  },
  friendsHeaderButton: {
    borderWidth: 1,
    borderColor: '#2e7d32',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(8, 24, 10, 0.9)',
  },
  friendsHeaderButtonCompact: {
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  friendsHeaderButtonText: {
    color: '#d4f5d7',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  friendsHeaderButtonTextCompact: {
    fontSize: 10,
    letterSpacing: 0.3,
  },
  roarSwitchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roarSwitchWrapCompact: {
    gap: 4,
  },
  roarSwitchLabel: {
    color: '#c9efcc',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  roarSwitchLabelCompact: {
    fontSize: 10,
    letterSpacing: 0.3,
  },
  scheduleSubTitle: {
    color: '#9cd6a0',
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  calendarActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calendarActionsRowCompact: {
    width: '100%',
    flexWrap: 'wrap',
    gap: 6,
  },
  calendarActionButton: {
    borderWidth: 1,
    borderColor: '#2e7d32',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(8, 24, 10, 0.9)',
  },
  calendarActionButtonCompact: {
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  calendarActionButtonDisabled: {
    opacity: 0.45,
  },
  calendarActionText: {
    color: '#d4f5d7',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  calendarActionTextCompact: {
    fontSize: 10,
    letterSpacing: 0.3,
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
  roundLine: {
    marginTop: 2,
    color: '#7fa886',
    fontSize: 11,
    fontWeight: '600',
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
  venueScoreLine: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 28,
    marginBottom: 8,
    flexWrap: 'wrap',
    textAlign: 'center',
    alignSelf: 'center',
  },
  venueScoreLineCompact: {
    fontSize: 18,
    lineHeight: 22,
    marginBottom: 6,
  },
  venueMetaTitle: {
    color: '#9cd6a0',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
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
  friendsTipsInlineList: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#324534',
    paddingTop: 6,
    gap: 6,
  },
  friendsTipsInlineListCompact: {
    marginTop: 6,
    paddingTop: 4,
    gap: 4,
  },
  friendsTipsInlineTitle: {
    color: '#9acfa0',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  friendsTipsInlineTitleCompact: {
    fontSize: 10,
    letterSpacing: 0.4,
  },
  friendsTipsInlineGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  friendsTipsInlineGridCompact: {
    gap: 6,
  },
  friendsTipInlineCard: {
    width: '31%',
    minWidth: 96,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#324534',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: 6,
  },
  friendsTipInlineCardCompact: {
    minWidth: 88,
    padding: 4,
  },
  friendsTipInlineScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendsTipInlineScoreRowCompact: {
    marginTop: -1,
  },
  friendsTipInlineName: {
    color: '#c9dfcb',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
    textAlign: 'center',
  },
  friendsTipInlineNameCompact: {
    fontSize: 10,
    marginBottom: 4,
  },
  friendsTipInlineBox: {
    width: 30,
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3a5040',
    backgroundColor: '#111713',
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendsTipInlineBoxCompact: {
    width: 26,
    height: 22,
  },
  friendsTipInlineDash: {
    color: '#d7e3d8',
    fontSize: 16,
    fontWeight: '700',
    marginHorizontal: 6,
  },
  friendsTipInlineDashCompact: {
    fontSize: 14,
    marginHorizontal: 4,
  },
  friendsTipInlineBoxText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  friendsTipInlineBoxTextCompact: {
    fontSize: 11,
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
  friendsPanel: {
    marginTop: 14,
    width: '100%',
    borderRadius: 12,
    padding: 12,
    backgroundColor: 'rgba(8, 24, 10, 0.55)',
    borderWidth: 1,
    borderColor: '#2b4b2f',
  },
  friendsPanelDesktop: {
    marginTop: 0,
    width: 300,
    maxWidth: 300,
    alignSelf: 'stretch',
  },
  friendsPanelTitle: {
    color: '#d8f5da',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
  },
  friendsAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  friendsAddInput: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3a5040',
    backgroundColor: '#111713',
    color: '#ffffff',
    paddingHorizontal: 10,
  },
  friendsAddButton: {
    borderRadius: 8,
    backgroundColor: '#2e7d32',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  friendsAddButtonDisabled: {
    opacity: 0.45,
  },
  friendsAddButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 12,
  },
  friendsLimitText: {
    color: '#8fb090',
    fontSize: 12,
    marginBottom: 8,
  },
  friendsEmpty: {
    color: '#8fb090',
    fontSize: 13,
  },
  friendCard: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2b3a2c',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 10,
  },
  friendCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  friendName: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  friendRemoveBtn: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#2e7d32',
  },
  friendRemoveBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 16,
    lineHeight: 18,
  },
  friendTipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  friendTipMatch: {
    flex: 1,
    color: '#cdd9ce',
    fontSize: 12,
    marginRight: 6,
  },
  friendTipInput: {
    width: 34,
    height: 30,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#3a5040',
    backgroundColor: '#111713',
    color: '#fff',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
  },
  friendsMobileOpenBtn: {
    backgroundColor: '#2e7d32',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  friendsMobileOpenBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  friendsModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  friendsModalPanel: {
    backgroundColor: 'rgba(18, 28, 18, 0.99)',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 18,
    minHeight: 320,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  friendsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
});
