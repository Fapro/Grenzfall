import express from 'express';
import connection from './db.js';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { XMLParser } from 'fast-xml-parser';

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const db = connection.promise();
const SPORTMONKS_BASE = 'https://api.sportmonks.com/v3/football';
const SPORTMONKS_INCLUDE =
  'fixtures;fixtures.participants;fixtures.scores;fixtures.venue;fixtures.venue.country;fixtures.round;fixtures.stage';

const APP_TO_SPORTMONKS_TEAM_ID = {
  ger: 18660,
  fra: 496,
  esp: 738,
  eng: 462,
  por: 737,
  ned: 1010,
  bel: 729,
  aut: 730,
  sui: 739,
  nor: 491,
  swe: 499,
  sco: 1161,
  cze: 731,
  cro: 1023,
  bih: 18559,
  tur: 18716,
  bra: 6,
  arg: 951,
  col: 110,
  par: 1048,
  uru: 744,
  ecu: 732,
  usa: 18571,
  mex: 454,
  can: 108,
  pan: 1028,
  hai: 1026,
  cuw: 18573,
  alg: 1030,
  mar: 489,
  sen: 498,
  egy: 733,
  gha: 485,
  zaf: 18715,
  cpv: 18572,
  civ: 1033,
  drc: 18552,
  tun: 500,
  jpn: 487,
  kor: 18567,
  aus: 18730,
  irn: 736,
  sau: 497,
  qat: 1044,
  uzb: 1051,
  jor: 1042,
  irq: 1041,
  nzl: 1049
};

const APP_TEAM_NAME = {
  ger: 'Germany', fra: 'France', esp: 'Spain', eng: 'England', por: 'Portugal', ned: 'Netherlands',
  bel: 'Belgium', aut: 'Austria', sui: 'Switzerland', nor: 'Norway', swe: 'Sweden', sco: 'Scotland',
  cze: 'Czech Republic', cro: 'Croatia', bih: 'Bosnia and Herzegovina', tur: 'Turkey', bra: 'Brazil',
  arg: 'Argentina', col: 'Colombia', par: 'Paraguay', uru: 'Uruguay', ecu: 'Ecuador', usa: 'United States',
  mex: 'Mexico', can: 'Canada', pan: 'Panama', hai: 'Haiti', cuw: 'Curacao', alg: 'Algeria', mar: 'Morocco',
  sen: 'Senegal', egy: 'Egypt', gha: 'Ghana', zaf: 'South Africa', cpv: 'Cape Verde', civ: "Côte d'Ivoire",
  drc: 'DR Congo', tun: 'Tunisia', jpn: 'Japan', kor: 'South Korea', aus: 'Australia', irn: 'Iran',
  sau: 'Saudi Arabia', qat: 'Qatar', uzb: 'Uzbekistan', jor: 'Jordan', irq: 'Iraq', nzl: 'New Zealand'
};

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  return res.json({ ok: true });
});

