import React, { useCallback, useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { apiFetch } from '@/config/api';
import { useSession } from '@/config/session';

type WorkspaceMember = {
  id: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
  user: {
    id: string;
    name: string;
    email: string;
  };
};

type PendingInvite = {
  id: string;
  token: string;
  email?: string;
  role: 'admin' | 'member';
  createdAt: string;
  expiresAt: string;
};

export default function WorkspaceAdminScreen() {
  const router = useRouter();
  const { currentTenant, user } = useSession();

  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  useEffect(() => {
    if (!currentTenant) {
      router.push('/');
      return;
    }

    loadData();
  }, [currentTenant]);

  const loadData = useCallback(async () => {
    if (!currentTenant) return;

    setLoading(true);
    try {
      // Load members
      const membersRes = await apiFetch('/api/workspaces/current');
      if (membersRes.ok) {
        const workspace = await membersRes.json();
        setMembers(workspace.members || []);

        // Check if current user is admin
        const currentUserMember = (workspace.members || []).find(
          (m: any) => m.userId === user?.id
        );
        setIsAdmin(
          currentUserMember?.role === 'owner' || currentUserMember?.role === 'admin'
        );
      }

      // Load invites
      const invitesRes = await apiFetch('/api/workspaces/current/invites');
      if (invitesRes.ok) {
        const invites = await invitesRes.json();
        setPendingInvites(invites || []);
      }
    } catch (error) {
      console.error('Failed to load workspace data:', error);
      Alert.alert('Error', 'Failed to load workspace data');
    } finally {
      setLoading(false);
    }
  }, [currentTenant, user?.id]);

  const handleCreateInvite = useCallback(async () => {
    if (!inviteEmail.trim()) {
      Alert.alert('Email required', 'Please enter an email address');
      return;
    }

    setInviteLoading(true);
    try {
      const res = await apiFetch('/api/workspaces/current/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
        }),
      });

      if (res.ok) {
        Alert.alert('Success', 'Invite created! Invite link generated.');
        setInviteEmail('');
        setInviteRole('member');
        setShowInviteModal(false);
        await loadData();
      } else {
        const error = await res.json();
        Alert.alert('Error', error.error || 'Failed to create invite');
      }
    } catch (error) {
      console.error('Failed to create invite:', error);
      Alert.alert('Error', 'Failed to create invite');
    } finally {
      setInviteLoading(false);
    }
  }, [inviteEmail, inviteRole, loadData]);

  const handleCopyInviteLink = useCallback((token: string) => {
    const link = `${window.location.origin}/?inviteToken=${token}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    }
  }, []);

  if (!currentTenant) {
    return null;
  }

  if (loading) {
    return (
      <LinearGradient colors={['#0a1a0a', '#0d1f0d']} style={styles.gradient}>
        <SafeAreaView style={styles.container}>
          <ActivityIndicator size="large" color="#2e7d32" />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!isAdmin) {
    return (
      <LinearGradient colors={['#0a1a0a', '#0d1f0d']} style={styles.gradient}>
        <SafeAreaView style={styles.container}>
          <View style={styles.centerContent}>
            <Text style={styles.errorText}>
              Only workspace admins can access this page.
            </Text>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Text style={styles.backButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0a1a0a', '#0d1f0d']} style={styles.gradient}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{currentTenant.name}</Text>
            <Text style={styles.subtitle}>Workspace Admin</Text>
          </View>

          {/* Members Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>👥 Members ({members.length})</Text>
            <View style={styles.membersList}>
              {members.map((member) => (
                <View key={member.id} style={styles.memberCard}>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{member.user.name}</Text>
                    <Text style={styles.memberEmail}>{member.user.email}</Text>
                  </View>
                  <View style={styles.memberRole}>
                    <Text
                      style={[
                        styles.roleTag,
                        member.role === 'owner' && styles.roleTagOwner,
                        member.role === 'admin' && styles.roleTagAdmin,
                      ]}
                    >
                      {member.role.toUpperCase()}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Pending Invites Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>📧 Pending Invites</Text>
              <TouchableOpacity
                style={styles.createInviteButton}
                onPress={() => setShowInviteModal(true)}
              >
                <Text style={styles.createInviteButtonText}>+ New Invite</Text>
              </TouchableOpacity>
            </View>

            {pendingInvites.length === 0 ? (
              <Text style={styles.emptyText}>No pending invites</Text>
            ) : (
              <View style={styles.invitesList}>
                {pendingInvites.map((invite) => (
                  <View key={invite.id} style={styles.inviteCard}>
                    <View style={styles.inviteInfo}>
                      <Text style={styles.inviteEmail}>
                        {invite.email || 'No email'}
                      </Text>
                      <Text style={styles.inviteRole}>Role: {invite.role}</Text>
                      <Text style={styles.inviteExpires}>
                        Expires:{' '}
                        {new Date(invite.expiresAt).toLocaleDateString()}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.copyButton}
                      onPress={() => handleCopyInviteLink(invite.token)}
                    >
                      <Text style={styles.copyButtonText}>
                        {copiedToken === invite.token ? '✓ Copied' : 'Copy Link'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>

        {/* Create Invite Modal */}
        <Modal
          visible={showInviteModal}
          animationType="slide"
          transparent
          onRequestClose={() => setShowInviteModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Create Invite</Text>
                <TouchableOpacity
                  onPress={() => setShowInviteModal(false)}
                  style={styles.closeButton}
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Email Address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="user@example.com"
                  value={inviteEmail}
                  onChangeText={setInviteEmail}
                  keyboardType="email-address"
                  editable={!inviteLoading}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Role</Text>
                <View style={styles.roleSelector}>
                  {(['member', 'admin'] as const).map((role) => (
                    <Pressable
                      key={role}
                      style={[
                        styles.roleOption,
                        inviteRole === role && styles.roleOptionSelected,
                      ]}
                      onPress={() => setInviteRole(role)}
                    >
                      <Text
                        style={[
                          styles.roleOptionText,
                          inviteRole === role && styles.roleOptionTextSelected,
                        ]}
                      >
                        {role.charAt(0).toUpperCase() + role.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  inviteLoading && styles.submitButtonDisabled,
                ]}
                onPress={handleCreateInvite}
                disabled={inviteLoading}
              >
                {inviteLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Create Invite</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 24,
  },
  backText: {
    color: '#2e7d32',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    color: '#9cd6a0',
    fontSize: 14,
    fontWeight: '500',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  errorText: {
    color: '#ff8a8a',
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: '#2e7d32',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  section: {
    marginBottom: 28,
    padding: 14,
    backgroundColor: 'rgba(20, 35, 20, 0.6)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2b3a2c',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  createInviteButton: {
    backgroundColor: '#2e7d32',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  createInviteButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  membersList: {
    gap: 10,
  },
  memberCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3a5040',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  memberEmail: {
    color: '#9cd6a0',
    fontSize: 12,
    marginTop: 2,
  },
  memberRole: {
    marginLeft: 12,
  },
  roleTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#1b5e20',
    color: '#9cd6a0',
    fontSize: 10,
    fontWeight: '700',
    overflow: 'hidden',
  },
  roleTagOwner: {
    backgroundColor: '#ff6f00',
    color: '#ffffff',
  },
  roleTagAdmin: {
    backgroundColor: '#1e88e5',
    color: '#ffffff',
  },
  emptyText: {
    color: '#7fa886',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 20,
  },
  invitesList: {
    gap: 10,
  },
  inviteCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3a5040',
  },
  inviteInfo: {
    flex: 1,
  },
  inviteEmail: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
  },
  inviteRole: {
    color: '#9cd6a0',
    fontSize: 11,
    marginTop: 4,
  },
  inviteExpires: {
    color: '#7fa886',
    fontSize: 10,
    marginTop: 2,
  },
  copyButton: {
    backgroundColor: '#2e7d32',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 12,
  },
  copyButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 11,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'rgba(18, 28, 18, 0.98)',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    minHeight: 300,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '300',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    color: '#9cd6a0',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#111713',
    borderWidth: 1,
    borderColor: '#3a5040',
    borderRadius: 8,
    color: '#ffffff',
    padding: 12,
    fontSize: 14,
  },
  roleSelector: {
    flexDirection: 'row',
    gap: 10,
  },
  roleOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#3a5040',
    backgroundColor: '#111713',
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleOptionSelected: {
    backgroundColor: '#2e7d32',
    borderColor: '#4caf50',
  },
  roleOptionText: {
    color: '#9cd6a0',
    fontWeight: '600',
    fontSize: 13,
  },
  roleOptionTextSelected: {
    color: '#ffffff',
  },
  submitButton: {
    backgroundColor: '#2e7d32',
    paddingVertical: 14,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
});
