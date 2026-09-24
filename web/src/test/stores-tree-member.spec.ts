import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises } from '@vue/test-utils';

vi.mock('@/api/members', () => ({
  membersApi: {
    listMembers: vi.fn(),
    getMember: vi.fn(),
    createMember: vi.fn(),
    updateMember: vi.fn(),
    deleteMember: vi.fn(),
  },
}));

vi.mock('@/api/families', () => ({
  familiesApi: {
    listFamilies: vi.fn(),
    getTree: vi.fn(),
    exportExcel: vi.fn(),
    importExcel: vi.fn(),
  },
}));

vi.mock('@/api/kinship', () => ({
  kinshipApi: {
    calculate: vi.fn(),
    getFamilyKinshipLabels: vi.fn(),
  },
}));

vi.mock('@/api/auth', () => ({
  authApi: {
    getProviders: vi.fn(),
    handleCallback: vi.fn(),
    sendMagicLink: vi.fn(),
    verifyMagicLink: vi.fn(),
    startDemo: vi.fn(),
    logout: vi.fn(),
    linkMember: vi.fn(),
  },
}));

import { membersApi } from '@/api/members';
import { familiesApi } from '@/api/families';
import { kinshipApi } from '@/api/kinship';
import { authApi } from '@/api/auth';
import { useTreeStore } from '@/stores/tree';
import { useMemberStore } from '@/stores/member';
import { useAuthStore } from '@/stores/auth';
import { ApiError } from '@/api/client';
import type { TreeResponse, MemberDetailResponse, UserProfile } from '@/types/api';

const mockedGetTree = vi.mocked(familiesApi.getTree);
const mockedGetMember = vi.mocked(membersApi.getMember);
const mockedCreate = vi.mocked(membersApi.createMember);
const mockedUpdate = vi.mocked(membersApi.updateMember);
const mockedDelete = vi.mocked(membersApi.deleteMember);
const mockedGetLabels = vi.mocked(kinshipApi.getFamilyKinshipLabels);
const mockedLinkMember = vi.mocked(authApi.linkMember);

const treePayload = (): TreeResponse => ({
  family_id: 'f1',
  version: 7,
  generations: [
    { index: 1, label: 'Đời thứ 1', count: 1 },
    { index: 2, label: 'Đời thứ 2', count: 2 },
  ],
  roots: [
    {
      id: 'root-1',
      full_name: 'Nguyễn Văn An',
      gender: 'male',
      generation_index: 1,
      is_living: false,
      spouse_ids: [],
      children: [],
    },
  ],
});

const memberPayload = (): MemberDetailResponse => ({
  id: 'member-9',
  family_id: 'f1',
  full_name: 'Nguyễn Văn An',
  gender: 'male',
  generation_index: 1,
  birth_date: '1930-04-12',
  death_date: '2001-08-30',
  is_living: false,
  notes: 'Thủy tổ',
  created_at: '2026-01-01T00:00:00Z',
  family_name: 'Họ Nguyễn',
  relations: { parents: [], children: [], siblings: [], spouses: [] },
  posts: [],
});

beforeEach(() => {
  vi.clearAllMocks();
  setActivePinia(createPinia());
  mockedGetTree.mockResolvedValue(treePayload());
  mockedGetMember.mockResolvedValue(memberPayload());
  mockedCreate.mockResolvedValue({
    id: 'new-1',
    family_id: 'f1',
    full_name: 'Nguyễn Thị Mai',
    gender: 'female',
    generation_index: 1,
    is_living: true,
    created_at: '2026-01-01T00:00:00Z',
  });
  mockedUpdate.mockResolvedValue({ message: 'Đã cập nhật' });
  mockedDelete.mockResolvedValue({ message: 'Đã xóa' });
  mockedGetLabels.mockResolvedValue({
    family_id: 'f1',
    from: 'member-9',
    dialect: 'bac',
    labels: { 'member-9': 'Tôi', 'root-1': 'Bố' },
  });
  mockedLinkMember.mockResolvedValue(linkProfilePayload());
});

const linkProfilePayload = (): UserProfile => ({
  User: {
    id: 'usr-1',
    display_name: 'Nguyễn Văn Thật',
    is_demo: false,
    member_id: 'member-9',
    created_at: '2026-01-01T00:00:00Z',
  },
  Identities: [],
  Contacts: [],
});

