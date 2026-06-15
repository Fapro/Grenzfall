import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, StyleSheet, View, Text, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { FlagGrid } from '@/components/FlagGrid';
import type { Team } from '@/data/teams';
import { apiFetch } from '@/config/api';
import {
  AppSession,
  SessionMembership,
  SessionTenant,
  clearSession,
  getSession,
  setSession,
  subscribeSession,
  updateCurrentTenant,
} from '@/config/session';

type AuthMode = 'login' | 'signup';

type AuthPayload = {
  token: string;
  user: {
    id: string;
    email: string;
    username?: string;
    name: string;
  };
  tenant?: SessionTenant | null;
  membership?: SessionMembership | null;
  tenants?: SessionTenant[];
  generatedCredentials?: {
    username: string;
    password: string;
  };
};

type MePayload = {
  user: {
    id: string;
    email: string;
    name: string;
  };
  memberships: SessionMembership[];
};

export default function HomeScreen() {
  const router = useRouter();
  const [session, setLocalSession] = useState<AppSession | null>(getSession());
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceSlug, setWorkspaceSlug] = useState('');

  useEffect(() => subscribeSession(setLocalSession), []);

  const activeMemberships = useMemo(() => session?.memberships ?? [], [session?.memberships]);

  const setSessionFromAuth = async (authData: AuthPayload): Promise<void> => {
    const token = authData.token;
    const meRes = await apiFetch('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    let memberships: SessionMembership[] = [];
    if (meRes.ok) {
      const me = (await meRes.json()) as MePayload;
      memberships = me.memberships ?? [];
    } else {
      memberships = (authData.membership ? [authData.membership] : []).filter(Boolean) as SessionMembership[];
    }

    const tenantCandidates = memberships
      .map((membership) => membership.tenant)
      .filter((tenant): tenant is SessionTenant => Boolean(tenant));

    const currentTenant = authData.tenant ?? tenantCandidates[0] ?? authData.tenants?.[0] ?? null;

    setSession({
      token,
      user: authData.user,
      memberships,
      currentTenant,
    });
  };

  const runAuth = async (): Promise<void> => {
    try {
      setLoading(true);
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/signup';
      const payload =
        mode === 'login'
          ? {
              username,
              password,
            }
          : {
              name,
              workspaceName,
              workspaceSlug,
            };

      const response = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = (await response.json()) as AuthPayload & { error?: string };
      if (!response.ok) {
        Alert.alert('Auth error', json.error ?? 'Authentication failed');
        return;
      }

      await setSessionFromAuth(json);
      setPassword('');

      if (mode === 'signup' && json.generatedCredentials) {
        Alert.alert(
          'Workspace login created',
          `Login: ${json.generatedCredentials.username}\nPassword: ${json.generatedCredentials.password}`
        );
      }
    } catch (error) {
      Alert.alert('Auth error', error instanceof Error ? error.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const logout = (): void => {
    clearSession();
    setPassword('');
  };

  const handleSelect = (team: Team, groupLetter?: string) => {
    if (groupLetter) {
      router.push({ pathname: `/${team.id}`, params: { group: groupLetter } });
      return;
    }
    router.push(`/${team.id}`);
  };

  const handleGroupSelect = (groupLetter: string) => {
    router.push(`/group/${groupLetter}`);
  };

  if (!session) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.authWrap}>
          <Text style={styles.title}>ROOAR Workspace</Text>
          <Text style={styles.subtitle}>Create your own World Cup tipping league</Text>
          <Text style={styles.inlineNote}>Shared login format: win2026%your-workspace</Text>

          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'login' ? styles.modeButtonActive : null]}
              onPress={() => setMode('login')}
            >
              <Text style={styles.modeButtonText}>Login</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'signup' ? styles.modeButtonActive : null]}
              onPress={() => setMode('signup')}
            >
              <Text style={styles.modeButtonText}>Sign up</Text>
            </TouchableOpacity>
          </View>

          {mode === 'login' ? (
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Login (e.g. win2026%bonnei-cup)"
              placeholderTextColor="#9bb59e"
              autoCapitalize="none"
            />
          ) : null}
          {mode === 'signup' ? (
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Full name"
              placeholderTextColor="#9bb59e"
            />
          ) : null}
          {mode === 'login' ? (
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor="#9bb59e"
              secureTextEntry
            />
          ) : null}

          {mode === 'signup' ? (
            <>
              <TextInput
                style={styles.input}
                value={workspaceName}
                onChangeText={setWorkspaceName}
                placeholder="Workspace name"
                placeholderTextColor="#9bb59e"
              />
              <TextInput
                style={styles.input}
                value={workspaceSlug}
                onChangeText={setWorkspaceSlug}
                placeholder="Workspace ID (e.g. bonn-ei)"
                placeholderTextColor="#9bb59e"
                autoCapitalize="none"
              />
            </>
          ) : null}

          {mode === 'signup' ? (
            <Text style={styles.inlineNote}>After creating the workspace, login and password are generated automatically.</Text>
          ) : null}

          <TouchableOpacity style={[styles.authButton, loading ? styles.authButtonDisabled : null]} onPress={runAuth} disabled={loading}>
            <Text style={styles.authButtonText}>{loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create workspace'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.sessionBar}>
        <View style={styles.sessionInfo}>
          <Text style={styles.sessionTitle}>{session.currentTenant?.name ?? 'No workspace selected'}</Text>
          <Text style={styles.sessionMeta}>{session.user.name} · {session.user.email}</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {activeMemberships.length > 1 ? (
        <ScrollView horizontal contentContainerStyle={styles.workspaceRow} showsHorizontalScrollIndicator={false}>
          {activeMemberships.map((membership) => {
            const slug = membership.tenant?.slug;
            const isActive = slug && session.currentTenant?.slug === slug;
            return (
              <TouchableOpacity
                key={membership.id}
                style={[styles.workspaceChip, isActive ? styles.workspaceChipActive : null]}
                onPress={() => {
                  if (slug) {
                    updateCurrentTenant(slug);
                  }
                }}
              >
                <Text style={styles.workspaceChipText}>{membership.tenant?.name ?? membership.tenantId}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}

      <FlagGrid onSelect={handleSelect} onGroupSelect={handleGroupSelect} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  authWrap: {
    padding: 22,
    gap: 10,
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#a9d7ae',
    fontSize: 14,
    marginBottom: 10,
  },
  inlineNote: {
    color: '#9ec7a1',
    fontSize: 12,
    marginBottom: 6,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#35543a',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modeButtonActive: {
    borderColor: '#4caf50',
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
  },
  modeButtonText: {
    color: '#dff5e1',
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#101a12',
    borderColor: '#2e7d32',
    borderWidth: 1,
    color: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  authButton: {
    marginTop: 8,
    backgroundColor: '#2e7d32',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  authButtonDisabled: {
    opacity: 0.65,
  },
  authButtonText: {
    color: '#fff',
    fontWeight: '800',
  },
  sessionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2f20',
    backgroundColor: '#0f1610',
  },
  sessionInfo: {
    flex: 1,
    paddingRight: 10,
  },
  sessionTitle: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
  sessionMeta: {
    color: '#9ec7a1',
    fontSize: 12,
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: '#2e7d32',
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  logoutButtonText: {
    color: '#dff5e1',
    fontWeight: '700',
    fontSize: 12,
  },
  workspaceRow: {
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1a281b',
  },
  workspaceChip: {
    borderWidth: 1,
    borderColor: '#35543a',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  workspaceChipActive: {
    borderColor: '#4caf50',
    backgroundColor: 'rgba(76, 175, 80, 0.18)',
  },
  workspaceChipText: {
    color: '#dff5e1',
    fontSize: 12,
    fontWeight: '700',
  },
});
