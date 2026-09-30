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

  /**
   * Monotonic request token for latest-wins fetch arbitration: only the most
   * recently initiated fetchTree()/invalidate() may commit tree state. Overlap
   * is real (route watcher + family selector + member-save invalidate), and an
   * older in-flight response would otherwise commit the WRONG family's
   * roots/generations/version after the selection changed (review MAJOR,
   * b71b66d iteration 2). Commits are therefore atomic with the selected
   * family; superseded results (and their errors) are dropped silently.
   */
  let requestSeq = 0;

  async function fetchTree(id: string): Promise<TreeResponse | null> {
    const seq = ++requestSeq;
    familyId.value = id;
    loading.value = true;
    error.value = null;
    kinshipLabels.value = {};

    try {
      const res = await familiesApi.getTree(id);
      if (seq !== requestSeq) return null; // superseded — never commit stale family state

      version.value = res.version;
      generations.value = res.generations || [];
      roots.value = res.roots || [];

      // Auto-refetch kinship labels when the signed-in user is linked to a
      // member (Phase 1 M5) — failures never break the tree render. The seq
      // guard stops a superseded request from overwriting the newer family's
      // labels when its label response lands late.
      const authStore = useAuthStore();
      const linkedMemberId = authStore.user?.member_id;
      if (linkedMemberId) {
        await fetchKinshipLabels(id, linkedMemberId, undefined, seq);
      }

      return res;
    } catch (err) {
      if (seq !== requestSeq) return null; // superseded failure — newer request owns error/loading
      error.value = formatApiError(err);
      return null;
    } finally {
      // Only the current request may clear loading; a stale request finishing
      // late must not flip the spinner off while the newer one is in flight.
      if (seq === requestSeq) {
        loading.value = false;
      }
    }
  }

  async function invalidate(): Promise<void> {
    if (!familyId.value) return;
    const seq = ++requestSeq;

    // M5: cached labels are stale the moment the tree mutates — drop them
    // BEFORE refetching so a failed refetch never serves old relations.
    kinshipLabels.value = {};

    // Invalidate takes ownership of the loading lifecycle: when it supersedes
    // an in-flight fetchTree, that fetch's finally skips its clear (seq
    // mismatch), so invalidate must claim the spinner here and release it in
    // its own finally — or the spinner sticks on forever (regression f2b5d2e).
    loading.value = true;

    try {
      const res = await familiesApi.getTree(familyId.value);
      if (seq !== requestSeq) return; // superseded (e.g. user switched family mid-refetch)
      version.value = res.version;
      generations.value = res.generations || [];
      roots.value = res.roots || [];
    } catch (err) {
      if (seq !== requestSeq) return;
      error.value = formatApiError(err);
    } finally {
      // Same latest-wins guard as fetchTree: a stale invalidate finishing
      // after a newer fetchTree/invalidate started must never flip the newer
      // request's spinner off.
      if (seq === requestSeq) {
        loading.value = false;
      }
    }
  }

  /**
   * fetchKinshipLabels (Decision 2C): populate the memberID → kinship term
   * dictionary relative to fromMemberId. A labels failure is cosmetic —
   * the tree still renders — so errors are swallowed, never thrown.
   *
   * `expectedSeq` is internal: fetchTree passes its request token so a label
   * response landing after a newer fetchTree started cannot commit labels for
   * the wrong family. Direct callers (auth link flow) omit it — behavior
   * identical to the unguarded path.
   */
  async function fetchKinshipLabels(
    famId: string,
    fromMemberId: string,
    dialect?: 'bac' | 'trung' | 'nam' | string,
    expectedSeq?: number
  ): Promise<void> {
    if (expectedSeq !== undefined && expectedSeq !== requestSeq) return;
    kinshipLabels.value = {};
    try {
      const res = await kinshipApi.getFamilyKinshipLabels(famId, fromMemberId, dialect);
      if (expectedSeq !== undefined && expectedSeq !== requestSeq) return; // superseded
      kinshipLabels.value = res.labels ?? {};
    } catch (err) {
      // Surface for diagnostics only.
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
    // Orphan any in-flight fetchTree()/invalidate(): without this bump a
    // response landing after reset() would pass the seq guard and repopulate
    // the cleared store (familyId=null, version 0). Paired with loading=false
    // below because the orphaned fetch's finally now skips its own clear.
    requestSeq++;
    familyId.value = null;
    version.value = 0;
    generations.value = [];
    roots.value = [];
    selectedId.value = null;
    generationFilter.value = null;
    kinshipLabels.value = {};
    error.value = null;
    loading.value = false;
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
