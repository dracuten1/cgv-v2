import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useKinshipStore } from '@/stores/kinship';
import { kinshipApi } from '@/api/kinship';
import type { KinshipResult } from '@/types/api';

describe('Kinship Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
  });

  it('calculateKinship calls kinshipApi with correct parameters and updates state', async () => {
    const mockResult: KinshipResult = {
      term: 'Ông nội',
      line: 'Chi nội',
      generation_distance: 2,
      distance_label: 'Cách 2 đời',
      is_blood: true,
      dialect: 'bac',
      path: [
        'aaaaaaa1-0000-4000-8000-000000000001',
        'xxxxxxx-parent',
        'bbbbbbb2-0000-4000-8000-000000000002',
      ],
    };

    const calculateSpy = vi.spyOn(kinshipApi, 'calculate').mockResolvedValue(mockResult);

    const store = useKinshipStore();
    store.fromMemberId = 'aaaaaaa1-0000-4000-8000-000000000001';
    store.toMemberId = 'bbbbbbb2-0000-4000-8000-000000000002';
    store.dialect = 'bac';

    expect(store.loading).toBe(false);
    expect(store.result).toBeNull();

    const res = await store.calculateKinship();

    expect(calculateSpy).toHaveBeenCalledWith({
      from: 'aaaaaaa1-0000-4000-8000-000000000001',
      to: 'bbbbbbb2-0000-4000-8000-000000000002',
      dialect: 'bac',
    });

    expect(res).toEqual(mockResult);
    expect(store.result).toEqual(mockResult);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
  });

  it('calculateKinship sets error when IDs are missing', async () => {
    const store = useKinshipStore();
    store.fromMemberId = null;
    store.toMemberId = null;

    const res = await store.calculateKinship();
    expect(res).toBeNull();
    expect(store.error).toBe('Cần cung cấp đầy đủ thông tin hai thành viên.');
  });

  it('reset resets selection, result and error', () => {
    const store = useKinshipStore();
    store.fromMemberId = 'm1';
    store.toMemberId = 'm2';
    store.result = {
      term: 'Bác',
      line: 'Chi nội',
      generation_distance: 1,
      distance_label: 'Cách 1 đời',
      is_blood: true,
      dialect: 'bac',
      path: ['m1', 'm2'],
    };
    store.error = 'Lỗi';

    store.reset();

    expect(store.fromMemberId).toBeNull();
    expect(store.toMemberId).toBeNull();
    expect(store.result).toBeNull();
    expect(store.error).toBeNull();
  });
});