describe('tree store', () => {
  it('fetchTree stores roots, generations, version; error set on failure', async () => {
    const store = useTreeStore();

    const res = await store.fetchTree('f1');
    expect(res).not.toBeNull();
    expect(store.familyId).toBe('f1');
    expect(store.version).toBe(7);
    expect(store.generations[0].label).toBe('Đời thứ 1');
    expect(store.roots[0].full_name).toBe('Nguyễn Văn An');
    expect(store.error).toBeNull();
    expect(store.loading).toBe(false);

    mockedGetTree.mockRejectedValueOnce(
      new ApiError(500, 'INTERNAL', 'Máy chủ gặp sự cố.')
    );
    const failed = await store.fetchTree('f1');
    expect(failed).toBeNull();
    expect(store.error).toBe('Máy chủ gặp sự cố.');
  });

  it('invalidate() refetches the current family', async () => {
    const store = useTreeStore();
    await store.fetchTree('f1');
    mockedGetTree.mockClear();

    await store.invalidate();
    expect(mockedGetTree).toHaveBeenCalledTimes(1);
    expect(mockedGetTree).toHaveBeenCalledWith('f1');
  });

  it('invalidate() is a no-op when no family loaded', async () => {
    const store = useTreeStore();
    await store.invalidate();
    expect(mockedGetTree).not.toHaveBeenCalled();
  });

  it('selection + generation filter are plain refs (never re-run layout inputs)', () => {
    const store = useTreeStore();
    store.selectMember('member-9');
    expect(store.selectedId).toBe('member-9');
    store.setGenerationFilter(2);
    expect(store.generationFilter).toBe(2);
    store.setGenerationFilter(null);
    expect(store.generationFilter).toBeNull();

    store.reset();
    expect(store.familyId).toBeNull();
    expect(store.selectedId).toBeNull();
  });
});

describe('member store — CRUD wired to membersApi', () => {
  it('fetchMember stores the detail payload', async () => {
    const store = useMemberStore();
    const res = await store.fetchMember('member-9');
    expect(mockedGetMember).toHaveBeenCalledWith('member-9');
    expect(res?.full_name).toBe('Nguyễn Văn An');
    expect(store.currentMember?.family_name).toBe('Họ Nguyễn');
  });

  it('createMember posts the input then invalidates the tree', async () => {
    const treeStore = useTreeStore();
    await treeStore.fetchTree('f1');
    mockedGetTree.mockClear();

    const memberStore = useMemberStore();
    const created = await memberStore.createMember({
      family_id: 'f1',
      full_name: 'Nguyễn Thị Mai',
      gender: 'female',
    });

    expect(created.id).toBe('new-1');
    expect(mockedCreate).toHaveBeenCalledWith({
      family_id: 'f1',
      full_name: 'Nguyễn Thị Mai',
      gender: 'female',
    });
    expect(mockedGetTree).toHaveBeenCalledTimes(1); // tree invalidated
  });

  it('updateMember refetches the current member then invalidates the tree', async () => {
    const treeStore = useTreeStore();
    await treeStore.fetchTree('f1'); // real app: TreeView loads tree first
    mockedGetTree.mockClear();

    const memberStore = useMemberStore();
    await memberStore.fetchMember('member-9');
    mockedGetMember.mockClear();

    await memberStore.updateMember('member-9', {
      family_id: 'f1',
      full_name: 'Nguyễn Văn An',
      gender: 'male',
      notes: 'Cập nhật ghi chú',
    });

    expect(mockedUpdate).toHaveBeenCalledWith('member-9', expect.objectContaining({ notes: 'Cập nhật ghi chú' }));
    expect(mockedGetMember).toHaveBeenCalledWith('member-9'); // current refreshed
    expect(mockedGetTree).toHaveBeenCalledTimes(1); // tree invalidated
  });

  it('deleteMember clears current member and invalidates the tree', async () => {
    const treeStore = useTreeStore();
    await treeStore.fetchTree('f1');
    mockedGetTree.mockClear();

    const memberStore = useMemberStore();
    await memberStore.fetchMember('member-9');

    await memberStore.deleteMember('member-9');
    expect(mockedDelete).toHaveBeenCalledWith('member-9');
    expect(memberStore.currentMember).toBeNull();
    expect(mockedGetTree).toHaveBeenCalledTimes(1);
  });

  it('deleteMember for a non-current member still invalidates the tree', async () => {
    const treeStore = useTreeStore();
    await treeStore.fetchTree('f1');
    mockedGetTree.mockClear();

    const memberStore = useMemberStore();
    await memberStore.fetchMember('member-9');

    await memberStore.deleteMember('member-other');
    expect(memberStore.currentMember?.id).toBe('member-9'); // untouched
    expect(mockedGetTree).toHaveBeenCalledTimes(1);
  });

  it('CRUD failures throw with the Vietnamese API message and set error', async () => {
    mockedDelete.mockRejectedValueOnce(
      new ApiError(409, 'CONFLICT', 'Dữ liệu bị xung đột hoặc đã tồn tại.')
    );
    const memberStore = useMemberStore();

    await expect(memberStore.deleteMember('member-9')).rejects.toThrow(
      'Dữ liệu bị xung đột hoặc đã tồn tại.'
    );
    await flushPromises();
    expect(memberStore.error).toBe('Dữ liệu bị xung đột hoặc đã tồn tại.');
  });
});