function normalizeName(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function extractScore(rawFixture, location) {
  const scores = rawFixture.scores || [];
  const target = scores.find((entry) => entry?.description === 'CURRENT' && entry?.score?.participant === location)
    || scores.find((entry) => entry?.score?.participant === location);

  return target?.score?.goals ?? 0;
}

function normaliseFixture(rawFixture, fallbackTeamId) {
  const participants = rawFixture.participants || [];
  const home = participants.find((participant) => participant?.meta?.location === 'home');
  const away = participants.find((participant) => participant?.meta?.location === 'away');

  const venue = rawFixture.venue || {};
  const venueCountry = venue.country || {};

  return {
    id: String(rawFixture.id),
    stage: rawFixture.stage?.name || 'Group Stage',
    round: rawFixture.round?.name || '',
    status: rawFixture.state?.name || rawFixture.result_info || '',
    kickoffUtc: rawFixture.starting_at || rawFixture.starting_at_timestamp || new Date().toISOString(),
    homeScore: extractScore(rawFixture, 'home'),
    awayScore: extractScore(rawFixture, 'away'),
    homeTeam: {
      id: String(home?.id || fallbackTeamId),
      name: home?.name || 'Home',
      flag: home?.image_path || ''
    },
    awayTeam: {
      id: String(away?.id || fallbackTeamId),
      name: away?.name || 'Away',
      flag: away?.image_path || ''
    },
    venue: {
      name: venue.name || 'Unknown venue',
      city: venue.city_name || 'Unknown city',
      country: venueCountry.name || 'Unknown country',
      timeZone: venue.timezone || 'UTC',
      image: venue.image_path || ''
    }
  };
}

function getTeamFormation(rawFixture, teamId) {
  const participants = rawFixture.participants || [];
  const target = participants.find((participant) => String(participant?.id || '') === String(teamId));

  if (target?.formation) {
    return target.formation;
  }
  if (target?.meta?.formation) {
    return target.meta.formation;
  }

  const lineups = Array.isArray(rawFixture?.lineups) ? rawFixture.lineups : [];
  const lineup = lineups.find((entry) => String(entry?.participant_id || entry?.team_id || '') === String(teamId));
  if (lineup?.formation) {
    return lineup.formation;
  }

  return '';
}

function computeGroupSummary(fixtures, teamId) {
  const base = {
    played: 0,
    won: 0,
    draw: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0
  };

  return fixtures.reduce((acc, fixture) => {
    const isHome = String(fixture.homeTeam?.id || '') === String(teamId);
    const isAway = String(fixture.awayTeam?.id || '') === String(teamId);
    if (!isHome && !isAway) {
      return acc;
    }

    const gf = isHome ? Number(fixture.homeScore || 0) : Number(fixture.awayScore || 0);
    const ga = isHome ? Number(fixture.awayScore || 0) : Number(fixture.homeScore || 0);

    acc.played += 1;
    acc.goalsFor += gf;
    acc.goalsAgainst += ga;

    if (gf > ga) {
      acc.won += 1;
      acc.points += 3;
    } else if (gf === ga) {
      acc.draw += 1;
      acc.points += 1;
    } else {
      acc.lost += 1;
    }

    return acc;
  }, base);
}

async function fetchSportMonksJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`SportMonks ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

async function fetchRssItemsForTeam(teamName) {
  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(`${teamName} football`)}&hl=de&gl=DE&ceid=DE:de`;
  const response = await fetch(rssUrl, { headers: { Accept: 'application/rss+xml,application/xml;q=0.9,*/*;q=0.8' } });

  if (!response.ok) {
    throw new Error(`RSS ${response.status}`);
  }

  const xml = await response.text();
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
  const parsed = parser.parse(xml);
  const channelItems = parsed?.rss?.channel?.item || [];
  const list = Array.isArray(channelItems) ? channelItems : [channelItems];

  return list.slice(0, 12).map((item) => ({
    title: item?.title || '',
    link: item?.link || '',
    pubDate: item?.pubDate || ''
  })).filter((item) => item.title && item.link);
}

async function resolveTeamIdBySearch(teamName, apiToken) {
  const url = `${SPORTMONKS_BASE}/teams/search/${encodeURIComponent(teamName)}?api_token=${apiToken}`;
  const body = await fetchSportMonksJson(url);
  const teams = body?.data || [];
  if (!teams.length) {
    return null;
  }

  const target = normalizeName(teamName);
  const nationalTeams = teams.filter((team) => team.type === 'national');
  const candidates = nationalTeams.length ? nationalTeams : teams;
  const exact = candidates.find((team) => normalizeName(team.name || '') === target);
  if (exact) {
    return exact.id;
  }

  return candidates[0]?.id || null;
}

async function fetchTeamFixtures(teamId, apiToken) {
  const url = `${SPORTMONKS_BASE}/teams/${teamId}?api_token=${apiToken}&include=${encodeURIComponent(SPORTMONKS_INCLUDE)}`;
  const body = await fetchSportMonksJson(url);
  return body?.data?.fixtures || [];
}

async function fetchSeasonFixtures(seasonId, apiToken) {
  const include = encodeURIComponent(SPORTMONKS_INCLUDE);
  const url = `${SPORTMONKS_BASE}/seasons/${seasonId}?api_token=${apiToken}&include=${include}`;
  const body = await fetchSportMonksJson(url);
  return Array.isArray(body?.data?.fixtures) ? body.data.fixtures : [];
}

async function fetchSeasonStandings(seasonId, apiToken) {
  const url = `${SPORTMONKS_BASE}/standings?seasons=${seasonId}&api_token=${apiToken}`;
  const body = await fetchSportMonksJson(url);
  return Array.isArray(body?.data) ? body.data : [];
}

