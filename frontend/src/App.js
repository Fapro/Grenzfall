import React, { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

const IS_LOCAL_RUNTIME = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const CONFIGURED_API_BASE_URL = (process.env.REACT_APP_API_URL || '').trim();
const SHOULD_IGNORE_LOCALHOST_ENV =
  !IS_LOCAL_RUNTIME &&
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(CONFIGURED_API_BASE_URL);

const API_BASE_URL = (
  SHOULD_IGNORE_LOCALHOST_ENV
    ? 'https://grenzfall.onrender.com/api'
    : (CONFIGURED_API_BASE_URL
      || (IS_LOCAL_RUNTIME
        ? 'http://localhost:3001/api'
        : 'https://grenzfall.onrender.com/api'))
).replace(/\/$/, '');
const TEAM_SOUND_PATH = `${process.env.PUBLIC_URL || ''}/assets/sounds/goal-crowd-roaring_F_minor.wav`;
const ROAR_VOLUME_STORAGE_KEY = 'rooarVolume';
const ROAR_TEAM_IDS_STORAGE_KEY = 'rooarTeamIds';
const ROAR_PANEL_STORAGE_KEY = 'rooarPanelOpen';
const TENANT_SLUG_STORAGE_KEY = 'currentTenantSlug';
const VENUE_PLACEHOLDER_PATH = `${process.env.PUBLIC_URL || ''}/assets/venue-placeholder.svg`;
const GROUP_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
const HOST_VENUES = [
  { name: 'MetLife Stadium', city: 'New York', country: 'USA', timeZone: 'America/New_York' },
  { name: 'Gillette Stadium', city: 'Boston', country: 'USA', timeZone: 'America/New_York' },
  { name: 'Lincoln Financial Field', city: 'Philadelphia', country: 'USA', timeZone: 'America/New_York' },
  { name: 'SoFi Stadium', city: 'Los Angeles', country: 'USA', timeZone: 'America/Los_Angeles' },
  { name: 'AT&T Stadium', city: 'Dallas', country: 'USA', timeZone: 'America/Chicago' },
  { name: 'NRG Stadium', city: 'Houston', country: 'USA', timeZone: 'America/Chicago' },
  { name: 'Arrowhead Stadium', city: 'Kansas City', country: 'USA', timeZone: 'America/Chicago' },
  { name: 'Hard Rock Stadium', city: 'Miami', country: 'USA', timeZone: 'America/New_York' },
  { name: 'Lumen Field', city: 'Seattle', country: 'USA', timeZone: 'America/Los_Angeles' },
  { name: 'Levis Stadium', city: 'San Francisco', country: 'USA', timeZone: 'America/Los_Angeles' },
  { name: 'BC Place', city: 'Vancouver', country: 'Canada', timeZone: 'America/Vancouver' },
  { name: 'BMO Field', city: 'Toronto', country: 'Canada', timeZone: 'America/Toronto' },
  { name: 'Estadio Azteca', city: 'Mexico City', country: 'Mexico', timeZone: 'America/Mexico_City' },
  { name: 'Estadio Akron', city: 'Guadalajara', country: 'Mexico', timeZone: 'America/Mexico_City' },
  { name: 'Estadio BBVA', city: 'Monterrey', country: 'Mexico', timeZone: 'America/Monterrey' },
  { name: 'Mercedes-Benz Stadium', city: 'Atlanta', country: 'USA', timeZone: 'America/New_York' }
];
const GROUP_KEY_VENUE_CITIES = {
  A: ['Mexico City', 'Atlanta', 'Guadalajara'],
  B: ['Toronto', 'Vancouver', 'Los Angeles'],
  C: ['New York', 'Boston', 'Philadelphia', 'Seattle'],
  D: ['Los Angeles', 'Seattle'],
  E: ['Toronto', 'Kansas City', 'Dallas'],
  F: ['Dallas', 'Houston', 'Kansas City', 'Monterrey'],
  G: ['Seattle', 'Los Angeles', 'Miami', 'Vancouver'],
  H: ['Atlanta', 'Miami', 'Kansas City'],
  I: ['New York', 'Philadelphia', 'Dallas'],
  J: ['Dallas', 'Los Angeles', 'San Francisco'],
  K: ['Houston', 'Mexico City', 'Kansas City'],
  L: ['Dallas', 'Houston', 'Toronto']
};
const GROUP_MATCH_SLOTS = {
  A: [
    { day: 11, hour: 21, minute: 0, city: 'Mexico City' },
    { day: 12, hour: 4, minute: 0, city: 'Guadalajara' },
    { day: 18, hour: 18, minute: 0, city: 'Atlanta' },
    { day: 19, hour: 3, minute: 0, city: 'Guadalajara' },
    { day: 25, hour: 3, minute: 0, city: 'Mexico City' },
    { day: 25, hour: 3, minute: 0, city: 'Monterrey' }
  ],
  B: [
    { day: 12, hour: 21, minute: 0, city: 'Toronto' },
    { day: 13, hour: 21, minute: 0, city: 'Los Angeles' },
    { day: 18, hour: 21, minute: 0, city: 'Los Angeles' },
    { day: 19, hour: 0, minute: 0, city: 'Vancouver' },
    { day: 24, hour: 21, minute: 0, city: 'Vancouver' },
    { day: 24, hour: 21, minute: 0, city: 'Seattle' }
  ],
  C: [
    { day: 14, hour: 0, minute: 0, city: 'New York/NJ' },
    { day: 14, hour: 3, minute: 0, city: 'Boston/Foxborough' },
    { day: 20, hour: 0, minute: 0, city: 'Boston/Foxborough' },
    { day: 20, hour: 3, minute: 0, city: 'Philadelphia' },
    { day: 25, hour: 0, minute: 0, city: 'Miami' },
    { day: 25, hour: 0, minute: 0, city: 'Atlanta' }
  ],
  D: [
    { day: 13, hour: 3, minute: 0, city: 'Los Angeles' },
    { day: 14, hour: 6, minute: 0, city: 'Vancouver' },
    { day: 19, hour: 21, minute: 0, city: 'Seattle' },
    { day: 20, hour: 6, minute: 0, city: 'San Francisco' },
    { day: 26, hour: 4, minute: 0, city: 'Los Angeles' },
    { day: 26, hour: 4, minute: 0, city: 'San Francisco' }
  ],
  E: [
    { day: 14, hour: 19, minute: 0, city: 'Houston' },
    { day: 15, hour: 1, minute: 0, city: 'Philadelphia' },
    { day: 20, hour: 22, minute: 0, city: 'Toronto' },
    { day: 21, hour: 2, minute: 0, city: 'Kansas City' },
    { day: 25, hour: 22, minute: 0, city: 'Philadelphia' },
    { day: 25, hour: 22, minute: 0, city: 'New York/NJ' }
  ],
  F: [
    { day: 14, hour: 22, minute: 0, city: 'Dallas' },
    { day: 15, hour: 4, minute: 0, city: 'Monterrey' },
    { day: 20, hour: 19, minute: 0, city: 'Houston' },
    { day: 21, hour: 6, minute: 0, city: 'Monterrey' },
    { day: 26, hour: 1, minute: 0, city: 'Dallas' },
    { day: 26, hour: 1, minute: 0, city: 'Kansas City' }
  ],
  G: [
    { day: 15, hour: 21, minute: 0, city: 'Seattle' },
    { day: 16, hour: 3, minute: 0, city: 'Los Angeles' },
    { day: 21, hour: 21, minute: 0, city: 'Los Angeles' },
    { day: 22, hour: 3, minute: 0, city: 'Vancouver' },
    { day: 27, hour: 5, minute: 0, city: 'Seattle' },
    { day: 27, hour: 5, minute: 0, city: 'Vancouver' }
  ],
  H: [
    { day: 15, hour: 18, minute: 0, city: 'Atlanta' },
    { day: 16, hour: 0, minute: 0, city: 'Miami' },
    { day: 21, hour: 18, minute: 0, city: 'Atlanta' },
    { day: 22, hour: 0, minute: 0, city: 'Miami' },
    { day: 27, hour: 2, minute: 0, city: 'Houston' },
    { day: 27, hour: 2, minute: 0, city: 'Guadalajara' }
  ],
  I: [
    { day: 16, hour: 21, minute: 0, city: 'New York/NJ' },
    { day: 17, hour: 0, minute: 0, city: 'Boston/Foxborough' },
    { day: 22, hour: 23, minute: 0, city: 'Philadelphia' },
    { day: 23, hour: 2, minute: 0, city: 'New York/NJ' },
    { day: 26, hour: 21, minute: 0, city: 'Boston/Foxborough' },
    { day: 26, hour: 21, minute: 0, city: 'Toronto' }
  ],
  J: [
    { day: 17, hour: 3, minute: 0, city: 'Kansas City' },
    { day: 17, hour: 6, minute: 0, city: 'San Francisco' },
    { day: 22, hour: 19, minute: 0, city: 'Dallas' },
    { day: 23, hour: 5, minute: 0, city: 'San Francisco' },
    { day: 28, hour: 4, minute: 0, city: 'Kansas City' },
    { day: 28, hour: 4, minute: 0, city: 'Dallas' }
  ],
  K: [
    { day: 17, hour: 19, minute: 0, city: 'Houston' },
    { day: 18, hour: 4, minute: 0, city: 'Mexico City' },
    { day: 23, hour: 19, minute: 0, city: 'Houston' },
    { day: 24, hour: 4, minute: 0, city: 'Guadalajara' },
    { day: 28, hour: 1, minute: 30, city: 'Miami' },
    { day: 28, hour: 1, minute: 30, city: 'Atlanta' }
  ],
  L: [
    { day: 17, hour: 22, minute: 0, city: 'Dallas' },
    { day: 18, hour: 1, minute: 0, city: 'Toronto' },
    { day: 23, hour: 22, minute: 0, city: 'Boston/Foxborough' },
    { day: 24, hour: 1, minute: 0, city: 'Toronto' },
    { day: 27, hour: 23, minute: 0, city: 'New York/NJ' },
    { day: 27, hour: 23, minute: 0, city: 'Philadelphia' }
  ]
};
const TEAM_GROUP_BY_ID = {
  cze: 'A', kor: 'A', mex: 'A', zaf: 'A',
  can: 'B', qat: 'B', sui: 'B', bih: 'B',
  bra: 'C', mar: 'C', sco: 'C', hai: 'C',
  aus: 'D', tur: 'D', usa: 'D', par: 'D',
  civ: 'E', ecu: 'E', ger: 'E', cuw: 'E',
  jpn: 'F', ned: 'F', tun: 'F', swe: 'F',
  bel: 'G', egy: 'G', irn: 'G', nzl: 'G',
  cpv: 'H', sau: 'H', esp: 'H', uru: 'H',
  fra: 'I', irq: 'I', nor: 'I', sen: 'I',
  arg: 'J', aut: 'J', jor: 'J', alg: 'J',
  col: 'K', drc: 'K', por: 'K', uzb: 'K',
  eng: 'L', pan: 'L', cro: 'L', gha: 'L'
};
const COUNTRY_CODE_BY_TEAM_ID = {
  ger: 'de', fra: 'fr', esp: 'es', eng: 'gb', por: 'pt', ned: 'nl', bel: 'be', aut: 'at',
  sui: 'ch', nor: 'no', swe: 'se', sco: 'gb-sct', cze: 'cz', cro: 'hr', bih: 'ba', tur: 'tr',
  bra: 'br', arg: 'ar', col: 'co', par: 'py', uru: 'uy', ecu: 'ec', usa: 'us', mex: 'mx',
  can: 'ca', pan: 'pa', hai: 'ht', cuw: 'cw', alg: 'dz', mar: 'ma', sen: 'sn', egy: 'eg',
  gha: 'gh', zaf: 'za', cpv: 'cv', civ: 'ci', drc: 'cd', tun: 'tn', jpn: 'jp', kor: 'kr',
  aus: 'au', irn: 'ir', sau: 'sa', qat: 'qa', uzb: 'uz', jor: 'jo', irq: 'iq', nzl: 'nz'
};
const TEAMS = [
  { id: 'ger', name: 'Germany', flag: '🇩🇪', region: 'UEFA' },
  { id: 'fra', name: 'France', flag: '🇫🇷', region: 'UEFA' },
  { id: 'esp', name: 'Spain', flag: '🇪🇸', region: 'UEFA' },
  { id: 'eng', name: 'England', flag: '🇬🇧', region: 'UEFA' },
  { id: 'por', name: 'Portugal', flag: '🇵🇹', region: 'UEFA' },
  { id: 'ned', name: 'Netherlands', flag: '🇳🇱', region: 'UEFA' },
  { id: 'bel', name: 'Belgium', flag: '🇧🇪', region: 'UEFA' },
  { id: 'aut', name: 'Austria', flag: '🇦🇹', region: 'UEFA' },
  { id: 'sui', name: 'Switzerland', flag: '🇨🇭', region: 'UEFA' },
  { id: 'nor', name: 'Norway', flag: '🇳🇴', region: 'UEFA' },
  { id: 'swe', name: 'Sweden', flag: '🇸🇪', region: 'UEFA' },
  { id: 'sco', name: 'Scotland', flag: '🇬🇧', region: 'UEFA' },
  { id: 'cze', name: 'Czech Republic', flag: '🇨🇿', region: 'UEFA' },
  { id: 'cro', name: 'Croatia', flag: '🇭🇷', region: 'UEFA' },
  { id: 'bih', name: 'Bosnia and Herzegovina', flag: '🇧🇦', region: 'UEFA' },
  { id: 'tur', name: 'Turkey', flag: '🇹🇷', region: 'UEFA' },
  { id: 'bra', name: 'Brazil', flag: '🇧🇷', region: 'CONMEBOL' },
  { id: 'arg', name: 'Argentina', flag: '🇦🇷', region: 'CONMEBOL' },
  { id: 'col', name: 'Colombia', flag: '🇨🇴', region: 'CONMEBOL' },
  { id: 'par', name: 'Paraguay', flag: '🇵🇾', region: 'CONMEBOL' },
  { id: 'uru', name: 'Uruguay', flag: '🇺🇾', region: 'CONMEBOL' },
  { id: 'ecu', name: 'Ecuador', flag: '🇪🇨', region: 'CONMEBOL' },
  { id: 'usa', name: 'USA', flag: '🇺🇸', region: 'CONCACAF' },
  { id: 'mex', name: 'Mexico', flag: '🇲🇽', region: 'CONCACAF' },
  { id: 'can', name: 'Canada', flag: '🇨🇦', region: 'CONCACAF' },
  { id: 'pan', name: 'Panama', flag: '🇵🇦', region: 'CONCACAF' },
  { id: 'hai', name: 'Haiti', flag: '🇭🇹', region: 'CONCACAF' },
  { id: 'cuw', name: 'Curacao', flag: '🇨🇼', region: 'CONCACAF' },
  { id: 'alg', name: 'Algeria', flag: '🇩🇿', region: 'CAF' },
  { id: 'mar', name: 'Morocco', flag: '🇲🇦', region: 'CAF' },
  { id: 'sen', name: 'Senegal', flag: '🇸🇳', region: 'CAF' },
  { id: 'egy', name: 'Egypt', flag: '🇪🇬', region: 'CAF' },
  { id: 'gha', name: 'Ghana', flag: '🇬🇭', region: 'CAF' },
  { id: 'zaf', name: 'South Africa', flag: '🇿🇦', region: 'CAF' },
  { id: 'cpv', name: 'Cape Verde', flag: '🇨🇻', region: 'CAF' },
  { id: 'civ', name: "Cote d'Ivoire", flag: '🇨🇮', region: 'CAF' },
  { id: 'drc', name: 'DR Congo', flag: '🇨🇩', region: 'CAF' },
  { id: 'tun', name: 'Tunisia', flag: '🇹🇳', region: 'CAF' },
  { id: 'jpn', name: 'Japan', flag: '🇯🇵', region: 'AFC' },
  { id: 'kor', name: 'South Korea', flag: '🇰🇷', region: 'AFC' },
  { id: 'aus', name: 'Australia', flag: '🇦🇺', region: 'AFC' },
  { id: 'irn', name: 'Iran', flag: '🇮🇷', region: 'AFC' },
  { id: 'sau', name: 'Saudi Arabia', flag: '🇸🇦', region: 'AFC' },
  { id: 'qat', name: 'Qatar', flag: '🇶🇦', region: 'AFC' },
  { id: 'uzb', name: 'Uzbekistan', flag: '🇺🇿', region: 'AFC' },
  { id: 'jor', name: 'Jordan', flag: '🇯🇴', region: 'AFC' },
  { id: 'irq', name: 'Iraq', flag: '🇮🇶', region: 'AFC' },
  { id: 'nzl', name: 'New Zealand', flag: '🇳🇿', region: 'OFC' }
];

function formatGmtOffset(date) {
  const totalMinutes = -date.getTimezoneOffset();
  const sign = totalMinutes >= 0 ? '+' : '-';
  const absMinutes = Math.abs(totalMinutes);
  const hours = Math.floor(absMinutes / 60);
  const minutes = absMinutes % 60;
  return minutes === 0 ? `GMT${sign}${hours}` : `GMT${sign}${hours}:${String(minutes).padStart(2, '0')}`;
}

function formatClientKickoff(isoDate) {
  const date = new Date(isoDate);
  const localTime = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  }).format(date);

  return localTime;
}

