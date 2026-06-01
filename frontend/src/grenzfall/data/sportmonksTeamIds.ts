/**
 * Maps app team IDs (our short codes) to SportMonks v3 team IDs.
 * Must match the backend mapping in backend/src/teamIds.ts
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
  swe: 18564, // Sweden
  hun: 734,   // Hungary
  sco: 1161,  // Scotland
  cze: 731,   // Czech Republic
  cro: 18588, // Croatia
  bih: 18625, // Bosnia and Herzegovina
  tur: 18716, // Turkey
  srb: 741,   // Serbia
  alb: 1025,  // Albania
  nor: 18563, // Norway
  // CONMEBOL
  bra: 6,     // Brazil
  arg: 951,   // Argentina
  col: 110,   // Colombia
  par: 18723, // Paraguay
  uru: 744,   // Uruguay
  ecu: 732,   // Ecuador
  ven: 742,   // Venezuela
  // CONCACAF
  usa: 18571, // USA
  mex: 454,   // Mexico
  can: 108,   // Canada
  pan: 1028,  // Panama
  hai: 18804, // Haiti
  cuw: 18910, // Curacao
  crc: 1024,  // Costa Rica
  jam: 1027,  // Jamaica
  // CAF
  alg: 18620, // Algeria
  mar: 489,   // Morocco
  sen: 498,   // Senegal
  egy: 733,   // Egypt
  gha: 18553, // Ghana
  zaf: 18555, // South Africa
  nga: 493,   // Nigeria
  cmr: 109,   // Cameroon
  civ: 1033,  // Côte d'Ivoire
  drc: 18552, // DR Congo
  gnb: 1038,  // Guinea-Bissau
  tun: 500,   // Tunisia
  cpv: 18629, // Cape Verde
  // AFC
  jpn: 487,   // Japan
  kor: 18567, // Korea Republic (South Korea)
  aus: 18730, // Australia
  irn: 736,   // Iran
  sau: 497,   // Saudi Arabia
  qat: 1044,  // Qatar
  uzb: 1051,  // Uzbekistan
  jor: 1042,  // Jordan
  irq: 1041,  // Iraq
  // OFC
  nzl: 1049,  // New Zealand
};