function buildGroupAssignments(standingsData) {
  const groupsByTeamId = {};
  const groupsByLetter = {};

  for (const stageData of standingsData || []) {
    const groupName = String(stageData?.group_name || stageData?.name || stageData?.group || '');
    const letterMatch = groupName.match(/([A-L])/i);
    const groupLetter = letterMatch?.[1]?.toUpperCase() || '';

    if (!groupLetter || !stageData?.standings?.data) {
      continue;
    }

    const bucket = groupsByLetter[groupLetter] || [];

    for (const row of stageData.standings.data) {
      if (!row?.team_id) {
        continue;
      }

      const teamId = String(row.team_id);
      groupsByTeamId[teamId] = groupLetter;
      bucket.push({
        teamId,
        teamName: row.team?.name || '',
        groupName,
        groupLetter
      });
    }

    groupsByLetter[groupLetter] = bucket;
  }

  return { groupsByTeamId, groupsByLetter };
}

function buildGroupAssignmentsFromFixtures(fixtures) {
  const groupStageFixtures = (fixtures || []).filter((fixture) => /group/i.test(String(fixture?.stage || '')));
  const teamNamesById = new Map();
  const teamAdjacency = new Map();
  const fixtureTeams = new Map();

  for (const fixture of groupStageFixtures) {
    const homeId = String(fixture.homeTeam?.id || '');
    const awayId = String(fixture.awayTeam?.id || '');
    if (!homeId || !awayId) {
      continue;
    }

    const teamIds = [homeId, awayId];
    fixtureTeams.set(String(fixture.id), teamIds);

    teamNamesById.set(homeId, fixture.homeTeam?.name || teamNamesById.get(homeId) || homeId);
    teamNamesById.set(awayId, fixture.awayTeam?.name || teamNamesById.get(awayId) || awayId);

    for (const [source, target] of [[homeId, awayId], [awayId, homeId]]) {
      const neighbors = teamAdjacency.get(source) || new Set();
      neighbors.add(target);
      teamAdjacency.set(source, neighbors);
    }
  }

  const visited = new Set();
  const groups = [];

  for (const teamId of teamAdjacency.keys()) {
    if (visited.has(teamId)) {
      continue;
    }

    const stack = [teamId];
    const component = new Set();
    visited.add(teamId);

    while (stack.length > 0) {
      const current = stack.pop();
      component.add(current);

      for (const neighbor of teamAdjacency.get(current) || []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          stack.push(neighbor);
        }
      }
    }

    const componentTeamIds = Array.from(component).sort((a, b) => {
      const nameA = teamNamesById.get(a) || a;
      const nameB = teamNamesById.get(b) || b;
      return nameA.localeCompare(nameB);
    });

    const componentFixtures = groupStageFixtures.filter((fixture) => {
      const homeId = String(fixture.homeTeam?.id || '');
      const awayId = String(fixture.awayTeam?.id || '');
      return component.has(homeId) && component.has(awayId);
    });

    const earliestKickoff = componentFixtures.reduce((min, fixture) => {
      const time = new Date(fixture.kickoffUtc).getTime();
      return Number.isFinite(time) && time < min ? time : min;
    }, Number.POSITIVE_INFINITY);

    groups.push({
      teamIds: componentTeamIds,
      fixtures: componentFixtures,
      earliestKickoff: Number.isFinite(earliestKickoff) ? earliestKickoff : Number.POSITIVE_INFINITY
    });
  }

  groups.sort((a, b) => {
    if (a.earliestKickoff !== b.earliestKickoff) {
      return a.earliestKickoff - b.earliestKickoff;
    }
    return a.teamIds.join(',').localeCompare(b.teamIds.join(','));
  });

  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const groupsByTeamId = {};
  const groupsByLetter = {};

  groups.forEach((group, index) => {
    const groupLetter = letters[index] || String(index + 1);
    const entries = group.teamIds.map((teamId) => ({
      teamId,
      teamName: teamNamesById.get(teamId) || teamId,
      groupName: `Group ${groupLetter}`,
      groupLetter
    }));

    groupsByLetter[groupLetter] = entries;
    for (const entry of entries) {
      groupsByTeamId[entry.teamId] = groupLetter;
    }
  });

  return { groupsByTeamId, groupsByLetter };
}

