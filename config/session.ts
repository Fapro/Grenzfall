import { Platform } from 'react-native';
import { useState, useEffect } from 'react';

export type SessionUser = {
  id: string;
  email: string;
  name: string;
};

export type SessionTenant = {
  id: string;
  slug: string;
  name: string;
  ownerUserId: string;
  createdAt: string;
};

export type SessionMembership = {
  id: string;
  tenantId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
  createdAt: string;
  tenant?: SessionTenant | null;
};

export type AppSession = {
  token: string;
  user: SessionUser;
  currentTenant: SessionTenant | null;
  memberships: SessionMembership[];
};

const STORAGE_KEY = 'roar_app_session_v1';
let currentSession: AppSession | null = null;
const listeners = new Set<(session: AppSession | null) => void>();

function canUseLocalStorage(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined' && !!window.localStorage;
}

function notify(): void {
  listeners.forEach((listener) => listener(currentSession));
}

function readFromStorage(): AppSession | null {
  if (!canUseLocalStorage()) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as AppSession;
  } catch {
    return null;
  }
}

function writeToStorage(next: AppSession | null): void {
  if (!canUseLocalStorage()) {
    return;
  }

  if (!next) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function getSession(): AppSession | null {
  if (!currentSession) {
    currentSession = readFromStorage();
  }
  return currentSession;
}

export function setSession(next: AppSession): void {
  currentSession = next;
  writeToStorage(next);
  notify();
}

export function clearSession(): void {
  currentSession = null;
  writeToStorage(null);
  notify();
}

export function updateCurrentTenant(slug: string): void {
  const existing = getSession();
  if (!existing) {
    return;
  }

  const matched = existing.memberships.find((member) => member.tenant?.slug === slug)?.tenant ?? null;
  setSession({
    ...existing,
    currentTenant: matched,
  });
}

export function subscribeSession(listener: (session: AppSession | null) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSession() {
  const [session, setSessionState] = useState<AppSession | null>(getSession());

  useEffect(() => {
    const unsubscribe = subscribeSession((newSession) => {
      setSessionState(newSession);
    });
    return unsubscribe;
  }, []);

  return {
    user: session?.user || null,
    currentTenant: session?.currentTenant || null,
    memberships: session?.memberships || [],
    token: session?.token || null,
    isLoggedIn: !!session?.token,
  };
}