function formatVenueKickoff(isoDate, timeZone) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  }).format(new Date(isoDate));
}

function normalizeCityName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function resolveVenueByCity(city) {
  const aliases = {
    newyorknj: 'newyork',
    bostonfoxborough: 'boston',
    kansas: 'kansascity'
  };

  const normalized = normalizeCityName(city);
  const target = aliases[normalized] || normalized;

  return HOST_VENUES.find((venue) => normalizeCityName(venue.city) === target) || null;
}

function buildGroupFixtures(groupLetter) {
  const groupTeamIds = Object.keys(TEAM_GROUP_BY_ID).filter((id) => TEAM_GROUP_BY_ID[id] === groupLetter);
  const groupTeams = groupTeamIds
    .map((id) => TEAMS.find((team) => team.id === id))
    .filter(Boolean)
    .slice(0, 4);

  if (groupTeams.length < 4) {
    return [];
  }

  const fixturesTemplate = [
    [0, 1],
    [2, 3],
    [0, 2],
    [1, 3],
    [0, 3],
    [1, 2]
  ];

  const groupIndex = GROUP_LETTERS.indexOf(groupLetter);
  const preferredCities = GROUP_KEY_VENUE_CITIES[groupLetter] || [];
  const slots = GROUP_MATCH_SLOTS[groupLetter] || [];
  const groupVenues = HOST_VENUES.filter((venue) => {
    const city = normalizeCityName(venue.city);
    return preferredCities.some((preferredCity) => normalizeCityName(preferredCity) === city);
  });
  const fallbackVenues = groupVenues.length > 0 ? groupVenues : HOST_VENUES;
  const baseDate = new Date(Date.UTC(2026, 5, 11 + Math.max(groupIndex, 0), 18, 0, 0));

  return fixturesTemplate.map((pair, index) => {
    const homeTeam = groupTeams[pair[0]];
    const awayTeam = groupTeams[pair[1]];
    const slot = slots[index] || null;
    const venue = (slot ? resolveVenueByCity(slot.city) : null) || fallbackVenues[index % fallbackVenues.length];
    const kickoffDate = slot
      ? new Date(Date.UTC(2026, 5, slot.day, slot.hour - 2, slot.minute || 0, 0))
      : new Date(baseDate.getTime() + index * 48 * 60 * 60 * 1000 + (index % 2) * 2 * 60 * 60 * 1000);

    return {
      id: `${groupLetter}-${homeTeam.id}-${awayTeam.id}`,
      stage: `Group ${groupLetter}`,
      kickoffUtc: kickoffDate.toISOString(),
      homeTeam,
      awayTeam,
      venue
    };
  });
}

function getVenueImageSrc(venue) {
  const raw = String(venue?.image || '').trim();
  if (!raw) {
    return '';
  }

  if (/^https?:\/\//i.test(raw) || raw.startsWith('/')) {
    return raw;
  }

  return '';
}

function getVenueFallbackSvg(venue) {
  const venueName = String(venue?.name || 'Stadium');
  const venueCity = String(venue?.city || 'Unknown city');
  const svg = `
    <svg xmlns='http://www.w3.org/2000/svg' width='320' height='180' viewBox='0 0 320 180'>
      <defs>
        <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
          <stop offset='0%' stop-color='#183124'/>
          <stop offset='100%' stop-color='#2f5b36'/>
        </linearGradient>
      </defs>
      <rect width='320' height='180' rx='14' fill='url(#g)'/>
      <rect x='24' y='106' width='272' height='26' rx='4' fill='#0c1710'/>
      <rect x='44' y='54' width='232' height='44' rx='8' fill='#e7f4e8' fill-opacity='0.2'/>
      <text x='160' y='146' text-anchor='middle' fill='#dff5e1' font-family='Arial, sans-serif' font-size='14'>${venueName}</text>
      <text x='160' y='164' text-anchor='middle' fill='#a9d9af' font-family='Arial, sans-serif' font-size='12'>${venueCity}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function getFlagImageSrc(team) {
  const id = String(team?.id || '').toLowerCase();
  const byId = COUNTRY_CODE_BY_TEAM_ID[id];
  if (byId) {
    return `https://flagcdn.com/w80/${byId}.png`;
  }

  const raw = String(team?.flag || '');
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  return '';
}