function buildTournamentStructure(fixtures) {
  return (fixtures || []).reduce((acc, fixture) => {
    const key = fixture.stage || 'Knockout';
    const existing = acc.find((entry) => entry.stage === key);
    if (existing) {
      existing.fixtures.push(fixture);
    } else {
      acc.push({ stage: key, fixtures: [fixture] });
    }
    return acc;
  }, []);
}

function filterFixturesBySeason(rawFixtures, seasonId) {
  if (!seasonId || Number.isNaN(Number(seasonId))) {
    return rawFixtures;
  }

  const targetSeasonId = Number(seasonId);
  const strictMatches = rawFixtures.filter((fixture) => Number(fixture?.season_id) === targetSeasonId);

  // Falls die konfigurierten Season-Daten in SportMonks inkonsistent sind, lieber Daten anzeigen statt alles zu leeren.
  return strictMatches.length > 0 ? strictMatches : rawFixtures;
}

async function fetchTeamSquad(teamId, apiToken, seasonId) {
  const include = encodeURIComponent('player;player.position;player.country');
  const url = seasonId && !Number.isNaN(seasonId)
    ? `${SPORTMONKS_BASE}/squads/seasons/${seasonId}/teams/${teamId}?api_token=${apiToken}&include=${include}`
    : `${SPORTMONKS_BASE}/squads/teams/${teamId}?api_token=${apiToken}&include=${include}`;
  const body = await fetchSportMonksJson(url);
  return Array.isArray(body?.data) ? body.data : [];
}

async function resolveSportMonksTeamId(appTeamId, apiToken) {
  let sportMonksTeamId = APP_TO_SPORTMONKS_TEAM_ID[appTeamId];
  if (!sportMonksTeamId) {
    sportMonksTeamId = await resolveTeamIdBySearch(APP_TEAM_NAME[appTeamId], apiToken);
  }
  return sportMonksTeamId;
}

function normaliseSquad(squadEntries) {
  const players = squadEntries
    .map((entry) => entry?.player)
    .filter(Boolean)
    .map((player) => ({
      id: player.id,
      name: player.display_name || player.common_name || player.name || 'Unbekannt',
      position: player.position?.name || 'Spieler',
      nationality: player.country?.name || player.nationality || ''
    }))
    .sort((a, b) => {
      if (a.position !== b.position) {
        return a.position.localeCompare(b.position);
      }
      return a.name.localeCompare(b.name);
    });

  const coachCandidate = players.find((player) => /coach|trainer|manager/i.test(player.position || '')) || null;
  const coach = coachCandidate
    ? {
      id: coachCandidate.id,
      name: coachCandidate.name,
      nationality: coachCandidate.nationality || ''
    }
    : {
      id: null,
      name: 'Trainerdaten derzeit nicht verfuegbar',
      nationality: ''
    };

  const filteredPlayers = coachCandidate
    ? players.filter((player) => player.id !== coachCandidate.id)
    : players;

  return { coach, players: filteredPlayers };
}