describe('Phase 1 data contract assertions (phase1-plan.md §3 / M5)', () => {
  it('1. Calling fetchKinshipLabels saves labels to treeStore.kinshipLabels', async () => {
    const store = useTreeStore();
    expect(store.kinshipLabels).toEqual({});

    await store.fetchKinshipLabels('f1', 'member-9');
    expect(mockedGetLabels).toHaveBeenCalledWith('f1', 'member-9', undefined);
    expect(store.kinshipLabels).toEqual({
      'member-9': 'Tôi',
      'root-1': 'Bố',
    });
  });

  it('2. Calling treeStore.invalidate() clears cached kinshipLabels', async () => {
    const store = useTreeStore();
    await store.fetchTree('f1');
    await store.fetchKinshipLabels('f1', 'member-9');
    expect(Object.keys(store.kinshipLabels).length).toBeGreaterThan(0);

    await store.invalidate();
    // Invalidate refetches the tree; because authStore has no linked user here,
    // kinshipLabels remains cleanly emptied.
    expect(store.kinshipLabels).toEqual({});
  });

  it('2b. reset() clears kinshipLabels (M5)', async () => {
    const store = useTreeStore();
    await store.fetchKinshipLabels('f1', 'member-9');
    expect(Object.keys(store.kinshipLabels).length).toBeGreaterThan(0);

    store.reset();
    expect(store.kinshipLabels).toEqual({});
  });

  it('3. authStore.linkSelfToMember sets user.member_id and triggers fetchKinshipLabels', async () => {
    const treeStore = useTreeStore();
    await treeStore.fetchTree('f1');
    mockedGetLabels.mockClear();

    const authStore = useAuthStore();
    expect(authStore.user).toBeNull();

    await authStore.linkSelfToMember('member-9');

    expect(mockedLinkMember).toHaveBeenCalledWith('member-9');
    expect(authStore.user?.member_id).toBe('member-9');
    expect(mockedGetLabels).toHaveBeenCalledTimes(1);
    expect(mockedGetLabels).toHaveBeenCalledWith('f1', 'member-9', undefined);
    expect(treeStore.kinshipLabels['member-9']).toBe('Tôi');
  });

  it('4. fetchTree auto-refetches kinshipLabels when authStore.user has a member_id', async () => {
    const authStore = useAuthStore();
    authStore.user = {
      id: 'usr-1',
      display_name: 'Nguyễn Văn Thật',
      is_demo: false,
      member_id: 'member-9',
      created_at: '2026-01-01T00:00:00Z',
    };

    mockedGetLabels.mockClear();
    const treeStore = useTreeStore();
    await treeStore.fetchTree('f1');

    expect(mockedGetLabels).toHaveBeenCalledTimes(1);
    expect(mockedGetLabels).toHaveBeenCalledWith('f1', 'member-9', undefined);
    expect(treeStore.kinshipLabels['member-9']).toBe('Tôi');
  });
});
