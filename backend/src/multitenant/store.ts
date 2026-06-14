import fs from 'fs';
import path from 'path';
import {
  AppDb,
  ChatMessage,
  FriendEntry,
  Session,
  Tenant,
  TenantMember,
  User,
  WorkspaceInvite,
} from './types';

const DATA_ROOT =
  String(process.env.DATA_DIR ?? '').trim() ||
  String(process.env.RENDER_DISK_PATH ?? '').trim() ||
  path.resolve(process.cwd(), '.data');

const DB_DIR = path.resolve(DATA_ROOT);
const DB_FILE = path.join(DB_DIR, 'multitenant.json');
const DB_BACKUP_FILE = path.join(DB_DIR, 'multitenant.backup.json');

const EMPTY_DB: AppDb = {
  users: [],
  tenants: [],
  members: [],
  sessions: [],
  invites: [],
  friendsByTenantTeam: {},
  chatByTenant: {},
};

function cloneDb(input: AppDb): AppDb {
  return JSON.parse(JSON.stringify(input)) as AppDb;
}

function ensureDbDir(): void {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

function parseDb(raw: string): AppDb {
  const parsed = JSON.parse(raw) as Partial<AppDb>;
  return {
    users: parsed.users ?? [],
    tenants: parsed.tenants ?? [],
    members: parsed.members ?? [],
    sessions: parsed.sessions ?? [],
    invites: parsed.invites ?? [],
    friendsByTenantTeam: parsed.friendsByTenantTeam ?? {},
    chatByTenant: parsed.chatByTenant ?? {},
  };
}

function persistSnapshot(snapshot: AppDb): void {
  ensureDbDir();
  const serialized = JSON.stringify(snapshot, null, 2);
  const tempFile = `${DB_FILE}.tmp`;

  if (fs.existsSync(DB_FILE)) {
    fs.copyFileSync(DB_FILE, DB_BACKUP_FILE);
  }

  fs.writeFileSync(tempFile, serialized, 'utf8');
  fs.renameSync(tempFile, DB_FILE);
}

function readDbFromDisk(): AppDb {
  try {
    ensureDbDir();

    if (!fs.existsSync(DB_FILE)) {
      persistSnapshot(EMPTY_DB);
      return cloneDb(EMPTY_DB);
    }

    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return parseDb(raw);
  } catch (error) {
    console.error('[multitenant-store] Failed to read main DB file:', error);
    try {
      if (fs.existsSync(DB_BACKUP_FILE)) {
        const rawBackup = fs.readFileSync(DB_BACKUP_FILE, 'utf8');
        const restored = parseDb(rawBackup);
        persistSnapshot(restored);
        console.warn('[multitenant-store] Restored DB from backup file.');
        return restored;
      }
    } catch (backupError) {
      console.error('[multitenant-store] Failed to restore DB from backup:', backupError);
    }

    console.error('[multitenant-store] Falling back to empty DB.');
    persistSnapshot(EMPTY_DB);
    return cloneDb(EMPTY_DB);
  }
}

let db = readDbFromDisk();

function persist(): void {
  persistSnapshot(db);
}

export function getDb(): AppDb {
  return db;
}

export function updateDb(mutator: (state: AppDb) => void): void {
  mutator(db);
  persist();
}

export function findUserByEmail(email: string): User | undefined {
  const normalized = email.trim().toLowerCase();
  return db.users.find((u) => u.email === normalized);
}

export function findUserByUsername(username: string): User | undefined {
  const normalized = username.trim().toLowerCase();
  return db.users.find((u) => String(u.username ?? '').trim().toLowerCase() === normalized);
}

export function findUserById(userId: string): User | undefined {
  return db.users.find((u) => u.id === userId);
}

export function addUser(user: User): User {
  updateDb((state) => {
    state.users.push(user);
  });
  return user;
}

export function findTenantBySlug(slug: string): Tenant | undefined {
  return db.tenants.find((t) => t.slug === slug.trim().toLowerCase());
}

export function findTenantById(tenantId: string): Tenant | undefined {
  return db.tenants.find((t) => t.id === tenantId);
}

export function addTenant(tenant: Tenant): Tenant {
  updateDb((state) => {
    state.tenants.push(tenant);
  });
  return tenant;
}

export function addTenantMember(member: TenantMember): TenantMember {
  updateDb((state) => {
    state.members.push(member);
  });
  return member;
}

export function listMembersByUserId(userId: string): TenantMember[] {
  return db.members.filter((m) => m.userId === userId);
}

export function listMembersByTenantId(tenantId: string): TenantMember[] {
  return db.members.filter((m) => m.tenantId === tenantId);
}

export function findTenantMember(tenantId: string, userId: string): TenantMember | undefined {
  return db.members.find((m) => m.tenantId === tenantId && m.userId === userId);
}

export function createSession(session: Session): Session {
  updateDb((state) => {
    state.sessions.push(session);
  });
  return session;
}

export function findSession(token: string): Session | undefined {
  return db.sessions.find((s) => s.token === token);
}

export function touchSession(token: string): void {
  updateDb((state) => {
    const session = state.sessions.find((s) => s.token === token);
    if (session) {
      session.lastSeenAt = new Date().toISOString();
    }
  });
}

export function addWorkspaceInvite(invite: WorkspaceInvite): WorkspaceInvite {
  updateDb((state) => {
    state.invites.push(invite);
  });
  return invite;
}

export function findWorkspaceInviteByToken(token: string): WorkspaceInvite | undefined {
  return db.invites.find((invite) => invite.token === token);
}

export function listWorkspaceInvitesByTenantId(tenantId: string): WorkspaceInvite[] {
  return db.invites.filter((invite) => invite.tenantId === tenantId);
}

export function consumeWorkspaceInvite(token: string): WorkspaceInvite | undefined {
  let updated: WorkspaceInvite | undefined;
  updateDb((state) => {
    const invite = state.invites.find((entry) => entry.token === token);
    if (!invite) {
      return;
    }
    invite.consumedAt = new Date().toISOString();
    updated = { ...invite };
  });
  return updated;
}

function friendsKey(tenantId: string, teamId: string): string {
  return `${tenantId}:${teamId}`;
}

export function getTenantTeamFriends(tenantId: string, teamId: string): FriendEntry[] {
  return db.friendsByTenantTeam[friendsKey(tenantId, teamId)] ?? [];
}

export function setTenantTeamFriends(
  tenantId: string,
  teamId: string,
  friends: FriendEntry[]
): FriendEntry[] {
  updateDb((state) => {
    state.friendsByTenantTeam[friendsKey(tenantId, teamId)] = friends;
  });
  return friends;
}

export function updateTenantSharedCredentials(
  tenantId: string,
  username: string,
  password: string
): Tenant | undefined {
  let updated: Tenant | undefined;
  updateDb((state) => {
    const tenant = state.tenants.find((t) => t.id === tenantId);
    if (!tenant) {
      return;
    }
    tenant.sharedLoginUsername = username;
    tenant.sharedLoginPassword = password;
    updated = { ...tenant };
  });
  return updated;
}
