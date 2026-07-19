#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const baseUrl = process.env.GRENZFALL_BASE_URL || 'https://grenzfall.net';
const tenantSlug = process.env.GRENZFALL_TENANT_SLUG || '';
const token = process.env.GRENZFALL_AUTH_TOKEN || '';
const scope = process.env.GRENZFALL_TEAM_SCOPE || 'all-matches';

if (!tenantSlug || !token) {
  console.error('Missing env vars: GRENZFALL_TENANT_SLUG and/or GRENZFALL_AUTH_TOKEN');
  process.exit(1);
}

const targets = [
  ['Argentina', 'Switzerland'],
  ['Norway', 'England'],
  ['Spain', 'Belgium'],
  ['France', 'Morocco'],
];

const headers = {
  Authorization: `Bearer ${token}`,
  'X-Tenant-Slug': tenantSlug,
  'Content-Type': 'application/json',
};

function nowStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}

async function fetchJson(url, init = {}) {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status} ${url}: ${body}`);
  }
  return res.json();
}

function pickLatestTipEntries(fixtureMap, tipsObj, maxCount) {
  const entries = Object.entries(tipsObj || {})
    .map(([fixtureId, tip]) => {
      const fixture = fixtureMap.get(String(fixtureId));
      const kickoff = fixture?.kickoffUtc ? Date.parse(fixture.kickoffUtc) : NaN;
      return {
        fixtureId: String(fixtureId),
        tip,
        kickoff: Number.isFinite(kickoff) ? kickoff : Number.NEGATIVE_INFINITY,
      };
    })
    .filter((row) => row.tip && row.tip.home !== undefined && row.tip.away !== undefined)
    .sort((a, b) => b.kickoff - a.kickoff);

  return entries.slice(0, maxCount);
}

function resolveTargetFixtures(allFixtures) {
  const out = [];
  for (const [home, away] of targets) {
    const hit = allFixtures.find(
      (f) => f?.homeTeam?.name === home && f?.awayTeam?.name === away
    );
    if (!hit) {
      throw new Error(`Target fixture not found: ${home} vs ${away}`);
    }
    out.push(hit);
  }
  return out.sort((a, b) => Date.parse(a.kickoffUtc) - Date.parse(b.kickoffUtc));
}

async function main() {
  console.log('=== Fill Missing Quarter-final Friend Tips ===');
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Tenant: ${tenantSlug}`);
  console.log(`Scope: ${scope}`);

  const friendsUrl = `${baseUrl}/api/friends/${encodeURIComponent(scope)}`;
  const fixturesUrl = `${baseUrl}/api/fixtures/all`;

  const [friends, fixturesPayload] = await Promise.all([
    fetchJson(friendsUrl, { headers }),
    fetchJson(fixturesUrl),
  ]);

  const allFixtures = Array.isArray(fixturesPayload?.data) ? fixturesPayload.data : [];
  const fixtureMap = new Map(allFixtures.map((f) => [String(f.id), f]));
  const targetFixtures = resolveTargetFixtures(allFixtures);

  const outDir = path.resolve(process.cwd(), 'exports');
  fs.mkdirSync(outDir, { recursive: true });
  const backupPath = path.join(outDir, `friend-tips-backup-before-quarterfill-${tenantSlug}-${nowStamp()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(friends, null, 2), 'utf8');
  console.log(`Backup written: ${backupPath}`);

  let updatedFriends = 0;
  let insertedTips = 0;

  for (const friend of friends) {
    const tips = friend?.tips && typeof friend.tips === 'object' ? { ...friend.tips } : {};
    const missingTargets = targetFixtures.filter((f) => !tips[String(f.id)]);
    if (!missingTargets.length) {
      continue;
    }

    const fallbackPool = pickLatestTipEntries(fixtureMap, tips, missingTargets.length);
    if (!fallbackPool.length) {
      continue;
    }

    // Deterministic fill: map latest existing tips to missing quarter-finals in kickoff order.
    for (let i = 0; i < missingTargets.length && i < fallbackPool.length; i += 1) {
      const target = missingTargets[i];
      const source = fallbackPool[i];
      tips[String(target.id)] = {
        home: String(source.tip.home),
        away: String(source.tip.away),
      };
      insertedTips += 1;
    }

    await fetchJson(friendsUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ friendId: friend.id, tips }),
    });

    updatedFriends += 1;
  }

  console.log('');
  console.log('Fill summary:');
  console.log(`- Friends total: ${friends.length}`);
  console.log(`- Friends updated: ${updatedFriends}`);
  console.log(`- Quarter-final tips inserted: ${insertedTips}`);

  const verify = await fetchJson(friendsUrl, { headers });
  console.log('');
  console.log('Quarter-final tip counts after fill:');
  for (const f of targetFixtures) {
    const id = String(f.id);
    let count = 0;
    for (const friend of verify) {
      if (friend?.tips && friend.tips[id]) {
        count += 1;
      }
    }
    console.log(`- ${f.homeTeam.name} vs ${f.awayTeam.name} (${id}): ${count}`);
  }
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
