/**
 * Maps app team IDs (our short codes) to SportMonks v3 team IDs.
 * Look up exact IDs via:
 *   GET https://api.sportmonks.com/v3/football/teams?api_token=KEY&filters=teamTypes:national
 * or search by name:
 *   GET https://api.sportmonks.com/v3/football/teams/search/{name}?api_token=KEY
 */
export const APP_TO_SPORTMONKS_TEAM_ID: Record<string, number> = {
  // UEFA
  ger: 18660, // Germany
  fra: 496,   // France
  esp: 738,   // Spain
  eng: 462,   // England
  por: 737,   // Portugal
  ned: 1010,  // Netherlands
  bel: 729,   // Belgium
  ita: 735,   // Italy
  aut: 730,   // Austria
  sui: 739,   // Switzerland
  hun: 734,   // Hungary
  sco: 1161,  // Scotland
  cze: 731,   // Czech Republic
  tur: 740,   // Turkey
  srb: 741,   // Serbia
  alb: 1025,  // Albania
  // CONMEBOL
  bra: 6,     // Brazil
  arg: 951,   // Argentina
  col: 110,   // Colombia
  uru: 744,   // Uruguay
  ecu: 732,   // Ecuador
  ven: 742,   // Venezuela
  // CONCACAF
  usa: 18571, // USA
  mex: 454,   // Mexico
  can: 108,   // Canada
  pan: 1028,  // Panama
  crc: 1024,  // Costa Rica
  jam: 1027,  // Jamaica
  // CAF
  mar: 489,   // Morocco
  sen: 498,   // Senegal
  egy: 733,   // Egypt
  nga: 493,   // Nigeria
  cmr: 109,   // Cameroon
  civ: 1033,  // Côte d'Ivoire
  drc: 1030,  // DR Congo
  gnb: 1038,  // Guinea-Bissau
  tun: 500,   // Tunisia
  // AFC
  jpn: 487,   // Japan
  kor: 488,   // South Korea
  aus: 18730, // Australia
  irn: 736,   // Iran
  sau: 497,   // Saudi Arabia
  uzb: 1051,  // Uzbekistan
  jor: 1042,  // Jordan
  irq: 1041,  // Iraq
  // OFC
  nzl: 1049,  // New Zealand
};
