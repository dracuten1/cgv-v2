import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { kinshipApi, type KinshipQueryParams } from '@/api/kinship';
import { formatApiError } from '@/api/client';
import type { KinshipResult } from '@/types/api';

/**
 * Kinship store skeleton (Cycle 2B owns)
 */
export const useKinshipStore = defineStore('kinship', () => {
  const fromMemberId = ref<string | null>(null);
  const toMemberId = ref<string | null>(null);
  const dialect = ref<'bac' | 'trung' | 'nam'>('bac');
  const result = ref<KinshipResult | null>(null);

  const loading = ref(false);
  const error = ref<string | null>(null);

  // Monotonic request sequence (not reactive — internal bookkeeping). Bumped by
  // every calculateKinship() AND by any state invalidation (watcher / reset) so
  // a stale in-flight response can never commit over newer state.
  let requestSeq = 0;

  watch(
    [fromMemberId, toMemberId, dialect],
    () => {
      // Invalidate any in-flight calculation first (added 1fdc1b2: clear stale
      // result/error on picker change) so its late response cannot resurrect
      // data for the old selection. Nothing else owns `loading` after the bump.
      // flush:'sync' ensures the bump lands BEFORE any calculateKinship() that
      // follows a selection change in the same tick — the new call always
      // captures the highest sequence and its response commits.
      requestSeq++;
      loading.value = false;
      result.value = null;
      error.value = null;
    },
    { flush: 'sync' }
  );

  async function calculateKinship(params?: Partial<KinshipQueryParams>): Promise<KinshipResult | null> {
    const from = params?.from || fromMemberId.value;
    const to = params?.to || toMemberId.value;
    const dia = params?.dialect || dialect.value;

    if (!from || !to) {
      error.value = 'Cần cung cấp đầy đủ thông tin hai thành viên.';
      return null;
    }

    const seq = ++requestSeq;
    loading.value = true;
    error.value = null;

    try {
      const res = await kinshipApi.calculate({ from, to, dialect: dia });
      if (seq !== requestSeq) {
        // Superseded: a newer calculation started (or selections changed and
        // cleared state) while this request was in flight — drop it.
        return res;
      }
      result.value = res;
      return res;
    } catch (err) {
      if (seq !== requestSeq) {
        // Superseded failure — must not clobber the newer call's state.
        return null;
      }
      error.value = formatApiError(err);
      return null;
    } finally {
      // Only the owning (latest) request may clear `loading`; a superseded
      // request's finally must not cancel the newer one's spinner.
      if (seq === requestSeq) {
        loading.value = false;
      }
    }
  }

  function reset() {
    requestSeq++; // orphan any in-flight calculation
    loading.value = false;
    fromMemberId.value = null;
    toMemberId.value = null;
    result.value = null;
    error.value = null;
  }

  return {
    fromMemberId,
    toMemberId,
    dialect,
    result,
    loading,
    error,
    calculateKinship,
    reset,
  };
});
