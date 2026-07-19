#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const baseUrl = process.env.GRENZFALL_BASE_URL || 'https://grenzfall.net';
const tenantSlug = process.env.GRENZFALL_TENANT_SLUG || '';
const token = process.env.GRENZFALL_AUTH_TOKEN || '';
const teamScope = process.env.GRENZFALL_TEAM_SCOPE || 'all-matches';

if (!tenantSlug) {
  console.error('Missing env GRENZFALL_TENANT_SLUG');
  process.exit(1);
}

if (!token) {
  console.error('Missing env GRENZFALL_AUTH_TOKEN');
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  'X-Tenant-Slug': tenantSlug,
  'Content-Type': 'application/json',
};

function ts() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}

function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status} ${url}: ${body}`);
  }
  return res.json();
}

function fixtureKey(f) {
  return [
    normalizeName(f?.homeTeam?.name),
    normalizeName(f?.awayTeam?.name),
    normalizeName(f?.stage),
    normalizeName(f?.round),
  ].join('|');
}

function chooseBestCandidate(candidates) {
  if (!candidates.length) {
    return null;
  }

  const withDate = candidates
    .map((f) => ({
      fixture: f,
      kickoff: Number.isFinite(Date.parse(f?.kickoffUtc || '')) ? Date.parse(f.kickoffUtc) : Number.POSITIVE_INFINITY,
    }))
    .sort((a, b) => a.kickoff - b.kickoff);

  return withDate[0].fixture;
}

async function main() {
  console.log('=== Grenzfall Friend Tips Migration (all games) ===');
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Tenant: ${tenantSlug}`);
  console.log(`Scope: ${teamScope}`);

  const friendsUrl = `${baseUrl}/api/friends/${encodeURIComponent(teamScope)}`;
  const fixturesUrl = `${baseUrl}/api/fixtures/all`;

  const friends = await fetchJson(friendsUrl, { headers });
  const fixturePayload = await fetchJson(fixturesUrl);
  const fixtures = Array.isArray(fixturePayload?.data) ? fixturePayload.data : [];

  if (!Array.isArray(friends) || friends.length === 0) {
    throw new Error('No friends returned for migration.');
  }
  if (!fixtures.length) {
    throw new Error('No fixtures returned from /api/fixtures/all.');
  }

  const outDir = path.resolve(process.cwd(), 'exports');
  fs.mkdirSync(outDir, { recursive: true });
  const backupPath = path.join(outDir, `friend-tips-backup-before-migration-${tenantSlug}-${ts()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(friends, null, 2), 'utf8');
  console.log(`Backup written: ${backupPath}`);

  const byKey = new Map();
  for (const f of fixtures) {
    const key = fixtureKey(f);
    if (!byKey.has(key)) {
      byKey.set(key, []);
    }
    byKey.get(key).push(f);
  }

  const allTipIds = new Set();
  for (const friend of friends) {
    const tips = friend?.tips && typeof friend.tips === 'object' ? friend.tips : {};
    for (const id of Object.keys(tips)) {
      allTipIds.add(String(id));
    }
  }

  const idMapping = new Map();
  const unresolved = [];

  for (const oldId of allTipIds) {
    const matchPayload = await fetchJson(`${baseUrl}/api/fixtures/match/${encodeURIComponent(oldId)}`);
    const oldFixture = matchPayload?.data;
    if (!oldFixture) {
      unresolved.push({ oldId, reason: 'match endpoint returned no data' });
      continue;
    }

    const key = fixtureKey(oldFixture);
    const candidates = byKey.get(key) || [];
    const candidate = chooseBestCandidate(candidates);

    if (!candidate?.id) {
      unresolved.push({
        oldId,
        reason: 'no candidate found in /api/fixtures/all',
        match: `${oldFixture.homeTeam?.name || '?'} vs ${oldFixture.awayTeam?.name || '?'}`,
      });
      continue;
    }

    idMapping.set(oldId, String(candidate.id));
  }

  let migratedFriendCount = 0;
  let movedTipCount = 0;

  for (const friend of friends) {
    const tips = friend?.tips && typeof friend.tips === 'object' ? friend.tips : {};
    const nextTips = { ...tips };
    let changed = false;

    for (const [oldId, tip] of Object.entries(tips)) {
      const mappedId = idMapping.get(String(oldId));
      if (!mappedId || mappedId === String(oldId)) {
        continue;
      }

      if (!nextTips[mappedId]) {
        nextTips[mappedId] = tip;
        movedTipCount += 1;
      }
      delete nextTips[oldId];
      changed = true;
    }

    if (!changed) {
      continue;
    }

    const updateBody = {
      friendId: friend.id,
      tips: nextTips,
    };

    await fetchJson(friendsUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(updateBody),
    });

    migratedFriendCount += 1;
  }

  const afterFriends = await fetchJson(friendsUrl, { headers });

  console.log('');
  console.log('Migration summary:');
  console.log(`- Friends processed: ${friends.length}`);
  console.log(`- Friends updated: ${migratedFriendCount}`);
  console.log(`- Tips moved to new IDs: ${movedTipCount}`);
  console.log(`- Unique IDs scanned: ${allTipIds.size}`);
  console.log(`- IDs mapped: ${idMapping.size}`);
  console.log(`- IDs unresolved: ${unresolved.length}`);

  if (unresolved.length) {
    console.log('');
    console.log('Unresolved IDs:');
    for (const item of unresolved) {
      console.log(`- ${item.oldId}: ${item.reason}${item.match ? ` (${item.match})` : ''}`);
    }
  }

  const idSetAfter = new Set();
  for (const friend of afterFriends) {
    const tips = friend?.tips && typeof friend.tips === 'object' ? friend.tips : {};
    for (const id of Object.keys(tips)) {
      idSetAfter.add(id);
    }
  }

  console.log('');
  console.log(`Verification: ${idSetAfter.size} unique fixture IDs remain after migration.`);
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
