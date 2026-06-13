export type User = {
  id: string;
  username: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
};

export type Tenant = {
  id: string;
  slug: string;
  name: string;
  ownerUserId: string;
  createdAt: string;
};

export type TenantMember = {
  id: string;
  tenantId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
  createdAt: string;
};

export type Session = {
  token: string;
  userId: string;
  createdAt: string;
  lastSeenAt: string;
};

export type WorkspaceInvite = {
  id: string;
  token: string;
  tenantId: string;
  invitedByUserId: string;
  email?: string;
  role: 'admin' | 'member';
  createdAt: string;
  expiresAt: string;
  consumedAt?: string;
};

export type FriendTip = {
  home: string;
  away: string;
};

export type FriendEntry = {
  id: string;
  name: string;
  tips: Record<string, FriendTip>;
};

export type AppDb = {
  users: User[];
  tenants: Tenant[];
  members: TenantMember[];
  sessions: Session[];
  invites: WorkspaceInvite[];
  friendsByTenantTeam: Record<string, FriendEntry[]>;
};
