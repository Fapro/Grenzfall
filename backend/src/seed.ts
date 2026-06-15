/**
 * Startup seed — runs once at boot and ensures known workspaces exist.
 *
 * If SEED_WORKSPACE_SLUG / SEED_WORKSPACE_PASSWORD env vars are set (or the
 * hardcoded defaults below), the workspace and its shared-login user are
 * created/repaired automatically.  This means a Render free-tier restart
 * never breaks the login permanently.
 *
 * Env vars (all optional – defaults are the bonnei-cup workspace):
 *   SEED_WORKSPACE_SLUG       e.g. "bonnei-cup"
 *   SEED_WORKSPACE_NAME       e.g. "Bonn-Ei"
 *   SEED_WORKSPACE_PASSWORD   e.g. "NLsWdNodnd"
 */

import {
  findTenantBySlug,
  findUserByUsername,
  addUser,
  addTenant,
  addTenantMember,
  updateDb,
} from './multitenant/store';
import { hashPassword, randomId } from './multitenant/auth';

function buildSharedUsername(slug: string): string {
  const withoutPrefix = slug.startsWith('wm2026-') ? slug.slice('wm2026-'.length) : slug;
  return `win2026%${withoutPrefix || slug}`;
}

export async function runSeed(): Promise<void> {
  const slug = (process.env.SEED_WORKSPACE_SLUG ?? 'bonnei-cup').trim().toLowerCase();
  const name = (process.env.SEED_WORKSPACE_NAME ?? 'Bonn-Ei').trim();
  const password = (process.env.SEED_WORKSPACE_PASSWORD ?? 'NLsWdNodnd').trim();

  if (!slug || !password) {
    return;
  }

  const sharedUsername = buildSharedUsername(slug);
  const existingTenant = findTenantBySlug(slug);

  if (existingTenant) {
    // Tenant exists — make sure the password hash is in sync
    const existingUser = findUserByUsername(sharedUsername);
    const storedPassword = existingTenant.sharedLoginPassword;

    if (storedPassword !== password || !existingUser) {
      // Repair hash and stored password
      const newHash = await hashPassword(password);
      updateDb((state) => {
        const mutableUser = existingUser
          ? state.users.find((u) => u.id === existingUser.id)
          : undefined;

        if (mutableUser) {
          mutableUser.passwordHash = newHash;
          mutableUser.username = sharedUsername;
        } else {
          // Create missing user
          const ownerUser = state.users.find((u) => u.id === existingTenant.ownerUserId);
          if (ownerUser) {
            ownerUser.username = sharedUsername;
            ownerUser.passwordHash = newHash;
          } else {
            state.users.push({
              id: randomId('usr'),
              username: sharedUsername,
              email: `${slug}@win2026.local`,
              name,
              passwordHash: newHash,
              createdAt: new Date().toISOString(),
            });
          }
        }

        // Update tenant stored password
        const mutableTenant = state.tenants.find((t) => t.slug === slug);
        if (mutableTenant) {
          mutableTenant.sharedLoginPassword = password;
          mutableTenant.sharedLoginUsername = sharedUsername;
        }
      });

      console.log(`[seed] Repaired credentials for workspace "${slug}"`);
    }
    return;
  }

  // Tenant does not exist — create it from scratch
  const passwordHash = await hashPassword(password);
  const tenantId = randomId('ten');
  const userId = randomId('usr');

  const user = addUser({
    id: userId,
    username: sharedUsername,
    email: `${slug}@win2026.local`,
    name,
    passwordHash,
    createdAt: new Date().toISOString(),
  });

  addTenant({
    id: tenantId,
    slug,
    name,
    ownerUserId: user.id,
    sharedLoginUsername: sharedUsername,
    sharedLoginPassword: password,
    createdAt: new Date().toISOString(),
  });

  addTenantMember({
    id: randomId('mem'),
    tenantId,
    userId: user.id,
    role: 'owner',
    createdAt: new Date().toISOString(),
  });

  console.log(`[seed] Created workspace "${slug}" with shared login "${sharedUsername}"`);
}
