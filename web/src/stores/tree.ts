import { defineStore } from 'pinia';
import { shallowRef, ref } from 'vue';
import { familiesApi } from '@/api/families';
import { kinshipApi } from '@/api/kinship';
import { formatApiError } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import type { TreeResponse, TreeNode, GenerationMeta } from '@/types/api';

/**
 * Tree Store (Cycle 2A)
 * Uses shallowRef for roots/members to avoid deep reactive overhead on large trees (Arch §7.2)
 * Memoized layout and lightweight selection refs.
 *
 * Phase 1 (family-tree-view): adds the batched kinship label dictionary
 * (Decision 2C) — populated relative to the linked user's member, cleared on
 * reset()/invalidate() (M5), and auto-refetched by fetchTree() when the
 * authenticated user is linked to a member.
 */
export const useTreeStore = defineStore('tree', () => {
  const familyId = ref<string | null>(null);
  const version = ref<number>(0);
  const generations = ref<GenerationMeta[]>([]);
  const roots = shallowRef<TreeNode[]>([]);
  const selectedId = ref<string | null>(null);
  const generationFilter = ref<number | null>(null);
  const kinshipLabels = ref<Record<string, string>>({});

  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchTree(id: string): Promise<TreeResponse | null> {
    familyId.value = id;
    loading.value = true;
    error.value = null;

    try {
      const res = await familiesApi.getTree(id);
      version.value = res.version;
      generations.value = res.generations || [];
      roots.value = res.roots || [];

      // Auto-refetch kinship labels when the signed-in user is linked to a
      // member (Phase 1 M5) — failures never break the tree render.
      const authStore = useAuthStore();
      const linkedMemberId = authStore.user?.member_id;
      if (linkedMemberId) {
        await fetchKinshipLabels(id, linkedMemberId);
      }

      return res;
    } catch (err) {
      const msg = formatApiError(err);
      error.value = msg;
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function invalidate(): Promise<void> {
    if (!familyId.value) return;

    // M5: cached labels are stale the moment the tree mutates — drop them
    // BEFORE refetching so a failed refetch never serves old relations.
    kinshipLabels.value = {};

    try {
      const res = await familiesApi.getTree(familyId.value);
      version.value = res.version;
      generations.value = res.generations || [];
      roots.value = res.roots || [];
    } catch (err) {
      error.value = formatApiError(err);
    }
  }

  /**
   * fetchKinshipLabels (Decision 2C): populate the memberID → kinship term
   * dictionary relative to fromMemberId. A labels failure is cosmetic —
   * the tree still renders — so errors are swallowed, never thrown.
   */
  async function fetchKinshipLabels(
    famId: string,
    fromMemberId: string,
    dialect?: 'bac' | 'trung' | 'nam' | string
  ): Promise<void> {
    try {
      const res = await kinshipApi.getFamilyKinshipLabels(famId, fromMemberId, dialect);
      kinshipLabels.value = res.labels ?? {};
    } catch (err) {
      // Keep prior labels; surface for diagnostics only.
      console.warn('[tree] không thể tải nhãn xưng hô:', formatApiError(err));
    }
  }

  function selectMember(id: string | null) {
    selectedId.value = id;
  }

  function setGenerationFilter(gen: number | null) {
    generationFilter.value = gen;
  }

  function reset() {
    familyId.value = null;
    version.value = 0;
    generations.value = [];
    roots.value = [];
    selectedId.value = null;
    generationFilter.value = null;
    kinshipLabels.value = {};
    error.value = null;
  }

  return {
    familyId,
    version,
    generations,
    roots,
    selectedId,
    generationFilter,
    kinshipLabels,
    loading,
    error,
    fetchTree,
    fetchKinshipLabels,
    invalidate,
    selectMember,
    setGenerationFilter,
    reset,
  };
});
