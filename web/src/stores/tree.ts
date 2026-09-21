import { defineStore } from 'pinia';
import { shallowRef, ref } from 'vue';
import { familiesApi } from '@/api/families';
import { formatApiError } from '@/api/client';
import type { TreeResponse, TreeNode, GenerationMeta } from '@/types/api';

/**
 * Tree Store (Cycle 2A)
 * Uses shallowRef for roots/members to avoid deep reactive overhead on large trees (Arch §7.2)
 * Memoized layout and lightweight selection refs.
 */
export const useTreeStore = defineStore('tree', () => {
  const familyId = ref<string | null>(null);
  const version = ref<number>(0);
  const generations = ref<GenerationMeta[]>([]);
  const roots = shallowRef<TreeNode[]>([]);
  const selectedId = ref<string | null>(null);
  const generationFilter = ref<number | null>(null);

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
    try {
      const res = await familiesApi.getTree(familyId.value);
      version.value = res.version;
      generations.value = res.generations || [];
      roots.value = res.roots || [];
    } catch (err) {
      error.value = formatApiError(err);
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
    error.value = null;
  }

  return {
    familyId,
    version,
    generations,
    roots,
    selectedId,
    generationFilter,
    loading,
    error,
    fetchTree,
    invalidate,
    selectMember,
    setGenerationFilter,
    reset,
  };
});