async function ensureUsersTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(191) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function ensureFriendsAndTipsTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_friends (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(191) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user_friends_user_id (user_id),
      CONSTRAINT fk_user_friends_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS friend_tips (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      friend_id INT NOT NULL,
      fixture_id VARCHAR(120) NOT NULL,
      home_tip INT NOT NULL,
      away_tip INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_tip (user_id, friend_id, fixture_id),
      INDEX idx_friend_tips_user_id (user_id),
      INDEX idx_friend_tips_fixture_id (fixture_id),
      CONSTRAINT fk_friend_tips_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_friend_tips_friend
        FOREIGN KEY (friend_id) REFERENCES user_friends(id)
        ON DELETE CASCADE
    )
  `);
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Token fehlt.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ message: 'Token ungültig.' });
  }
}

app.get('/', (req, res) => {
  res.send('Backend läuft und Datenbankverbindung wird getestet.');
});

app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    return res.json({ ok: true, db: 'connected' });
  } catch {
    return res.status(500).json({ ok: false, db: 'error' });
  }
});

app.get('/api/fixtures/:appTeamId', async (req, res) => {
  const appTeamId = String(req.params.appTeamId || '').toLowerCase();
  const seasonId = process.env.SPORTMONKS_SEASON_ID ? Number(process.env.SPORTMONKS_SEASON_ID) : null;
  const apiToken = process.env.SPORTMONKS_API_TOKEN || process.env.SPORTMONKS_API_KEY || '';

  if (!APP_TEAM_NAME[appTeamId]) {
    return res.status(404).json({ message: `Unbekannte Team-ID: ${appTeamId}` });
  }

  if (!apiToken) {
    return res.status(500).json({
      message: 'SPORTMONKS_API_TOKEN fehlt. Bitte in backend/.env setzen.'
    });
  }

  try {
    const sportMonksTeamId = await resolveSportMonksTeamId(appTeamId, apiToken);

    if (!sportMonksTeamId) {
      return res.status(404).json({ message: 'SportMonks-Team konnte nicht aufgelost werden.' });
    }

    const rawFixtures = await fetchTeamFixtures(sportMonksTeamId, apiToken);
    const seasonFiltered = filterFixturesBySeason(rawFixtures, seasonId);

    const normalized = seasonFiltered
      .map((fixture) => normaliseFixture(fixture, appTeamId))
      .filter((fixture) => /group/i.test(fixture.stage));

    return res.json({ data: normalized, source: 'sportmonks' });
  } catch (error) {
    return res.status(502).json({
      message: 'SportMonks-Abruf fehlgeschlagen.',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/team-squad/:appTeamId', async (req, res) => {
  const appTeamId = String(req.params.appTeamId || '').toLowerCase();
  const seasonId = process.env.SPORTMONKS_SEASON_ID ? Number(process.env.SPORTMONKS_SEASON_ID) : null;
  const apiToken = process.env.SPORTMONKS_API_TOKEN || process.env.SPORTMONKS_API_KEY || '';

  if (!APP_TEAM_NAME[appTeamId]) {
    return res.status(404).json({ message: `Unbekannte Team-ID: ${appTeamId}` });
  }

  if (!apiToken) {
    return res.status(500).json({ message: 'SPORTMONKS_API_TOKEN fehlt. Bitte in backend/.env setzen.' });
  }

  try {
    const sportMonksTeamId = await resolveSportMonksTeamId(appTeamId, apiToken);
    if (!sportMonksTeamId) {
      return res.status(404).json({ message: 'SportMonks-Team konnte nicht aufgelost werden.' });
    }

    const squadEntries = await fetchTeamSquad(sportMonksTeamId, apiToken, seasonId);
    return res.json({ data: normaliseSquad(squadEntries), source: 'sportmonks' });
  } catch (error) {
    return res.status(502).json({
      message: 'SportMonks-Squad konnte nicht geladen werden.',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/groups/standings/:seasonId', async (req, res) => {
  const seasonId = Number(req.params.seasonId) || Number(process.env.SPORTMONKS_SEASON_ID) || 26618;
  const apiToken = process.env.SPORTMONKS_API_TOKEN || process.env.SPORTMONKS_API_KEY || '';

  if (!apiToken) {
    return res.status(500).json({ message: 'SPORTMONKS_API_TOKEN fehlt. Bitte in backend/.env setzen.' });
  }

  try {
    const standingsData = await fetchSeasonStandings(seasonId, apiToken);
    let assignments = buildGroupAssignments(standingsData);

    if (Object.keys(assignments.groupsByTeamId).length === 0) {
      const seasonFixtures = await fetchSeasonFixtures(seasonId, apiToken);
      assignments = buildGroupAssignmentsFromFixtures(seasonFixtures);
    }

    const { groupsByTeamId } = assignments;
    return res.json({ data: groupsByTeamId, source: 'sportmonks' });
  } catch (error) {
    return res.status(502).json({
      message: 'SportMonks-Gruppenstände konnten nicht geladen werden.',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/fixtures/group-stage/all', async (req, res) => {
  const seasonId = Number(process.env.SPORTMONKS_SEASON_ID) || 26618;
  const apiToken = process.env.SPORTMONKS_API_TOKEN || process.env.SPORTMONKS_API_KEY || '';

  if (!apiToken) {
    return res.status(500).json({ message: 'SPORTMONKS_API_TOKEN fehlt. Bitte in backend/.env setzen.' });
  }

  try {
    const rawFixtures = await fetchSeasonFixtures(seasonId, apiToken);
    const groupStageFixtures = rawFixtures
      .map((fixture) => normaliseFixture(fixture, 'season'))
      .filter((fixture) => /group/i.test(fixture.stage))
      .sort((a, b) => new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime());

    return res.json({ data: groupStageFixtures, source: 'sportmonks' });
  } catch (error) {
    return res.status(502).json({
      message: 'SportMonks-Group-Stage-Fixtures konnten nicht geladen werden.',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/next-phase/:appTeamId', async (req, res) => {
  const appTeamId = String(req.params.appTeamId || '').toLowerCase();
  const seasonId = process.env.SPORTMONKS_SEASON_ID ? Number(process.env.SPORTMONKS_SEASON_ID) : null;
  const apiToken = process.env.SPORTMONKS_API_TOKEN || process.env.SPORTMONKS_API_KEY || '';

  if (!APP_TEAM_NAME[appTeamId]) {
    return res.status(404).json({ message: `Unbekannte Team-ID: ${appTeamId}` });
  }

  if (!apiToken) {
    return res.status(500).json({ message: 'SPORTMONKS_API_TOKEN fehlt. Bitte in backend/.env setzen.' });
  }

  try {
    const sportMonksTeamId = await resolveSportMonksTeamId(appTeamId, apiToken);
    if (!sportMonksTeamId) {
      return res.status(404).json({ message: 'SportMonks-Team konnte nicht aufgelost werden.' });
    }

    let rawFixtures = await fetchTeamFixtures(sportMonksTeamId, apiToken);
    try {
      const seasonFixtures = await fetchSeasonFixtures(seasonId, apiToken);
      if (Array.isArray(seasonFixtures) && seasonFixtures.length > 0) {
        rawFixtures = seasonFixtures;
      }
    } catch {
      // Team fixtures bleiben als Fallback erhalten.
    }

    const seasonFiltered = filterFixturesBySeason(rawFixtures, seasonId);

    const nextPhase = seasonFiltered
      .map((fixture) => normaliseFixture(fixture, appTeamId))
      .filter((fixture) => !/group/i.test(fixture.stage))
      .sort((a, b) => new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime());

    return res.json({ data: nextPhase, source: 'sportmonks' });
  } catch (error) {
    return res.status(502).json({
      message: 'SportMonks-Phase nach Gruppenphase konnte nicht geladen werden.',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/team-view/:appTeamId', async (req, res) => {
  const appTeamId = String(req.params.appTeamId || '').toLowerCase();
  const seasonId = process.env.SPORTMONKS_SEASON_ID ? Number(process.env.SPORTMONKS_SEASON_ID) : null;
  const apiToken = process.env.SPORTMONKS_API_TOKEN || process.env.SPORTMONKS_API_KEY || '';

  if (!APP_TEAM_NAME[appTeamId]) {
    return res.status(404).json({ message: `Unbekannte Team-ID: ${appTeamId}` });
  }

  if (!apiToken) {
    return res.status(500).json({ message: 'SPORTMONKS_API_TOKEN fehlt. Bitte in backend/.env setzen.' });
  }

  try {
    const sportMonksTeamId = await resolveSportMonksTeamId(appTeamId, apiToken);
    if (!sportMonksTeamId) {
      return res.status(404).json({ message: 'SportMonks-Team konnte nicht aufgelost werden.' });
    }

    let rawFixtures = await fetchTeamFixtures(sportMonksTeamId, apiToken);
    let groupAssignments = { groupsByTeamId: {}, groupsByLetter: {} };

    try {
      const seasonFixtures = await fetchSeasonFixtures(seasonId, apiToken);
      if (Array.isArray(seasonFixtures) && seasonFixtures.length > 0) {
        rawFixtures = seasonFixtures;
      }
    } catch {
      // Fallback bleibt team-spezifisch.
    }

    const seasonFiltered = filterFixturesBySeason(rawFixtures, seasonId);

    try {
      const standingsData = await fetchSeasonStandings(seasonId, apiToken);
      groupAssignments = buildGroupAssignments(standingsData);
    } catch {
      groupAssignments = { groupsByTeamId: {}, groupsByLetter: {} };
    }

    const fixtureBasedAssignments = buildGroupAssignmentsFromFixtures(seasonFiltered);
    if (Object.keys(groupAssignments.groupsByTeamId).length === 0) {
      groupAssignments = fixtureBasedAssignments;
    }

    const squadEntries = await fetchTeamSquad(sportMonksTeamId, apiToken, seasonId);

    const normalized = seasonFiltered
      .map((fixture) => ({
        ...normaliseFixture(fixture, appTeamId),
        formation: getTeamFormation(fixture, sportMonksTeamId)
      }))
      .sort((a, b) => new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime());

    const selectedGroupLetter = groupAssignments.groupsByTeamId[String(sportMonksTeamId)]
      || fixtureBasedAssignments.groupsByTeamId[String(sportMonksTeamId)]
      || '';
    const groupStageFixtures = normalized.filter((fixture) => /group/i.test(fixture.stage));
    const nextPhaseFixtures = normalized.filter((fixture) => !/group/i.test(fixture.stage));

    const selectedGroupTeamIds = selectedGroupLetter
      ? Object.entries(groupAssignments.groupsByTeamId)
          .filter(([, letter]) => letter === selectedGroupLetter)
          .map(([teamId]) => teamId)
      : [];

    const groupFixtures = selectedGroupLetter && selectedGroupTeamIds.length > 0
      ? groupStageFixtures.filter((fixture) =>
          selectedGroupTeamIds.includes(String(fixture.homeTeam?.id || '')) &&
          selectedGroupTeamIds.includes(String(fixture.awayTeam?.id || ''))
        )
      : groupStageFixtures.filter((fixture) =>
          String(fixture.homeTeam?.id || '') === String(sportMonksTeamId) ||
          String(fixture.awayTeam?.id || '') === String(sportMonksTeamId)
        );

    const formations = normalized
      .filter((fixture) => fixture.formation)
      .map((fixture) => ({
        fixtureId: fixture.id,
        stage: fixture.stage,
        round: fixture.round,
        kickoffUtc: fixture.kickoffUtc,
        formation: fixture.formation,
        opponent: String(fixture.homeTeam?.id || '') === String(sportMonksTeamId)
          ? fixture.awayTeam?.name
          : fixture.homeTeam?.name
      }));

    const tournamentFixtures = nextPhaseFixtures.length > 0 ? nextPhaseFixtures : normalized;
    const groupedTournament = buildTournamentStructure(tournamentFixtures);

    return res.json({
      data: {
        squad: normaliseSquad(squadEntries),
        groupView: {
          fixtures: groupFixtures,
          summary: computeGroupSummary(groupFixtures, sportMonksTeamId),
          groupLetter: selectedGroupLetter,
          teams: selectedGroupLetter && selectedGroupTeamIds.length > 0
            ? selectedGroupTeamIds.map((teamId) => ({
                teamId,
                groupLetter: selectedGroupLetter,
                teamName:
                  groupAssignments.groupsByLetter[selectedGroupLetter]?.find((item) => item.teamId === teamId)?.teamName
                  || fixtureBasedAssignments.groupsByLetter[selectedGroupLetter]?.find((item) => item.teamId === teamId)?.teamName
                  || ''
              }))
            : []
        },
        formations,
        matchesAndResults: normalized,
        nextPhase: nextPhaseFixtures,
        tournamentStructure: groupedTournament
      },
      source: 'sportmonks'
    });
  } catch (error) {
    return res.status(502).json({
      message: 'SportMonks Team-View konnte nicht geladen werden.',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/rss/:appTeamId', async (req, res) => {
  const appTeamId = String(req.params.appTeamId || '').toLowerCase();
  const teamName = APP_TEAM_NAME[appTeamId];

  if (!teamName) {
    return res.status(404).json({ message: `Unbekannte Team-ID: ${appTeamId}` });
  }

  try {
    const items = await fetchRssItemsForTeam(teamName);
    return res.json({ data: items });
  } catch (error) {
    return res.status(502).json({
      message: 'RSS Live-Ticker konnte nicht geladen werden.',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, E-Mail und Passwort sind erforderlich.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Passwort muss mindestens 6 Zeichen haben.' });
  }

  try {
    const [existing] = await db.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'E-Mail ist bereits registriert.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name, email, passwordHash]
    );

    const token = jwt.sign(
      { userId: result.insertId, email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      token,
      user: {
        id: result.insertId,
        name,
        email
      }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Registrierung fehlgeschlagen.', details: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'E-Mail und Passwort sind erforderlich.' });
  }

  try {
    const [rows] = await db.query(
      'SELECT id, name, email, password_hash FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Ungültige Zugangsdaten.' });
    }

    const user = rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ message: 'Ungültige Zugangsdaten.' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Login fehlgeschlagen.', details: error.message });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, name, email FROM users WHERE id = ? LIMIT 1', [req.user.userId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Benutzer nicht gefunden.' });
    }

    return res.json({ user: rows[0] });
  } catch (error) {
    return res.status(500).json({ message: 'Benutzerabfrage fehlgeschlagen.', details: error.message });
  }
});

app.get('/api/friends', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, email, created_at FROM user_friends WHERE user_id = ? ORDER BY name ASC',
      [req.user.userId]
    );

    return res.json({ data: rows });
  } catch (error) {
    return res.status(500).json({ message: 'Freunde konnten nicht geladen werden.', details: error.message });
  }
});

app.post('/api/friends', authMiddleware, async (req, res) => {
  const { name, email } = req.body;

  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: 'Freundesname ist erforderlich.' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO user_friends (user_id, name, email) VALUES (?, ?, ?)',
      [req.user.userId, String(name).trim(), email ? String(email).trim() : null]
    );

    return res.status(201).json({
      friend: {
        id: result.insertId,
        name: String(name).trim(),
        email: email ? String(email).trim() : null
      }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Freund konnte nicht erstellt werden.', details: error.message });
  }
});

app.delete('/api/friends/:friendId', authMiddleware, async (req, res) => {
  const friendId = Number(req.params.friendId);

  if (!Number.isInteger(friendId) || friendId <= 0) {
    return res.status(400).json({ message: 'Ungültige Freund-ID.' });
  }

  try {
    const [result] = await db.query(
      'DELETE FROM user_friends WHERE id = ? AND user_id = ?',
      [friendId, req.user.userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Freund nicht gefunden.' });
    }

    return res.json({ ok: true, deletedId: friendId });
  } catch (error) {
    return res.status(500).json({ message: 'Freund konnte nicht entfernt werden.', details: error.message });
  }
});

app.get('/api/friend-tips', authMiddleware, async (req, res) => {
  const fixtureId = req.query.fixtureId ? String(req.query.fixtureId) : null;

  try {
    const query = fixtureId
      ? `
        SELECT t.id, t.fixture_id, t.home_tip, t.away_tip, t.friend_id, f.name AS friend_name
        FROM friend_tips t
        JOIN user_friends f ON f.id = t.friend_id
        WHERE t.user_id = ? AND t.fixture_id = ?
        ORDER BY f.name ASC
      `
      : `
        SELECT t.id, t.fixture_id, t.home_tip, t.away_tip, t.friend_id, f.name AS friend_name
        FROM friend_tips t
        JOIN user_friends f ON f.id = t.friend_id
        WHERE t.user_id = ?
        ORDER BY t.fixture_id ASC, f.name ASC
      `;

    const params = fixtureId ? [req.user.userId, fixtureId] : [req.user.userId];
    const [rows] = await db.query(query, params);

    return res.json({ data: rows });
  } catch (error) {
    return res.status(500).json({ message: 'Tipps konnten nicht geladen werden.', details: error.message });
  }
});

app.post('/api/friend-tips', authMiddleware, async (req, res) => {
  const { fixtureId, friendId, homeTip, awayTip } = req.body;

  if (!fixtureId || !friendId || homeTip === undefined || awayTip === undefined) {
    return res.status(400).json({ message: 'fixtureId, friendId, homeTip und awayTip sind erforderlich.' });
  }

  const parsedHome = Number(homeTip);
  const parsedAway = Number(awayTip);

  if (Number.isNaN(parsedHome) || Number.isNaN(parsedAway) || parsedHome < 0 || parsedAway < 0) {
    return res.status(400).json({ message: 'Tipps müssen nicht-negative Zahlen sein.' });
  }

  try {
    const [friendRows] = await db.query(
      'SELECT id FROM user_friends WHERE id = ? AND user_id = ? LIMIT 1',
      [friendId, req.user.userId]
    );

    if (!friendRows.length) {
      return res.status(404).json({ message: 'Freund nicht gefunden.' });
    }

    await db.query(
      `
        INSERT INTO friend_tips (user_id, friend_id, fixture_id, home_tip, away_tip)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE home_tip = VALUES(home_tip), away_tip = VALUES(away_tip)
      `,
      [req.user.userId, friendId, String(fixtureId), parsedHome, parsedAway]
    );

    return res.status(201).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: 'Tipp konnte nicht gespeichert werden.', details: error.message });
  }
});

ensureUsersTable()
  .then(() => ensureFriendsAndTipsTables())
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server läuft auf Port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Serverstart fehlgeschlagen:', error.message);
    process.exit(1);
  });