function App() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [token, setToken] = useState(localStorage.getItem('authToken') || '');
  const [tenantSlug, setTenantSlug] = useState(localStorage.getItem(TENANT_SLUG_STORAGE_KEY) || '');
  const [user, setUser] = useState(null);
  const [query, setQuery] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState(localStorage.getItem('selectedTeamId') || '');
  const [showGroupStage, setShowGroupStage] = useState(Boolean(localStorage.getItem('selectedTeamId')));
  const [teamFixtures, setTeamFixtures] = useState([]);
  const [fixturesLoading, setFixturesLoading] = useState(false);
  const [fixturesError, setFixturesError] = useState('');
  const [friends, setFriends] = useState([]);
  const [tips, setTips] = useState([]);
  const [friendName, setFriendName] = useState('');
  const [friendEmail, setFriendEmail] = useState('');
  const [rssItems, setRssItems] = useState([]);
  const [rssError, setRssError] = useState('');
  const [tipDraftByFixture, setTipDraftByFixture] = useState({});
  const [squadData, setSquadData] = useState({ coach: null, players: [] });
  const [squadLoading, setSquadLoading] = useState(false);
  const [squadError, setSquadError] = useState('');
  const [showSquadPanel, setShowSquadPanel] = useState(false);
  const [showNextPhasePanel, setShowNextPhasePanel] = useState(false);
  const [showRoarPanel, setShowRoarPanel] = useState(() => localStorage.getItem(ROAR_PANEL_STORAGE_KEY) === 'true');
  const [roarVolume, setRoarVolume] = useState(() => {
    const stored = Number(localStorage.getItem(ROAR_VOLUME_STORAGE_KEY));
    return Number.isFinite(stored) && stored >= 0 && stored <= 1 ? stored : 0.75;
  });
  const [roarTeamIds, setRoarTeamIds] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(ROAR_TEAM_IDS_STORAGE_KEY) || '[]');
      const validStored = Array.isArray(stored) ? stored.filter((teamId) => typeof teamId === 'string' && teamId.trim()) : [];
      return validStored.length > 0 ? validStored : (selectedTeamId ? [selectedTeamId] : []);
    } catch {
      return selectedTeamId ? [selectedTeamId] : [];
    }
  });
  const [nextPhaseData, setNextPhaseData] = useState([]);
  const [nextPhaseLoading, setNextPhaseLoading] = useState(false);
  const [nextPhaseError, setNextPhaseError] = useState('');
  const [selectedDiagramStageName, setSelectedDiagramStageName] = useState('');
  const [formationData, setFormationData] = useState([]);
  const [matchesResultsData, setMatchesResultsData] = useState([]);
  const [tournamentStructureData, setTournamentStructureData] = useState([]);
  const [teamViewError, setTeamViewError] = useState('');
  const lastTeamScoreRef = useRef(null);
  const roarVolumeRef = useRef(roarVolume);
  const roarAudioRef = useRef(null);
  const roarFadeTimerRef = useRef(null);
  const roarPanelAutoCloseTimerRef = useRef(null);

  const title = useMemo(() => (mode === 'login' ? 'Anmelden' : 'Konto erstellen'), [mode]);

  useEffect(() => {
    localStorage.setItem(ROAR_PANEL_STORAGE_KEY, String(showRoarPanel));
  }, [showRoarPanel]);

  function scheduleRoarPanelAutoClose() {
    if (roarPanelAutoCloseTimerRef.current) {
      clearTimeout(roarPanelAutoCloseTimerRef.current);
    }

    roarPanelAutoCloseTimerRef.current = setTimeout(() => {
      setShowRoarPanel(false);
    }, 5000);
  }

  useEffect(() => {
    if (showRoarPanel) {
      scheduleRoarPanelAutoClose();
      return;
    }

    if (roarPanelAutoCloseTimerRef.current) {
      clearTimeout(roarPanelAutoCloseTimerRef.current);
      roarPanelAutoCloseTimerRef.current = null;
    }
  }, [showRoarPanel]);

  useEffect(() => {
    return () => {
      if (roarPanelAutoCloseTimerRef.current) {
        clearTimeout(roarPanelAutoCloseTimerRef.current);
      }
      if (roarFadeTimerRef.current) {
        clearInterval(roarFadeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(ROAR_VOLUME_STORAGE_KEY, String(roarVolume));
    roarVolumeRef.current = roarVolume;
    if (roarAudioRef.current) {
      roarAudioRef.current.volume = Math.max(0, Math.min(1, Number(roarVolume) || 0));
    }
  }, [roarVolume]);

  useEffect(() => {
    const audio = new Audio(TEAM_SOUND_PATH);
    audio.preload = 'auto';
    audio.volume = Math.max(0, Math.min(1, Number(roarVolumeRef.current) || 0));
    roarAudioRef.current = audio;

    return () => {
      if (roarAudioRef.current) {
        roarAudioRef.current.pause();
        roarAudioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(ROAR_TEAM_IDS_STORAGE_KEY, JSON.stringify(roarTeamIds));
  }, [roarTeamIds]);

  const groupedTeams = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = !q
      ? TEAMS
      : TEAMS.filter((team) => team.name.toLowerCase().includes(q) || team.region.toLowerCase().includes(q));

    const groups = GROUP_LETTERS.map((letter) => [letter, []]);
    const idxMap = new Map(GROUP_LETTERS.map((letter, index) => [letter, index]));

    filtered
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((team) => {
        const letter = TEAM_GROUP_BY_ID[team.id] || 'L';
        const idx = idxMap.get(letter);
        if (idx !== undefined) {
          groups[idx][1].push(team);
        }
      });

    return q ? groups.filter(([, teams]) => teams.length > 0) : groups;
  }, [query]);

  function persistTenantSlug(nextSlug) {
    const normalizedSlug = String(nextSlug || '').trim().toLowerCase();

    if (normalizedSlug) {
      localStorage.setItem(TENANT_SLUG_STORAGE_KEY, normalizedSlug);
    } else {
      localStorage.removeItem(TENANT_SLUG_STORAGE_KEY);
    }

    setTenantSlug(normalizedSlug);
  }

  function resolveTenantSlugFromPayload(payload) {
    if (payload?.tenant?.slug) {
      return String(payload.tenant.slug).trim().toLowerCase();
    }

    if (Array.isArray(payload?.tenants)) {
      const match = payload.tenants.find((tenant) => tenant?.slug);
      if (match?.slug) {
        return String(match.slug).trim().toLowerCase();
      }
    }

    if (Array.isArray(payload?.memberships)) {
      const match = payload.memberships.find((membership) => membership?.tenant?.slug);
      if (match?.tenant?.slug) {
        return String(match.tenant.slug).trim().toLowerCase();
      }
    }

    return '';
  }

  function buildAuthHeaders(extraHeaders = {}) {
    return {
      ...extraHeaders,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(tenantSlug ? { 'X-Tenant-Slug': tenantSlug } : {}),
    };
  }

  function flattenFriendTips(friendRows) {
    return (Array.isArray(friendRows) ? friendRows : []).flatMap((friend) => {
      const tipsByFixture = friend?.tips && typeof friend.tips === 'object' ? friend.tips : {};

      return Object.entries(tipsByFixture)
        .filter(([, tip]) => tip && typeof tip === 'object')
        .map(([fixtureId, tip]) => ({
          id: `${friend.id}:${fixtureId}`,
          fixture_id: fixtureId,
          friend_id: friend.id,
          friend_name: friend.name,
          home_tip: String(tip.home ?? ''),
          away_tip: String(tip.away ?? ''),
        }));
    });
  }

  function buildCurrentUserTipsPayload(currentTips, currentUserId) {
    if (!currentUserId) {
      return {};
    }

    return currentTips.reduce((acc, tip) => {
      if (String(tip.friend_id) !== String(currentUserId)) {
        return acc;
      }

      acc[String(tip.fixture_id)] = {
        home: String(tip.home_tip ?? ''),
        away: String(tip.away_tip ?? ''),
      };
      return acc;
    }, {});
  }

  async function loadMe(currentToken) {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${currentToken}` }
    });

    if (!response.ok) {
      throw new Error('Session konnte nicht geladen werden.');
    }

    const data = await response.json();
    setUser(data.user);
    persistTenantSlug(tenantSlug || resolveTenantSlugFromPayload(data));
  }

  useEffect(() => {
    if (!token) {
      setUser(null);
      setShowGroupStage(false);
      return;
    }

    loadMe(token).catch(() => {
      localStorage.removeItem('authToken');
      setToken('');
      setUser(null);
    });
  }, [token]);

  async function submitForm(event) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/signup';
      const payload = mode === 'login'
        ? { email: form.email, password: form.password }
        : { name: form.name, email: form.email, password: form.password };

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Anfrage fehlgeschlagen.');
      }

      localStorage.setItem('authToken', data.token);
      setToken(data.token);
      setUser(data.user);
      persistTenantSlug(resolveTenantSlugFromPayload(data));
      setForm({ name: '', email: '', password: '' });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem(TENANT_SLUG_STORAGE_KEY);
    setToken('');
    setTenantSlug('');
    setUser(null);
  }

  function playRoar() {
    const audio = roarAudioRef.current || new Audio(TEAM_SOUND_PATH);
    audio.volume = Math.max(0, Math.min(1, Number(roarVolumeRef.current) || 0));
    audio.currentTime = 0;
    roarAudioRef.current = audio;

    if (roarFadeTimerRef.current) {
      clearInterval(roarFadeTimerRef.current);
      roarFadeTimerRef.current = null;
    }

    audio.play().catch(() => {
      // Browser kann Audio blocken, wenn kein direkter User-Klick vorlag.
    });

    const fadeDurationMs = 1000;
    const fadeStepMs = 120;

    const startFadeOut = () => {
      if (roarFadeTimerRef.current) {
        clearInterval(roarFadeTimerRef.current);
      }

      const startVolume = Math.max(0, Math.min(1, Number(roarVolumeRef.current) || 0));
      const fadeStart = Math.max(0, (audio.duration || 0) * 1000 - fadeDurationMs);

      window.setTimeout(() => {
        let steps = Math.max(1, Math.ceil(fadeDurationMs / fadeStepMs));
        roarFadeTimerRef.current = window.setInterval(() => {
          steps -= 1;
          const nextVolume = Math.max(0, (startVolume * steps) / Math.max(1, Math.ceil(fadeDurationMs / fadeStepMs)));
          audio.volume = nextVolume;

          if (steps <= 0) {
            clearInterval(roarFadeTimerRef.current);
            roarFadeTimerRef.current = null;
            audio.volume = 0;
          }
        }, fadeStepMs);
      }, Math.max(0, fadeStart));
    };

    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      startFadeOut();
    } else {
      const onLoadedMetadata = () => {
        audio.removeEventListener('loadedmetadata', onLoadedMetadata);
        startFadeOut();
      };
      audio.addEventListener('loadedmetadata', onLoadedMetadata);
    }
  }

  function toggleRoarTeam(teamId) {
    scheduleRoarPanelAutoClose();
    setRoarTeamIds((prev) => {
      const next = new Set(prev.filter(Boolean));
      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.add(teamId);
      }

      const nextList = Array.from(next);
      return nextList.length > 0 ? nextList : [selectedTeamId || teamId];
    });
  }

  function buildGoogleCalendarUrl(fixture, team) {
    const startDate = new Date(fixture.kickoffUtc);
    const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
    const toGoogleDate = (date) => date.toISOString().replace(/[-:]/g, '').replace('.000', '');
    const opponent = fixture.homeTeam.name === team.name ? fixture.awayTeam.name : fixture.homeTeam.name;
    const text = `${team.name} vs ${opponent} (Group Stage)`;
    const localKickoff = formatClientKickoff(fixture.kickoffUtc);
    const venueKickoff = formatVenueKickoff(fixture.kickoffUtc, fixture.venue.timeZone);
    const details = `Venue: ${fixture.venue.name}, ${fixture.venue.city}\nVenue kickoff: ${venueKickoff}\nYour local time: ${localKickoff}`;
    const location = `${fixture.venue.name}, ${fixture.venue.city}, ${fixture.venue.country}`;

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(text)}&dates=${toGoogleDate(startDate)}/${toGoogleDate(endDate)}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}`;
  }

  function buildIcs(fixtures, team) {
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Rooar//Group Stage//DE'
    ];

    fixtures.forEach((fixture) => {
      const startDate = new Date(fixture.kickoffUtc);
      const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
      const toIcsDate = (date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      const opponent = fixture.homeTeam.name === team.name ? fixture.awayTeam.name : fixture.homeTeam.name;

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${fixture.id}@rooar.local`);
      lines.push(`DTSTAMP:${toIcsDate(new Date())}`);
      lines.push(`DTSTART:${toIcsDate(startDate)}`);
      lines.push(`DTEND:${toIcsDate(endDate)}`);
      lines.push(`SUMMARY:${team.name} vs ${opponent}`);
      lines.push(`LOCATION:${fixture.venue.name}, ${fixture.venue.city}, ${fixture.venue.country}`);
      lines.push(`DESCRIPTION:Group Stage - ${fixture.stage}`);
      lines.push('END:VEVENT');
    });

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  function downloadIcs(fixtures, team) {
    if (!fixtures.length || !team) {
      return;
    }
    const content = buildIcs(fixtures, team);
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `group-stage-${team.id}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function normalizeNameLocal(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  const TEAM_NAME_ALIASES = {
    usa: 'usa',
    unitedstates: 'usa',
    usmnt: 'usa',
    turkey: 'tur',
    turkiye: 'tur'
  };

  function resolveLocalTeam(teamId, teamName) {
    const rawId = String(teamId || '').toLowerCase();
    if (rawId) {
      const byId = TEAMS.find((team) => team.id === rawId);
      if (byId) {
        return byId;
      }
    }

    const normalizedName = normalizeNameLocal(teamName || '');
    if (!normalizedName) {
      return null;
    }

    const aliasId = TEAM_NAME_ALIASES[normalizedName];
    if (aliasId) {
      return TEAMS.find((team) => team.id === aliasId) || null;
    }

    return TEAMS.find((team) => normalizeNameLocal(team.name) === normalizedName) || null;
  }

  function getCanonicalTeamName(teamId, fallbackName) {
    return resolveLocalTeam(teamId, fallbackName)?.name || fallbackName || String(teamId || '');
  }

  function getCanonicalTeamMeta(teamId, fallbackName) {
    const localTeam = resolveLocalTeam(teamId, fallbackName);
    if (localTeam) {
      return localTeam;
    }

    return {
      id: String(teamId || '').toLowerCase(),
      name: fallbackName || String(teamId || ''),
      flag: '🏳️'
    };
  }

  function enrichFixtureTeams(fixtures) {
    return fixtures.map((fixture) => {
      const homeLocal = resolveLocalTeam(fixture.homeTeam?.id, fixture.homeTeam?.name);
      const awayLocal = resolveLocalTeam(fixture.awayTeam?.id, fixture.awayTeam?.name);

      return {
        ...fixture,
        homeTeam: {
          ...fixture.homeTeam,
          id: fixture.homeTeam?.id || homeLocal?.id || '',
          name: homeLocal?.name || fixture.homeTeam?.name || 'Home',
          flag: homeLocal?.flag || fixture.homeTeam?.flag || '🏳️'
        },
        awayTeam: {
          ...fixture.awayTeam,
          id: fixture.awayTeam?.id || awayLocal?.id || '',
          name: awayLocal?.name || fixture.awayTeam?.name || 'Away',
          flag: awayLocal?.flag || fixture.awayTeam?.flag || '🏳️'
        }
      };
    });
  }

  function selectedTeamsScoreFromFixtures(fixtures, teamIds) {
    const selectedIds = new Set((Array.isArray(teamIds) ? teamIds : []).map((teamId) => String(teamId)));
    if (selectedIds.size === 0) {
      return 0;
    }

    return fixtures.reduce((acc, fixture) => {
      const homeId = String(fixture.homeTeam?.id || '').toLowerCase();
      const awayId = String(fixture.awayTeam?.id || '').toLowerCase();
      if (selectedIds.has(homeId)) {
        acc += Number(fixture.homeScore || 0);
      }
      if (selectedIds.has(awayId)) {
        acc += Number(fixture.awayScore || 0);
      }
      return acc;
    }, 0);
  }

  function parseFixtureKickoffMs(fixture) {
    const kickoffUtc = String(fixture?.kickoffUtc || '').trim();
    if (!kickoffUtc) {
      return null;
    }

    const kickoffMs = Date.parse(kickoffUtc);
    return Number.isFinite(kickoffMs) ? kickoffMs : null;
  }

  function isGroupStageName(stageName) {
    return /group/i.test(String(stageName || ''));
  }

  function isFixturePlayed(fixture) {
    const status = String(fixture?.status || '').trim().toLowerCase();
    const hasResultStatus = status && !/(not started|upcoming|scheduled|to be announced|postponed|canceled|cancelled)/i.test(status);
    const homeGoals = Number(fixture?.homeScore || 0);
    const awayGoals = Number(fixture?.awayScore || 0);
    const hasNumericResult = Number.isFinite(homeGoals) && Number.isFinite(awayGoals) && (homeGoals > 0 || awayGoals > 0);
    return Boolean(hasResultStatus || hasNumericResult);
  }

  function buildProjectedNextPhaseFixtures(groupLetter, standingsRows) {
    if (!groupLetter || !Array.isArray(standingsRows) || standingsRows.length < 2) {
      return [];
    }

    const topTwo = standingsRows.slice(0, 2).map((row) => getCanonicalTeamMeta(row.teamId, row.teamName));
    if (topTwo.length < 2) {
      return [];
    }

    const kickoffDate = new Date(Date.UTC(2026, 6, 1, 18, 0, 0));
    const venue = HOST_VENUES[0] || {
      name: 'TBD Stadium',
      city: 'TBD',
      country: 'USA',
      timeZone: 'America/New_York',
      image: ''
    };

    return [
      {
        id: `projected-${groupLetter}-${topTwo[0].id}-${topTwo[1].id}`,
        stage: 'Round of 32',
        round: 'Projected',
        kickoffUtc: kickoffDate.toISOString(),
        homeScore: 0,
        awayScore: 0,
        homeTeam: {
          id: topTwo[0].id,
          name: topTwo[0].name,
          flag: topTwo[0].flag || '🏳️'
        },
        awayTeam: {
          id: topTwo[1].id,
          name: topTwo[1].name,
          flag: topTwo[1].flag || '🏳️'
        },
        venue: {
          ...venue,
          image: ''
        }
      }
    ];
  }

  function buildLiveTickerItems(fixtures, teamName) {
    const nowMs = Date.now();

    const sortedFixtures = [...(Array.isArray(fixtures) ? fixtures : [])].sort((a, b) => {
      const kickoffA = parseFixtureKickoffMs(a);
      const kickoffB = parseFixtureKickoffMs(b);
      if (kickoffA === null && kickoffB === null) {
        return 0;
      }
      if (kickoffA === null) {
        return 1;
      }
      if (kickoffB === null) {
        return -1;
      }
      return kickoffA - kickoffB;
    });

    const tickerRows = sortedFixtures.slice(0, 8).map((fixture) => {
      const homeName = String(fixture.homeTeam?.name || 'Home');
      const awayName = String(fixture.awayTeam?.name || 'Away');
      const homeScore = Number(fixture.homeScore || 0);
      const awayScore = Number(fixture.awayScore || 0);

      const kickoffMs = parseFixtureKickoffMs(fixture);
      const elapsedMinutes = kickoffMs === null ? null : Math.floor((nowMs - kickoffMs) / 60000);
      const isStarted = elapsedMinutes !== null && elapsedMinutes >= 0;
      const isLikelyLive = isStarted && elapsedMinutes <= 150;
      const hasScore = homeScore > 0 || awayScore > 0;

      if (!isStarted) {
        const kickoffLabel = fixture.kickoffUtc ? formatClientKickoff(fixture.kickoffUtc) : 'Zeit offen';
        return { title: `${homeName} vs ${awayName} - Start ${kickoffLabel}` };
      }

      if (isLikelyLive) {
        const minuteLabel = elapsedMinutes !== null ? `${Math.max(1, Math.min(elapsedMinutes, 120))}'` : "'";
        if (hasScore || (elapsedMinutes !== null && elapsedMinutes >= 1)) {
          return { title: `LIVE ${minuteLabel}: ${homeName} ${homeScore}:${awayScore} ${awayName}` };
        }
      }

      return { title: `FT: ${homeName} ${homeScore}:${awayScore} ${awayName}` };
    });

    if (tickerRows.length > 0) {
      return tickerRows;
    }

    return [{ title: `${teamName}: Keine aktuellen Spiele verfuegbar.` }];
  }

  function loadTipsForFixture(fixtureId) {
    return tips.filter((tip) => String(tip.fixture_id) === String(fixtureId));
  }

  function getOutcome(home, away) {
    if (home > away) {
      return 'home';
    }
    if (away > home) {
      return 'away';
    }
    return 'draw';
  }

  function calculateTipPoints(tip, fixture) {
    const tipHome = Number(tip.home_tip);
    const tipAway = Number(tip.away_tip);
    const realHome = Number(fixture.homeScore || 0);
    const realAway = Number(fixture.awayScore || 0);

    if (tipHome === realHome && tipAway === realAway) {
      return 3;
    }

    if (getOutcome(tipHome, tipAway) === getOutcome(realHome, realAway)) {
      return 2;
    }

    return 0;
  }

  function getTipDraft(fixtureId) {
    return tipDraftByFixture[fixtureId] || { friendId: '', homeTip: '', awayTip: '' };
  }

  function setTipDraft(fixtureId, patch) {
    setTipDraftByFixture((prev) => ({
      ...prev,
      [fixtureId]: {
        ...getTipDraft(fixtureId),
        ...patch
      }
    }));
  }

  function chooseTeam(teamId) {
    setSelectedTeamId(teamId);
    localStorage.setItem('selectedTeamId', teamId);
    playRoar();
    setShowGroupStage(true);
    setTeamFixtures([]);
    setFixturesError('');
    setRoarTeamIds((prev) => (prev.includes(teamId) ? prev : [...prev, teamId]));
  }

  function renderRows(teams) {
    const rows = [];
    for (let i = 0; i < teams.length; i += 4) {
      rows.push(teams.slice(i, i + 4));
    }
    return rows;
  }

  const selectedTeam = TEAMS.find((team) => team.id === selectedTeamId) || null;
  const selectedGroupLetter = selectedTeam ? (TEAM_GROUP_BY_ID[selectedTeam.id] || null) : null;
  const localFallbackGroupFixtures = useMemo(() => {
    if (!selectedGroupLetter) {
      return [];
    }

    return buildGroupFixtures(selectedGroupLetter);
  }, [selectedGroupLetter]);

  const selectedGroupFixtures = useMemo(() => {
    if (!selectedGroupLetter) {
      return [];
    }

    const canonicalGroupTeamIds = new Set(
      Object.keys(TEAM_GROUP_BY_ID).filter((teamId) => TEAM_GROUP_BY_ID[teamId] === selectedGroupLetter)
    );

    const normalizeFixtureTeamId = (teamId, teamName) => {
      const localTeam = resolveLocalTeam(teamId, teamName);
      if (localTeam?.id) {
        return localTeam.id;
      }
      return String(teamId || '').toLowerCase();
    };

    const liveCandidates = [...teamFixtures]
      .map((fixture) => {
        const homeId = normalizeFixtureTeamId(fixture.homeTeam?.id, fixture.homeTeam?.name);
        const awayId = normalizeFixtureTeamId(fixture.awayTeam?.id, fixture.awayTeam?.name);
        return {
          fixture,
          homeId,
          awayId
        };
      })
      .filter((row) => canonicalGroupTeamIds.has(row.homeId) && canonicalGroupTeamIds.has(row.awayId));

    const fixtureByPairKey = new Map();
    liveCandidates.forEach((row) => {
      const pairKey = [row.homeId, row.awayId].sort().join('::');
      fixtureByPairKey.set(pairKey, row.fixture);
    });

    const mergedFixtures = localFallbackGroupFixtures.map((fixture) => {
      const homeId = String(fixture.homeTeam?.id || '').toLowerCase();
      const awayId = String(fixture.awayTeam?.id || '').toLowerCase();
      const pairKey = [homeId, awayId].sort().join('::');
      const liveFixture = fixtureByPairKey.get(pairKey);

      if (!liveFixture) {
        return {
          ...fixture,
          homeScore: Number(fixture.homeScore || 0),
          awayScore: Number(fixture.awayScore || 0)
        };
      }

      return {
        ...fixture,
        ...liveFixture,
        stage: liveFixture.stage || fixture.stage,
        kickoffUtc: liveFixture.kickoffUtc || fixture.kickoffUtc,
        homeTeam: {
          ...fixture.homeTeam,
          ...liveFixture.homeTeam,
          id: fixture.homeTeam?.id || liveFixture.homeTeam?.id || ''
        },
        awayTeam: {
          ...fixture.awayTeam,
          ...liveFixture.awayTeam,
          id: fixture.awayTeam?.id || liveFixture.awayTeam?.id || ''
        },
        venue: {
          ...fixture.venue,
          ...liveFixture.venue
        },
        homeScore: Number(liveFixture.homeScore || 0),
        awayScore: Number(liveFixture.awayScore || 0)
      };
    });

    if (mergedFixtures.length > 0) {
      return mergedFixtures;
    }

    if (liveCandidates.length > 0) {
      return liveCandidates.map((row) => row.fixture);
    }

    return localFallbackGroupFixtures;
  }, [localFallbackGroupFixtures, selectedGroupLetter, teamFixtures]);

  const selectedGroupTeams = useMemo(() => {
    if (!selectedGroupLetter) {
      return [];
    }
    return TEAMS.filter((team) => TEAM_GROUP_BY_ID[team.id] === selectedGroupLetter).sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedGroupLetter]);

  const tickerText = useMemo(() => {
    if (!rssItems.length) {
      return rssError || 'Live-Ticker derzeit nicht verfuegbar.';
    }
    return rssItems.map((item) => item.title).join('   •   ');
  }, [rssError, rssItems]);

  const friendPointsTable = useMemo(() => {
    const pointsByFriend = new Map();

    selectedGroupFixtures.forEach((fixture) => {
      const fixtureTips = loadTipsForFixture(fixture.id);
      fixtureTips.forEach((tip) => {
        const key = String(tip.friend_id || tip.friend_name);
        const prev = pointsByFriend.get(key) || {
          friendId: tip.friend_id,
          friendName: tip.friend_name,
          points: 0,
          exactHits: 0,
          tipsCount: 0
        };

        const points = calculateTipPoints(tip, fixture);
        prev.points += points;
        prev.tipsCount += 1;
        if (points === 3) {
          prev.exactHits += 1;
        }

        pointsByFriend.set(key, prev);
      });
    });

    return Array.from(pointsByFriend.values()).sort((a, b) => {
      if (b.points !== a.points) {
        return b.points - a.points;
      }
      if (b.exactHits !== a.exactHits) {
        return b.exactHits - a.exactHits;
      }
      return String(a.friendName).localeCompare(String(b.friendName));
    });
  }, [selectedGroupFixtures, tips]);

  const groupStandings = useMemo(() => {
    const table = new Map();

    const resolveCanonicalTeamKey = (teamId, teamName) => {
      const rawId = String(teamId || '').toLowerCase();
      if (rawId && TEAM_GROUP_BY_ID[rawId]) {
        return rawId;
      }

      const localMatch = resolveLocalTeam(teamId, teamName);
      if (localMatch?.id) {
        return localMatch.id;
      }

      const normalizedName = normalizeNameLocal(teamName || '');

      return rawId || normalizedName;
    };

    const ensureTeam = (teamId, teamName) => {
      const key = resolveCanonicalTeamKey(teamId, teamName);
      if (!key) {
        return null;
      }

      const canonicalName = TEAMS.find((team) => team.id === key)?.name
        || teamName
        || key;

      if (!table.has(key)) {
        table.set(key, {
          teamId: key,
          teamName: canonicalName,
          played: 0,
          won: 0,
          draw: 0,
          lost: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDiff: 0,
          points: 0
        });
      } else if (canonicalName && !table.get(key).teamName) {
        table.get(key).teamName = canonicalName;
      }

      return table.get(key);
    };

    selectedGroupTeams.forEach((team) => {
      ensureTeam(team.id, team.name);
    });

    selectedGroupFixtures.forEach((fixture) => {
      const homeId = String(fixture.homeTeam?.id || '').toLowerCase();
      const awayId = String(fixture.awayTeam?.id || '').toLowerCase();
      const homeRow = ensureTeam(homeId, fixture.homeTeam?.name || homeId);
      const awayRow = ensureTeam(awayId, fixture.awayTeam?.name || awayId);

      if (!homeRow || !awayRow) {
        return;
      }

      const status = String(fixture.status || '').trim().toLowerCase();
      const hasResultStatus = status && !/(not started|upcoming|scheduled|to be announced|postponed|canceled|cancelled)/i.test(status);
      const homeGoals = Number(fixture.homeScore || 0);
      const awayGoals = Number(fixture.awayScore || 0);
      const hasNumericResult = Number.isFinite(homeGoals) && Number.isFinite(awayGoals) && (homeGoals > 0 || awayGoals > 0);
      const isPlayed = hasResultStatus || hasNumericResult;

      if (!isPlayed) {
        return;
      }

      homeRow.played += 1;
      awayRow.played += 1;
      homeRow.goalsFor += homeGoals;
      homeRow.goalsAgainst += awayGoals;
      awayRow.goalsFor += awayGoals;
      awayRow.goalsAgainst += homeGoals;

      if (homeGoals > awayGoals) {
        homeRow.won += 1;
        awayRow.lost += 1;
        homeRow.points += 3;
      } else if (homeGoals < awayGoals) {
        awayRow.won += 1;
        homeRow.lost += 1;
        awayRow.points += 3;
      } else {
        homeRow.draw += 1;
        awayRow.draw += 1;
        homeRow.points += 1;
        awayRow.points += 1;
      }
    });

    const rows = Array.from(table.values()).map((row) => ({
      ...row,
      goalDiff: row.goalsFor - row.goalsAgainst
    }));

    rows.sort((a, b) => {
      if (b.points !== a.points) {
        return b.points - a.points;
      }
      if (b.goalDiff !== a.goalDiff) {
        return b.goalDiff - a.goalDiff;
      }
      if (b.goalsFor !== a.goalsFor) {
        return b.goalsFor - a.goalsFor;
      }
      return String(a.teamName || '').localeCompare(String(b.teamName || ''));
    });

    return rows.map((row, index) => ({ ...row, rank: index + 1 }));
  }, [selectedGroupFixtures, selectedGroupTeams]);

  useEffect(() => {
    if (!showGroupStage || !selectedTeam) {
      setNextPhaseData([]);
      setMatchesResultsData([]);
      setTournamentStructureData([]);
      setNextPhaseLoading(false);
      setNextPhaseError('');
      setTeamViewError('');
      return;
    }

    const sortedTeamFixtures = [...(Array.isArray(teamFixtures) ? teamFixtures : [])].sort((a, b) => {
      const aKickoff = parseFixtureKickoffMs(a);
      const bKickoff = parseFixtureKickoffMs(b);
      if (aKickoff === null && bKickoff === null) return 0;
      if (aKickoff === null) return 1;
      if (bKickoff === null) return -1;
      return aKickoff - bKickoff;
    });

    const playedFixtures = sortedTeamFixtures.filter((fixture) => isFixturePlayed(fixture));
    const matchRows = playedFixtures.length > 0
      ? playedFixtures
      : (sortedTeamFixtures.length > 0 ? sortedTeamFixtures : selectedGroupFixtures);
    setMatchesResultsData(matchRows);

    let knockoutFixtures = sortedTeamFixtures.filter((fixture) => !isGroupStageName(fixture.stage));
    const nowMs = Date.now();
    let upcomingKnockout = knockoutFixtures.filter((fixture) => {
      const kickoffMs = parseFixtureKickoffMs(fixture);
      return kickoffMs === null || kickoffMs >= nowMs - 3 * 60 * 60 * 1000;
    });

    if (knockoutFixtures.length === 0) {
      const projected = buildProjectedNextPhaseFixtures(selectedGroupLetter, groupStandings);
      knockoutFixtures = projected;
      upcomingKnockout = projected;
    }

    const fixturesByStage = new Map();
    knockoutFixtures.forEach((fixture) => {
      const stageName = String(fixture.stage || 'Knockout').trim() || 'Knockout';
      const rows = fixturesByStage.get(stageName) || [];
      rows.push(fixture);
      fixturesByStage.set(stageName, rows);
    });

    const stageRows = Array.from(fixturesByStage.entries()).map(([stage, fixtures]) => ({
      stage,
      fixtures: [...fixtures].sort((a, b) => {
        const aKickoff = parseFixtureKickoffMs(a);
        const bKickoff = parseFixtureKickoffMs(b);
        if (aKickoff === null && bKickoff === null) return 0;
        if (aKickoff === null) return 1;
        if (bKickoff === null) return -1;
        return aKickoff - bKickoff;
      })
    }));

    setTournamentStructureData(stageRows);
    setNextPhaseData(upcomingKnockout.slice(0, 12));
    setNextPhaseLoading(false);
    setNextPhaseError('');
    setTeamViewError('');
  }, [groupStandings, selectedGroupFixtures, selectedGroupLetter, selectedTeam, showGroupStage, teamFixtures]);

  const tournamentBracketStages = useMemo(() => {
    const orderMap = {
      'Play-offs': 1,
      'Round of 32': 2,
      'Round of 16': 3,
      'Quarter-finals': 4,
      'Semi-finals': 5,
      '3rd Place Final': 6,
      'Final': 7
    };

    return [...tournamentStructureData].sort((a, b) => {
      const aName = String(a?.stage || '');
      const bName = String(b?.stage || '');
      const aOrder = orderMap[aName] ?? 999;
      const bOrder = orderMap[bName] ?? 999;
      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      return aName.localeCompare(bName);
    });
  }, [tournamentStructureData]);

  const selectedDiagramStage = useMemo(
    () => tournamentBracketStages.find((stage) => stage.stage === selectedDiagramStageName) || null,
    [selectedDiagramStageName, tournamentBracketStages]
  );

  useEffect(() => {
    if (!selectedDiagramStage) {
      return;
    }

    function closeOnEscape(event) {
      if (event.key === 'Escape') {
        setSelectedDiagramStageName('');
      }
    }

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedDiagramStage]);

  const latestFormation = useMemo(() => {
    if (!formationData.length) {
      return '';
    }
    return String(formationData[0].formation || '').trim();
  }, [formationData]);

  const formationRows = useMemo(() => {
    const parts = latestFormation
      .split('-')
      .map((item) => Number(item))
      .filter((n) => !Number.isNaN(n) && n > 0);

    const defendersCount = parts[0] || 4;
    const midfieldCount = parts[1] || 3;
    const attackersCount = parts[2] || 3;

    const players = Array.isArray(squadData?.players) ? squadData.players : [];
    const goalkeepers = players.filter((p) => /goalkeeper|\bgk\b/i.test(String(p.position || '')));
    const defenders = players.filter((p) => /defender|\bdef\b/i.test(String(p.position || '')));
    const midfielders = players.filter((p) => /midfielder|\bmid\b/i.test(String(p.position || '')));
    const attackers = players.filter((p) => /attacker|forward|striker|winger|\batt\b/i.test(String(p.position || '')));

    const gk = goalkeepers.slice(0, 1);
    const defRow = defenders.slice(0, defendersCount);
    const midRow = midfielders.slice(0, midfieldCount);
    const attRow = attackers.slice(0, attackersCount);

    return [attRow, midRow, defRow, gk].filter((row) => row.length > 0);
  }, [latestFormation, squadData]);

  function shortPlayerName(name) {
    const value = String(name || '').trim();
    if (!value) {
      return 'Player';
    }
    const parts = value.split(/\s+/).filter(Boolean);
    return parts.length > 1 ? parts[parts.length - 1] : parts[0];
  }

  useEffect(() => {
    if (!showGroupStage || !selectedTeam) {
      return;
    }

    let cancelled = false;

    async function loadTeamFixtures() {
      setFixturesLoading(true);
      setFixturesError('');

      try {
        const response = await fetch(`${API_BASE_URL}/fixtures/${selectedTeam.id}`, {
          headers: buildAuthHeaders()
        });
        const json = await response.json();

        if (!response.ok) {
          throw new Error(json.error || json.message || 'Fixtures konnten nicht geladen werden.');
        }

        const enriched = enrichFixtureTeams(json.data || []);
        const activeRoarTeamIds = roarTeamIds.length > 0 ? roarTeamIds : [selectedTeam.id];
        const totalScore = selectedTeamsScoreFromFixtures(enriched, activeRoarTeamIds);

        if (lastTeamScoreRef.current !== null && totalScore > lastTeamScoreRef.current) {
          playRoar();
        }
        lastTeamScoreRef.current = totalScore;

        if (!cancelled) {
          setTeamFixtures(enriched);
          setRssItems(buildLiveTickerItems(enriched, selectedTeam.name));
          setRssError('');
        }
      } catch (loadError) {
        if (!cancelled) {
          setTeamFixtures([]);
          setFixturesError(loadError instanceof Error ? loadError.message : 'Fixtures konnten nicht geladen werden.');
          setRssItems([]);
          setRssError('Live-Ticker konnte nicht geladen werden.');
        }
      } finally {
        if (!cancelled) {
          setFixturesLoading(false);
        }
      }
    }

    async function loadFriendsAndTips() {
      if (!tenantSlug) {
        if (!cancelled) {
          setFriends([]);
          setTips([]);
        }
        return;
      }

      try {
        const friendsRes = await fetch(`${API_BASE_URL}/friends/${encodeURIComponent(selectedTeam.id)}`, {
          headers: buildAuthHeaders()
        });

        const friendsJson = await friendsRes.json();
        const friendRows = Array.isArray(friendsJson) ? friendsJson : [];

        if (!cancelled) {
          if (friendsRes.ok) {
            setFriends(friendRows);
            setTips(flattenFriendTips(friendRows));
          } else {
            setFriends([]);
            setTips([]);
          }
        }
      } catch {
        if (!cancelled) {
          setFriends([]);
          setTips([]);
        }
      }
    }

    async function loadSquad() {
      try {
        setSquadLoading(true);
        setSquadError('');
        const response = await fetch(`${API_BASE_URL}/players/${selectedTeam.id}`, {
          headers: buildAuthHeaders()
        });
        const json = await response.json();
        if (!response.ok) {
          throw new Error(json.error || json.message || 'Squad konnte nicht geladen werden.');
        }
        if (!cancelled) {
          setSquadData({
            coach: json.trainer ? { name: json.trainer } : null,
            players: Array.isArray(json.data) ? json.data : []
          });
        }
      } catch (squadLoadError) {
        if (!cancelled) {
          setSquadData({ coach: null, players: [] });
          setSquadError(squadLoadError instanceof Error ? squadLoadError.message : 'Squad konnte nicht geladen werden.');
        }
      } finally {
        if (!cancelled) {
          setSquadLoading(false);
        }
      }
    }

    loadTeamFixtures();
    loadFriendsAndTips();
    loadSquad();

    const intervalId = setInterval(() => {
      loadTeamFixtures();
    }, 25000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [roarTeamIds, selectedTeam, showGroupStage, tenantSlug, token]);

  async function addFriend(event) {
    event.preventDefault();
    if (!friendName.trim()) {
      return;
    }

    setFixturesError('Freunde werden automatisch aus deinem Workspace geladen und hier nicht manuell angelegt.');
  }

  async function removeFriend(friendId, friendName = 'diesen Freund') {
    setFixturesError(`${friendName} wird aus deinem Workspace verwaltet und kann hier nicht entfernt werden.`);
  }

  async function saveTip(event, fixtureId) {
    event.preventDefault();
    const draft = getTipDraft(fixtureId);
    if (!draft.friendId || draft.homeTip === '' || draft.awayTip === '') {
      return;
    }

    if (!selectedTeam) {
      return;
    }

    if (!tenantSlug) {
      setFixturesError('Workspace-Kontext fehlt fuer diesen Tipp.');
      return;
    }

    if (draft.friendId && user?.id && String(draft.friendId) !== String(user.id)) {
      setFixturesError('Du kannst im Webclient derzeit nur deine eigenen Tipps speichern.');
      return;
    }

    try {
      const nextTipsPayload = buildCurrentUserTipsPayload(tips, user?.id);
      nextTipsPayload[String(fixtureId)] = {
        home: String(draft.homeTip),
        away: String(draft.awayTip)
      };

      const response = await fetch(`${API_BASE_URL}/friends/${encodeURIComponent(selectedTeam.id)}`, {
        method: 'POST',
        headers: {
          ...buildAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tips: nextTipsPayload })
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || json.message || 'Tipp konnte nicht gespeichert werden.');
      }

      const refreshRes = await fetch(`${API_BASE_URL}/friends/${encodeURIComponent(selectedTeam.id)}`, {
        headers: buildAuthHeaders()
      });
      const refreshJson = await refreshRes.json();
      if (refreshRes.ok) {
        const friendRows = Array.isArray(refreshJson) ? refreshJson : [];
        setFriends(friendRows);
        setTips(flattenFriendTips(friendRows));
      }
    } catch (saveError) {
      setFixturesError(saveError instanceof Error ? saveError.message : 'Tipp konnte nicht gespeichert werden.');
    }
  }

  return (
    <div className="app-shell">
      <div className="noise-layer" />
      <main className={user ? 'auth-card auth-card-wide' : 'auth-card'}>
        <div className="brand-row">
          <span className="brand-pill">Grenzfall Multiuser</span>
          <h1>Tippspiel Workspace</h1>
          <p>Login und Registrierung mit identischer UI-Richtung wie dein Grenzfall-Setup.</p>
        </div>

        {user ? (
          <section className="session-panel full-width">
            <div className="session-header">
              <div>
                <h2>ROOAR World Cup 2026</h2>
                <p>Wahle dein Team und hore den Rooar.</p>
              </div>
              <div className="session-header-actions">
                {showGroupStage && selectedTeam ? (
                  <div className="title-actions session-title-actions">
                    <label className={showRoarPanel ? 'roar-toggle roar-toggle-active' : 'roar-toggle'}>
                      <span className="roar-toggle-label">ROOAR</span>
                      <input
                        type="checkbox"
                        checked={showRoarPanel}
                        onChange={(event) => {
                          setShowRoarPanel(event.target.checked);
                          if (event.target.checked) {
                            scheduleRoarPanelAutoClose();
                          }
                        }}
                        aria-label="ROOAR umschalten"
                      />
                      <span className="roar-toggle-track" aria-hidden="true">
                        <span className="roar-toggle-thumb" />
                      </span>
                    </label>
                    <button className="outline-btn" type="button" onClick={() => downloadIcs(selectedGroupFixtures, selectedTeam)}>
                      .ics
                    </button>
                    <button
                      className="outline-btn"
                      type="button"
                      onClick={() => {
                        if (!selectedGroupFixtures.length) {
                          return;
                        }
                        window.open(buildGoogleCalendarUrl(selectedGroupFixtures[0], selectedTeam), '_blank', 'noopener,noreferrer');
                      }}
                    >
                      Gmail Kalender
                    </button>
                    <button className="outline-btn" type="button" onClick={() => setShowGroupStage(false)}>
                      Team wechseln
                    </button>
                  </div>
                ) : null}
                <button className="outline-btn" onClick={logout}>Abmelden</button>
              </div>
            </div>

            <div className="user-meta compact">
              <span>{user.name}</span>
              <span>{user.email}</span>
              {selectedTeam ? (
                <span>
                  Dein Team:{' '}
                  {getFlagImageSrc(selectedTeam) ? (
                    <img className="inline-flag-img" src={getFlagImageSrc(selectedTeam)} alt={`${selectedTeam.name} Flagge`} loading="lazy" />
                  ) : (
                    <span className="flag">{selectedTeam.flag}</span>
                  )}
                  {' '}{selectedTeam.name}
                </span>
              ) : <span>Noch kein Team ausgewahlt</span>}
            </div>

            <section className="friends-admin friends-admin-inline">
              <h5>Freunde hinzufügen</h5>
              <form className="friend-form" onSubmit={addFriend}>
                <input
                  type="text"
                  placeholder="Name"
                  value={friendName}
                  onChange={(event) => setFriendName(event.target.value)}
                  required
                />
                <input
                  type="email"
                  placeholder="E-Mail (optional)"
                  value={friendEmail}
                  onChange={(event) => setFriendEmail(event.target.value)}
                />
                <div className="friend-form-action">
                  <button type="submit" className="outline-btn">Freund hinzufügen</button>
                </div>
              </form>
            </section>

            {showGroupStage && selectedTeam ? (
              <div className="group-stage-view">
                <div className="group-stage-headline">
                  <h3>
                    {getFlagImageSrc(selectedTeam) ? (
                      <img className="inline-flag-img" src={getFlagImageSrc(selectedTeam)} alt={`${selectedTeam.name} Flagge`} loading="lazy" />
                    ) : (
                      <span className="flag">{selectedTeam.flag}</span>
                    )}
                    {' '}{selectedTeam.name} · Group {selectedGroupLetter}
                  </h3>
                  {showRoarPanel ? (
                    <div className="roar-settings-panel">
                      <div className="roar-settings-row">
                        <label className="roar-volume-row">
                          <span className="roar-label-text">Rooar Lautstärke</span>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={roarVolume}
                            onChange={(event) => {
                              setRoarVolume(Number(event.target.value));
                              scheduleRoarPanelAutoClose();
                            }}
                          />
                          <span className="roar-volume-value">{Math.round(roarVolume * 100)}%</span>
                        </label>
                      </div>
                      <div className="roar-team-list">
                        <span className="roar-list-title">Teams mit Roar</span>
                        <div className="roar-team-grid">
                          {selectedGroupTeams.map((team) => (
                            <label key={team.id} className="roar-team-chip">
                              <input
                                type="checkbox"
                                checked={roarTeamIds.includes(team.id)}
                                onChange={() => toggleRoarTeam(team.id)}
                              />
                              <span>{team.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                <section className="ticker-wrap">
                  <div className="ticker-label">RSS Live-Ticker</div>
                  <div className="ticker-track">
                    <div className="ticker-content">{tickerText}</div>
                  </div>
                  {rssError ? <p className="inline-error">{rssError}</p> : null}
                </section>

                <div className="group-team-strip">
                  {selectedGroupTeams.map((team) => (
                    <span key={team.id} className={team.id === selectedTeam.id ? 'group-team-chip active' : 'group-team-chip'}>
                      {getFlagImageSrc(team) ? (
                        <img className="inline-flag-img" src={getFlagImageSrc(team)} alt={`${team.name} Flagge`} loading="lazy" />
                      ) : (
                        <span className="flag">{team.flag}</span>
                      )}
                      {' '}{team.name}
                    </span>
                  ))}
                </div>

                <div className="group-stage-content">
                  <aside className="phase-side-panel">
                    <section className="side-card">
                      <button
                        type="button"
                        className="side-card-toggle"
                        onClick={() => setShowSquadPanel((prev) => !prev)}
                        aria-expanded={showSquadPanel}
                      >
                        <span>Mannschaft</span>
                        <span className="side-card-toggle-icon">{showSquadPanel ? '−' : '+'}</span>
                      </button>
                      {showSquadPanel ? (
                        <div className="side-card-body">
                          {squadLoading ? <p className="inline-note">Lade Mannschaft von Sportmonks...</p> : null}
                          {squadError ? <p className="inline-error">{squadError}</p> : null}
                          {!squadLoading && !squadError ? (
                            <>
                              <div className="squad-list-wrap">
                                {squadData?.coach ? (
                                  <div className="squad-row coach-row">
                                    <span className="squad-role">Trainer</span>
                                    <span className="squad-name">{squadData.coach.name}</span>
                                  </div>
                                ) : null}

                                {Array.isArray(squadData?.players) && squadData.players.length > 0 ? (
                                  squadData.players.map((player) => (
                                    <div className="squad-row" key={player.id || `${player.name}-${player.position}`}>
                                      <span className="squad-role">{player.position}</span>
                                      <span className="squad-name">{player.name}</span>
                                    </div>
                                  ))
                                ) : (
                                  <p className="tips-empty">Keine Mannschaftsdaten gefunden.</p>
                                )}
                              </div>

                              <div className="squad-formation-block">
                                <h4>Formation</h4>
                                {formationRows.length > 0 ? (
                                  <div className="formation-card">
                                    <p className="formation-caption">TEAM FORMATION ({latestFormation || 'n/a'})</p>
                                    <div className="formation-pitch">
                                      {formationRows.map((row, rowIndex) => (
                                        <div className="formation-line" key={`line-${rowIndex}`}>
                                          {row.map((player) => (
                                            <span className="formation-pill" key={`fp-${player.id || `${player.name}-${rowIndex}`}`}>
                                              {shortPlayerName(player.name)}
                                            </span>
                                          ))}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <p className="tips-empty">Keine Formation-Daten verfuegbar.</p>
                                )}
                              </div>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </section>

                    <section className="side-card">
                      <button
                        type="button"
                        className="side-card-toggle"
                        onClick={() => setShowNextPhasePanel((prev) => !prev)}
                        aria-expanded={showNextPhasePanel}
                      >
                        <span>Naechste Phase (nach Gruppe)</span>
                        <span className="side-card-toggle-icon">{showNextPhasePanel ? '−' : '+'}</span>
                      </button>
                      {showNextPhasePanel ? (
                        <div className="side-card-body">
                          {nextPhaseLoading ? <p className="inline-note">Lade naechste Phase von Sportmonks...</p> : null}
                          {nextPhaseError ? <p className="inline-error">{nextPhaseError}</p> : null}
                          {!nextPhaseLoading && !nextPhaseError ? (
                            nextPhaseData.length > 0 ? (
                              <div className="next-phase-table-wrap">
                                <table className="next-phase-table">
                                  <thead>
                                    <tr>
                                      <th>Phase</th>
                                      <th>Spiel</th>
                                      <th>Zeit</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {nextPhaseData.slice(0, 12).map((fixture) => (
                                      <tr key={`phase-${fixture.id}`}>
                                        <td>{fixture.stage}</td>
                                        <td>{fixture.homeTeam?.name} vs {fixture.awayTeam?.name}</td>
                                        <td>{formatClientKickoff(fixture.kickoffUtc)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p className="tips-empty">Noch keine Spiele nach der Gruppenphase vorhanden.</p>
                            )
                          ) : null}
                        </div>
                      ) : null}
                    </section>

                    <section className="side-card points-table-card">
                      <h4>Freunde Punkte-Statistik</h4>
                      <p className="points-rules">3 Punkte fuer exakten Tipp, 1 Punkt fuer richtige Tendenz.</p>
                      {friendPointsTable.length === 0 ? (
                        <p className="tips-empty">Noch keine Punkte vorhanden.</p>
                      ) : (
                        <div className="points-table-wrap">
                          <table className="points-table">
                            <thead>
                              <tr>
                                <th>#</th>
                                <th>Freund</th>
                                <th>Tipps</th>
                                <th>Exakt</th>
                                <th>Punkte</th>
                                <th aria-label="Aktion">X</th>
                              </tr>
                            </thead>
                            <tbody>
                              {friendPointsTable.map((row, index) => (
                                <tr key={`pts-${row.friendId}`}>
                                  <td>{index + 1}</td>
                                  <td>{row.friendName}</td>
                                  <td>{row.tipsCount}</td>
                                  <td>{row.exactHits}</td>
                                  <td><strong>{row.points}</strong></td>
                                  <td>
                                    {row.friendId ? (
                                      <button
                                        type="button"
                                        className="friend-remove-btn friend-remove-btn-small"
                                        onClick={() => removeFriend(row.friendId, row.friendName)}
                                        aria-label={`${row.friendName} entfernen`}
                                        title={`${row.friendName} entfernen`}
                                      >
                                        x
                                      </button>
                                    ) : null}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </section>

                    <section className="side-card">
                      <h4>Group View {selectedGroupLetter ? `· Group ${selectedGroupLetter}` : ''}</h4>
                      {teamViewError ? <p className="inline-error">{teamViewError}</p> : null}
                      {groupStandings.length > 0 ? (
                        <div className="next-phase-table-wrap">
                          <table className="next-phase-table group-standings-table">
                            <thead>
                              <tr>
                                <th>#</th>
                                <th>Team</th>
                                <th>Sp</th>
                                <th>S</th>
                                <th>U</th>
                                <th>N</th>
                                <th>Tore</th>
                                <th>Diff</th>
                                <th>Pkt</th>
                              </tr>
                            </thead>
                            <tbody>
                              {groupStandings.map((row) => (
                                <tr key={`gst-${row.teamId}`}>
                                  <td>{row.rank}</td>
                                  <td>
                                    {(() => {
                                      const canonicalTeam = getCanonicalTeamMeta(row.teamId, row.teamName);
                                      const flagSrc = getFlagImageSrc(canonicalTeam);
                                      return (
                                        <span className="team-name-with-flag">
                                          {flagSrc ? (
                                            <img
                                              className="inline-flag-img"
                                              src={flagSrc}
                                              alt={`${canonicalTeam.name} Flagge`}
                                              loading="lazy"
                                            />
                                          ) : (
                                            <span className="flag">{canonicalTeam.flag || '🏳️'}</span>
                                          )}
                                          {' '}{canonicalTeam.name}
                                        </span>
                                      );
                                    })()}
                                  </td>
                                  <td>{row.played}</td>
                                  <td>{row.won}</td>
                                  <td>{row.draw}</td>
                                  <td>{row.lost}</td>
                                  <td>{row.goalsFor}:{row.goalsAgainst}</td>
                                  <td>{row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}</td>
                                  <td><strong>{row.points}</strong></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="tips-empty">Keine Group-View-Daten vorhanden.</p>
                      )}
                      {Array.isArray(selectedGroupTeams) && selectedGroupTeams.length > 0 ? (
                        <div className="group-team-strip compact">
                          {selectedGroupTeams.map((team) => (
                            <span key={team.id} className="group-team-chip">
                              {getCanonicalTeamName(team.id, team.name)}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </section>

                    <section className="side-card">
                      <h4>Matches & Results</h4>
                      {matchesResultsData.length > 0 ? (
                        <div className="next-phase-table-wrap">
                          <table className="next-phase-table">
                            <thead>
                              <tr>
                                <th>Stage</th>
                                <th>Match</th>
                                <th>Result</th>
                              </tr>
                            </thead>
                            <tbody>
                              {matchesResultsData.slice(-10).reverse().map((fixture) => (
                                <tr key={`mr-${fixture.id}`}>
                                  <td>{fixture.stage}</td>
                                  <td>{fixture.homeTeam?.name} vs {fixture.awayTeam?.name}</td>
                                  <td>{fixture.homeScore} : {fixture.awayScore}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="tips-empty">Keine Match/Result-Daten vorhanden.</p>
                      )}
                    </section>

                    <section className="side-card">
                      <h4>Tournament Structure</h4>
                      {tournamentBracketStages.length > 0 ? (
                        <div className="stage-card-grid">
                          {tournamentBracketStages.map((stage) => {
                            const matchCount = Array.isArray(stage.fixtures) ? stage.fixtures.length : 0;
                            const teamsCount = matchCount > 0 ? matchCount * 2 : 0;

                            return (
                              <button
                                key={`ts-${stage.stage}`}
                                type="button"
                                className="stage-card-item stage-card-button"
                                onClick={() => setSelectedDiagramStageName(stage.stage)}
                                title={`Diagramm fur ${stage.stage} anzeigen`}
                              >
                                <h5>{stage.stage}</h5>
                                <p>{teamsCount} teams</p>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="tips-empty">Noch keine Tournament-Structure-Daten vorhanden.</p>
                      )}
                    </section>

                    <section className="side-card">
                      <h4>Naechste Phase (Details)</h4>
                      {tournamentBracketStages.length > 0 ? (
                        <div className="bracket-scroll">
                          <div className="bracket-board">
                            {tournamentBracketStages.map((stage) => (
                              <div key={`tsd-${stage.stage}`} className="bracket-stage-col">
                                <h5>{stage.stage}</h5>
                                <div className="bracket-stage-matches">
                                  {(stage.fixtures || []).slice(0, 8).map((fixture) => (
                                    <article key={`tsdf-${fixture.id}`} className="bracket-match-card">
                                      <div className="bracket-team-row">
                                        <span>{fixture.homeTeam?.name}</span>
                                        <strong>{fixture.homeScore}</strong>
                                      </div>
                                      <div className="bracket-team-row">
                                        <span>{fixture.awayTeam?.name}</span>
                                        <strong>{fixture.awayScore}</strong>
                                      </div>
                                    </article>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="tips-empty">Noch keine Detaildaten vorhanden.</p>
                      )}
                    </section>
                  </aside>

                <div className="fixture-list">
                  {fixturesLoading ? <p className="inline-note">Lade Group-Stage-Fixtures von Sportmonks...</p> : null}
                  {!fixturesLoading && fixturesError ? (
                    <p className="inline-error">{fixturesError}</p>
                  ) : null}
                  {selectedGroupFixtures.map((fixture) => {
                    const fixtureTips = loadTipsForFixture(fixture.id);
                    const visibleTips = fixtureTips.slice(0, 10);
                    const homeFlagSrc = getFlagImageSrc(fixture.homeTeam);
                    const awayFlagSrc = getFlagImageSrc(fixture.awayTeam);
                    const venue = fixture.venue || {
                      name: 'Unknown venue',
                      city: 'Unknown city',
                      country: 'Unknown country',
                      timeZone: 'UTC',
                      image: ''
                    };

                    return (
                      <article key={fixture.id} className="fixture-card">
                        <header>
                          <p className="fixture-stage">{fixture.stage}</p>
                        </header>

                        <div className="match-teams-line">
                          <span className="team-home">
                            {homeFlagSrc ? (
                              <img className="match-flag-img" src={homeFlagSrc} alt={`${fixture.homeTeam.name} Flagge`} loading="lazy" />
                            ) : (
                              <span className="flag">{fixture.homeTeam.flag || '🏳️'}</span>
                            )}
                            {' '}{fixture.homeTeam.name}
                          </span>
                          <span className="team-away">
                            {awayFlagSrc ? (
                              <img className="match-flag-img" src={awayFlagSrc} alt={`${fixture.awayTeam.name} Flagge`} loading="lazy" />
                            ) : (
                              <span className="flag">{fixture.awayTeam.flag || '🏳️'}</span>
                            )}
                            {' '}{fixture.awayTeam.name}
                          </span>
                        </div>

                        <div className="score-line">
                          <strong>{Number(fixture.homeScore || 0)} : {Number(fixture.awayScore || 0)}</strong>
                        </div>

                        <div className="fixture-lower">
                          <div className="fixture-meta-grid">
                            <div className="meta-col meta-col-left">
                              <div className="meta-item">
                                <span className="meta-label">Local time at venue</span>
                                <span>{formatVenueKickoff(fixture.kickoffUtc, venue.timeZone)}</span>
                                </div>
                                <div className="meta-item">
                                <span className="meta-label">Local time for you</span>
                                <span>{formatClientKickoff(fixture.kickoffUtc)}</span>
                              </div>
                            </div>

                            <div className="meta-col meta-col-right">
                              <div className="meta-item">
                                <span className="meta-label">Stadium</span>
                                <span className="venue-meta-with-thumb">
                                  <span className="venue-name-text">{venue.name}</span>
                                  <img
                                    className="venue-thumb"
                                    src={getVenueImageSrc(venue) || getVenueFallbackSvg(venue)}
                                    alt={`${venue.name} stadium`}
                                    loading="lazy"
                                    onError={(event) => {
                                      if (event.currentTarget.src.startsWith('data:image/svg+xml')) {
                                        return;
                                      }
                                      event.currentTarget.src = getVenueFallbackSvg(venue);
                                    }}
                                  />
                                </span>
                              </div>
                              <div className="meta-item">
                                <span className="meta-label">City</span>
                                <span>{venue.city}, {venue.country}</span>
                              </div>
                            </div>
                          </div>

                          <section className="tips-block">
                            <div className="tips-headline">
                              <h5>Tipps deiner Freunde</h5>
                              <span>{visibleTips.length}/10</span>
                            </div>
                            <div className="tips-list">
                              {fixtureTips.length === 0 ? (
                                <p className="tips-empty">Noch keine Tipps für dieses Spiel.</p>
                              ) : (
                                visibleTips.map((tip) => (
                                  <div key={tip.id} className="tip-item">
                                    <span className="tip-name">{tip.friend_name}</span>
                                    <strong className="tip-score">{tip.home_tip} : {tip.away_tip}</strong>
                                    <span className="tip-points">{calculateTipPoints(tip, fixture)} P</span>
                                  </div>
                                ))
                              )}
                            </div>
                            {fixtureTips.length > 10 ? <p className="tips-more">+{fixtureTips.length - 10} weitere Tipps gespeichert</p> : null}

                            <form className="tip-form" onSubmit={(event) => saveTip(event, fixture.id)}>
                              <select
                                value={getTipDraft(fixture.id).friendId}
                                onChange={(event) => setTipDraft(fixture.id, { friendId: event.target.value })}
                              >
                                <option value="">Freund wählen</option>
                                {friends.map((friend) => (
                                  <option key={friend.id} value={friend.id}>{friend.name}</option>
                                ))}
                              </select>
                              <input
                                type="number"
                                min="0"
                                placeholder="Home"
                                value={getTipDraft(fixture.id).homeTip}
                                onChange={(event) => setTipDraft(fixture.id, { homeTip: event.target.value })}
                              />
                              <input
                                type="number"
                                min="0"
                                placeholder="Away"
                                value={getTipDraft(fixture.id).awayTip}
                                onChange={(event) => setTipDraft(fixture.id, { awayTip: event.target.value })}
                              />
                              <button type="submit" className="outline-btn">Tipp speichern</button>
                            </form>
                          </section>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
              {selectedDiagramStage ? (
                <div
                  className="phase-diagram-overlay"
                  role="dialog"
                  aria-modal="true"
                  aria-label={`${selectedDiagramStage.stage} Diagramm`}
                  onClick={() => setSelectedDiagramStageName('')}
                >
                  <div className="phase-diagram-modal" onClick={(event) => event.stopPropagation()}>
                    <div className="phase-diagram-head">
                      <div>
                        <h4>{selectedDiagramStage.stage}</h4>
                        <p>Schematisches Diagramm · {selectedDiagramStage.fixtures?.length || 0} Spiele</p>
                      </div>
                      <button
                        type="button"
                        className="friend-remove-btn"
                        onClick={() => setSelectedDiagramStageName('')}
                        aria-label="Diagramm schliessen"
                        title="Schliessen"
                      >
                        x
                      </button>
                    </div>

                    <div className="phase-diagram-board">
                      {(selectedDiagramStage.fixtures || []).length > 0 ? (
                        (selectedDiagramStage.fixtures || []).map((fixture, index) => (
                          <article key={`diag-${selectedDiagramStage.stage}-${fixture.id}`} className="phase-diagram-match">
                            <span className="phase-diagram-match-index">Match {index + 1}</span>
                            <div className="phase-diagram-team-row">
                              <span>{fixture.homeTeam?.name || 'TBD'}</span>
                              <strong>{Number(fixture.homeScore || 0)}</strong>
                            </div>
                            <div className="phase-diagram-team-row">
                              <span>{fixture.awayTeam?.name || 'TBD'}</span>
                              <strong>{Number(fixture.awayScore || 0)}</strong>
                            </div>
                          </article>
                        ))
                      ) : (
                        <p className="tips-empty">Keine Spiele fur diese Phase vorhanden.</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
              </div>
            ) : (
              <>
                <input
                  className="team-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Team oder Region suchen"
                />

                <div className="team-groups">
                  {groupedTeams.map(([letter, teams]) => (
                    <div className="group-row" key={letter}>
                      <div className="group-rail">{letter}</div>
                      <div className="group-grid">
                        {renderRows(teams).map((row, rowIndex) => (
                          <div className="team-row" key={`${letter}-${rowIndex}`}>
                            {row.map((team) => (
                              <button
                                key={team.id}
                                type="button"
                                className={team.id === selectedTeamId ? 'team-card selected' : 'team-card'}
                                onClick={() => chooseTeam(team.id)}
                              >
                                {getFlagImageSrc(team) ? (
                                  <img className="team-flag-img" src={getFlagImageSrc(team)} alt={`${team.name} Flagge`} loading="lazy" />
                                ) : (
                                  <span className="flag">{team.flag}</span>
                                )}
                                <span className="team-name">{team.name}</span>
                              </button>
                            ))}
                            {Array.from({ length: 4 - row.length }).map((_, fillIdx) => (
                              <div className="team-card spacer" key={`${letter}-${rowIndex}-fill-${fillIdx}`} />
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        ) : (
          <>
            <div className="mode-switch">
              <button
                className={mode === 'login' ? 'tab active' : 'tab'}
                onClick={() => setMode('login')}
                type="button"
              >
                Anmelden
              </button>
              <button
                className={mode === 'register' ? 'tab active' : 'tab'}
                onClick={() => setMode('register')}
                type="button"
              >
                Registrieren
              </button>
            </div>

            <form className="auth-form" onSubmit={submitForm}>
              <h2>{title}</h2>

              {mode === 'register' && (
                <label>
                  Name
                  <input
                    type="text"
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    required
                    placeholder="Dein Name"
                  />
                </label>
              )}

              <label>
                E-Mail
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                  required
                  placeholder="name@example.com"
                />
              </label>

              <label>
                Passwort
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                  required
                  minLength={6}
                  placeholder="mindestens 6 Zeichen"
                />
              </label>

              {error && <p className="error-message">{error}</p>}

              <button className="primary-btn" type="submit" disabled={loading}>
                {loading ? 'Bitte warten...' : title}
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
