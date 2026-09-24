import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { meApi } from '@/api/me';
import { authApi } from '@/api/auth';
import { formatApiError, ApiError } from '@/api/client';
import { useTreeStore } from '@/stores/tree';
import type { User, UserIdentity, ContactPoint } from '@/types/api';

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'anonymous';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const identities = ref<UserIdentity[]>([]);
  const contacts = ref<ContactPoint[]>([]);
  const status = ref<AuthStatus>('idle');

  // In-flight promise cache so multiple guards / callers don't duplicate GET /me
  let fetchMePromise: Promise<User | null> | null = null;

  const isAuthenticated = computed(() => status.value === 'authenticated' && !!user.value);
  const isDemo = computed(() => user.value?.is_demo ?? false);
  const displayName = computed(() => user.value?.display_name || 'Khách');

  /**
   * fetchMe: silent on 401 (sets status anonymous, never throws).
   */
  async function fetchMe(force = false): Promise<User | null> {
    if (!force && status.value !== 'idle' && status.value !== 'loading') {
      return user.value;
    }

    if (fetchMePromise) {
      return fetchMePromise;
    }

    status.value = 'loading';

    fetchMePromise = (async () => {
      try {
        const profile = await meApi.getMe();
        user.value = profile.User;
        identities.value = profile.Identities || [];
        contacts.value = profile.Contacts || [];
        status.value = 'authenticated';
        return user.value;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          user.value = null;
          identities.value = [];
          contacts.value = [];
          status.value = 'anonymous';
          return null;
        }

        // On network error or other errors, set anonymous but log
        user.value = null;
        status.value = 'anonymous';
        return null;
      } finally {
        fetchMePromise = null;
      }
    })();

    return fetchMePromise;
  }

  async function loginMagicLink(token: string): Promise<void> {
    status.value = 'loading';
    try {
      const res = await authApi.verifyMagicLink(token);
      user.value = res.user;
      status.value = 'authenticated';
      await fetchMe(true);
    } catch (err) {
      status.value = 'anonymous';
      throw new Error(formatApiError(err));
    }
  }

  async function loginDemo(): Promise<void> {
    status.value = 'loading';
    try {
      const res = await authApi.startDemo();
      user.value = res.user;
      status.value = 'authenticated';
      // Refresh full profile in background
      await fetchMe(true);
    } catch (err) {
      status.value = 'anonymous';
      throw new Error(formatApiError(err));
    }
  }

  async function logout(): Promise<void> {
    try {
      await authApi.logout();
    } finally {
      user.value = null;
      identities.value = [];
      contacts.value = [];
      status.value = 'anonymous';
    }
  }

  function linkProviderStart(provider: string): void {
    window.location.href = meApi.getLinkProviderUrl(provider);
  }

  async function unlinkIdentity(identityId: string): Promise<void> {
    try {
      await meApi.unlinkIdentity(identityId);
      identities.value = identities.value.filter((i) => i.id !== identityId);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        throw new Error('Không thể hủy liên kết phương thức đăng nhập duy nhất của tài khoản.');
      }
      throw new Error(formatApiError(err));
    }
  }

  async function addContact(kind: 'email' | 'phone', value: string): Promise<ContactPoint> {
    try {
      const created = await meApi.addContact(kind, value);
      contacts.value.push(created);
      return created;
    } catch (err) {
      throw new Error(formatApiError(err));
    }
  }

  async function verifyContact(contactId: string): Promise<void> {
    try {
      await meApi.verifyContact(contactId);
    } catch (err) {
      throw new Error(formatApiError(err));
    }
  }

  /**
   * linkSelfToMember (Decision 3B, Phase 1): POST /me/member to bind the
   * signed-in account to a family-tree member, adopt the returned
   * auth.UserProfile (uniform with fetchMe), then refresh the tree's
   * kinship labels relative to the newly linked member.
   */
  async function linkSelfToMember(memberId: string): Promise<void> {
    try {
      const profile = await authApi.linkMember(memberId);
      user.value = profile.User;
      identities.value = profile.Identities || [];
      contacts.value = profile.Contacts || [];

      const treeStore = useTreeStore();
      if (treeStore.familyId) {
        await treeStore.fetchKinshipLabels(treeStore.familyId, memberId);
      }
    } catch (err) {
      throw err;
    }
  }

  return {
    user,
    identities,
    contacts,
    status,
    isAuthenticated,
    isDemo,
    displayName,
    fetchMe,
    loginMagicLink,
    loginDemo,
    logout,
    linkProviderStart,
    unlinkIdentity,
    addContact,
    verifyContact,
    linkSelfToMember,
  };
});
