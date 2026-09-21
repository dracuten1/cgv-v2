import { defineStore } from 'pinia';
import { ref } from 'vue';
import { membersApi } from '@/api/members';
import { formatApiError } from '@/api/client';
import { useTreeStore } from '@/stores/tree';
import type { MemberDetailResponse, MemberInput, Member } from '@/types/api';

/**
 * Member Store (Cycle 2A)
 * Full CRUD wired to membersApi. After create/update/delete, invalidates the
 * tree store so the tree visualizer refetches a fresh version.
 */
export const useMemberStore = defineStore('member', () => {
  const currentMember = ref<MemberDetailResponse | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchMember(id: string): Promise<MemberDetailResponse | null> {
    loading.value = true;
    error.value = null;
    try {
      const res = await membersApi.getMember(id);
      currentMember.value = res;
      return res;
    } catch (err) {
      const msg = formatApiError(err);
      error.value = msg;
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function createMember(input: MemberInput): Promise<Member> {
    loading.value = true;
    error.value = null;
    try {
      const res = await membersApi.createMember(input);
      await useTreeStore().invalidate();
      return res;
    } catch (err) {
      const msg = formatApiError(err);
      error.value = msg;
      throw new Error(msg);
    } finally {
      loading.value = false;
    }
  }

  async function updateMember(id: string, input: MemberInput): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      await membersApi.updateMember(id, input);
      if (currentMember.value && currentMember.value.id === id) {
        await fetchMember(id);
      }
      await useTreeStore().invalidate();
    } catch (err) {
      const msg = formatApiError(err);
      error.value = msg;
      throw new Error(msg);
    } finally {
      loading.value = false;
    }
  }

  async function deleteMember(id: string): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      await membersApi.deleteMember(id);
      if (currentMember.value && currentMember.value.id === id) {
        currentMember.value = null;
      }
      await useTreeStore().invalidate();
    } catch (err) {
      const msg = formatApiError(err);
      error.value = msg;
      throw new Error(msg);
    } finally {
      loading.value = false;
    }
  }

  function reset() {
    currentMember.value = null;
    error.value = null;
  }

  return {
    currentMember,
    loading,
    error,
    fetchMember,
    createMember,
    updateMember,
    deleteMember,
    reset,
  };
});
