export interface Team {
  id: string;
  name: string;
  flag: string;
  region: string;
}

export const TEAMS: Team[] = [
  // UEFA (Europe) — 16 teams
  { id: 'ger', name: 'Germany', flag: '🇩🇪', region: 'UEFA' },
  { id: 'fra', name: 'France', flag: '🇫🇷', region: 'UEFA' },
  { id: 'esp', name: 'Spain', flag: '🇪🇸', region: 'UEFA' },
  { id: 'eng', name: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', region: 'UEFA' },
  { id: 'por', name: 'Portugal', flag: '🇵🇹', region: 'UEFA' },
  { id: 'ned', name: 'Netherlands', flag: '🇳🇱', region: 'UEFA' },
  { id: 'bel', name: 'Belgium', flag: '🇧🇪', region: 'UEFA' },
  { id: 'ita', name: 'Italy', flag: '🇮🇹', region: 'UEFA' },
  { id: 'aut', name: 'Austria', flag: '🇦🇹', region: 'UEFA' },
  { id: 'sui', name: 'Switzerland', flag: '🇨🇭', region: 'UEFA' },
  { id: 'hun', name: 'Hungary', flag: '🇭🇺', region: 'UEFA' },
  { id: 'sco', name: 'Scotland', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', region: 'UEFA' },
  { id: 'cze', name: 'Czech Republic', flag: '🇨🇿', region: 'UEFA' },
  { id: 'tur', name: 'Turkey', flag: '🇹🇷', region: 'UEFA' },
  { id: 'srb', name: 'Serbia', flag: '🇷🇸', region: 'UEFA' },
  { id: 'alb', name: 'Albania', flag: '🇦🇱', region: 'UEFA' },
  // CONMEBOL (South America) — 6 teams
  { id: 'bra', name: 'Brazil', flag: '🇧🇷', region: 'CONMEBOL' },
  { id: 'arg', name: 'Argentina', flag: '🇦🇷', region: 'CONMEBOL' },
  { id: 'col', name: 'Colombia', flag: '🇨🇴', region: 'CONMEBOL' },
  { id: 'uru', name: 'Uruguay', flag: '🇺🇾', region: 'CONMEBOL' },
  { id: 'ecu', name: 'Ecuador', flag: '🇪🇨', region: 'CONMEBOL' },
  { id: 'ven', name: 'Venezuela', flag: '🇻🇪', region: 'CONMEBOL' },
  // CONCACAF (N/C America & Caribbean) — 6 teams
  { id: 'usa', name: 'USA', flag: '🇺🇸', region: 'CONCACAF' },
  { id: 'mex', name: 'Mexico', flag: '🇲🇽', region: 'CONCACAF' },
  { id: 'can', name: 'Canada', flag: '🇨🇦', region: 'CONCACAF' },
  { id: 'pan', name: 'Panama', flag: '🇵🇦', region: 'CONCACAF' },
  { id: 'crc', name: 'Costa Rica', flag: '🇨🇷', region: 'CONCACAF' },
  { id: 'jam', name: 'Jamaica', flag: '🇯🇲', region: 'CONCACAF' },
  // CAF (Africa) — 9 teams
  { id: 'mar', name: 'Morocco', flag: '🇲🇦', region: 'CAF' },
  { id: 'sen', name: 'Senegal', flag: '🇸🇳', region: 'CAF' },
  { id: 'egy', name: 'Egypt', flag: '🇪🇬', region: 'CAF' },
  { id: 'nga', name: 'Nigeria', flag: '🇳🇬', region: 'CAF' },
  { id: 'cmr', name: 'Cameroon', flag: '🇨🇲', region: 'CAF' },
  { id: 'civ', name: "Côte d'Ivoire", flag: '🇨🇮', region: 'CAF' },
  { id: 'drc', name: 'DR Congo', flag: '🇨🇩', region: 'CAF' },
  { id: 'gnb', name: 'Guinea-Bissau', flag: '🇬🇼', region: 'CAF' },
  { id: 'tun', name: 'Tunisia', flag: '🇹🇳', region: 'CAF' },
  // AFC (Asia) — 8 teams
  { id: 'jpn', name: 'Japan', flag: '🇯🇵', region: 'AFC' },
  { id: 'kor', name: 'South Korea', flag: '🇰🇷', region: 'AFC' },
  { id: 'aus', name: 'Australia', flag: '🇦🇺', region: 'AFC' },
  { id: 'irn', name: 'Iran', flag: '🇮🇷', region: 'AFC' },
  { id: 'sau', name: 'Saudi Arabia', flag: '🇸🇦', region: 'AFC' },
  { id: 'uzb', name: 'Uzbekistan', flag: '🇺🇿', region: 'AFC' },
  { id: 'jor', name: 'Jordan', flag: '🇯🇴', region: 'AFC' },
  { id: 'irq', name: 'Iraq', flag: '🇮🇶', region: 'AFC' },
  // OFC (Oceania) — 1 team
  { id: 'nzl', name: 'New Zealand', flag: '🇳🇿', region: 'OFC' },
  // Host nations (already included above: USA, Canada, Mexico)
];
