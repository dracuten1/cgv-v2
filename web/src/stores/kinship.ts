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

  watch([fromMemberId, toMemberId, dialect], () => {
    result.value = null;
    error.value = null;
  });

  async function calculateKinship(params?: Partial<KinshipQueryParams>): Promise<KinshipResult | null> {
    const from = params?.from || fromMemberId.value;
    const to = params?.to || toMemberId.value;
    const dia = params?.dialect || dialect.value;

    if (!from || !to) {
      error.value = 'Cần cung cấp đầy đủ thông tin hai thành viên.';
      return null;
    }

    loading.value = true;
    error.value = null;

    try {
      const res = await kinshipApi.calculate({ from, to, dialect: dia });
      result.value = res;
      return res;
    } catch (err) {
      error.value = formatApiError(err);
      return null;
    } finally {
      loading.value = false;
    }
  }

  function reset() {
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
