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

function normalizeStage(stage) {
  return String(stage || '').trim().toLowerCase();
}

function isKnockoutStage(stage) {
  const s = normalizeStage(stage);
  return (
    s.includes('round of 32') ||
    s.includes('round of 16') ||
    s.includes('quarter-final') ||
    s.includes('semifinal') ||
    s.includes('semi-final') ||
    s === 'final' ||
    s.includes('3rd place') ||
    s.includes('third place') ||
    s.includes('bronze')
  );
}

function safeKickoffMs(fixture) {
  const t = Date.parse(String(fixture?.kickoffUtc || ''));
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
}

function pickLatestTipEntries(fixtureMap, tipsObj) {
  return Object.entries(tipsObj || {})
    .map(([fixtureId, tip]) => {
      const fixture = fixtureMap.get(String(fixtureId));
      const kickoff = fixture ? safeKickoffMs(fixture) : Number.NEGATIVE_INFINITY;
      return {
        fixtureId: String(fixtureId),
        tip,
        kickoff,
      };
    })
    .filter((row) => row.tip && row.tip.home !== undefined && row.tip.away !== undefined)
    .sort((a, b) => b.kickoff - a.kickoff);
}

function stageLabel(stage) {
  const s = String(stage || '').trim();
  return s || 'Unknown stage';
}

async function main() {
  console.log('=== Fill Missing Knockout Friend Tips ===');
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
  if (!allFixtures.length) {
    throw new Error('No fixtures returned from /api/fixtures/all.');
  }

  const fixtureMap = new Map(allFixtures.map((f) => [String(f.id), f]));
  const knockoutFixtures = allFixtures
    .filter((f) => isKnockoutStage(f?.stage))
    .sort((a, b) => safeKickoffMs(a) - safeKickoffMs(b));

  if (!knockoutFixtures.length) {
    throw new Error('No knockout fixtures found in /api/fixtures/all.');
  }

  const outDir = path.resolve(process.cwd(), 'exports');
  fs.mkdirSync(outDir, { recursive: true });
  const backupPath = path.join(outDir, `friend-tips-backup-before-knockoutfill-${tenantSlug}-${nowStamp()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(friends, null, 2), 'utf8');
  console.log(`Backup written: ${backupPath}`);

  let updatedFriends = 0;
  let insertedTips = 0;

  for (const friend of friends) {
    const tips = friend?.tips && typeof friend.tips === 'object' ? { ...friend.tips } : {};
    const missingTargets = knockoutFixtures.filter((f) => !tips[String(f.id)]);
    if (!missingTargets.length) {
      continue;
    }

    const fallbackPool = pickLatestTipEntries(fixtureMap, tips);
    if (!fallbackPool.length) {
      continue;
    }

    // Deterministic fill: assign latest known tips to missing knockout fixtures.
    for (let i = 0; i < missingTargets.length; i += 1) {
      const target = missingTargets[i];
      const source = fallbackPool[i % fallbackPool.length];
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

  const verify = await fetchJson(friendsUrl, { headers });

  const byStage = new Map();
  for (const fixture of knockoutFixtures) {
    const id = String(fixture.id);
    let count = 0;
    for (const friend of verify) {
      if (friend?.tips && friend.tips[id]) {
        count += 1;
      }
    }

    const stage = stageLabel(fixture.stage);
    if (!byStage.has(stage)) {
      byStage.set(stage, []);
    }
    byStage.get(stage).push({
      match: `${fixture.homeTeam?.name || '?'} vs ${fixture.awayTeam?.name || '?'}`,
      fixtureId: id,
      count,
    });
  }

  console.log('');
  console.log('Fill summary:');
  console.log(`- Knockout fixtures found: ${knockoutFixtures.length}`);
  console.log(`- Friends total: ${friends.length}`);
  console.log(`- Friends updated: ${updatedFriends}`);
  console.log(`- Knockout tips inserted: ${insertedTips}`);

  console.log('');
  console.log('Coverage by stage after fill:');
  for (const [stage, rows] of byStage.entries()) {
    const min = Math.min(...rows.map((r) => r.count));
    const max = Math.max(...rows.map((r) => r.count));
    const withAny = rows.filter((r) => r.count > 0).length;
    console.log(`- ${stage}: fixtures=${rows.length}, withTips=${withAny}, minTips=${min}, maxTips=${max}`);
  }
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
