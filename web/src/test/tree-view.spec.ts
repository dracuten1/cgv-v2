import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import TreeView from '@/views/TreeView.vue';

vi.mock('@/api/families', () => ({
  familiesApi: {
    listFamilies: vi.fn(),
    getTree: vi.fn(),
    exportExcel: vi.fn(),
    importExcel: vi.fn(),
  },
}));

vi.mock('@/api/me', () => ({
  meApi: { getMe: vi.fn().mockRejectedValue(new Error('anonymous')) },
}));

import { familiesApi } from '@/api/families';
import { ApiError } from '@/api/client';
import { useTreeStore } from '@/stores/tree';
import type { TreeResponse } from '@/types/api';

const mockedListFamilies = vi.mocked(familiesApi.listFamilies);
const mockedGetTree = vi.mocked(familiesApi.getTree);

const treePayload = (roots: TreeResponse['roots']): TreeResponse => ({
  family_id: 'f1',
  version: 3,
  generations: [
    { index: 1, label: 'Đời thứ 1', count: 1 },
    { index: 2, label: 'Đời thứ 2', count: 2 },
  ],
  roots,
});

const rootAn = {
  id: 'aaaaaaa1-0000-4000-8000-000000000001',
  full_name: 'Nguyễn Văn An',
  gender: 'male' as const,
  generation_index: 1,
  birth_date: '1930-01-01',
  death_date: '2001-05-15',
  is_living: false,
  spouse_ids: [],
  children: [],
};

const mountTree = () =>
  mount(TreeView, {
    global: {
      stubs: {
        // Slim stub: keeps DOM presence without running gesture/canvas internals
        TreeVisualizer: { template: '<div data-testid="visualizer-stub" />' },
      },
    },
  });

beforeEach(() => {
  vi.clearAllMocks();
  setActivePinia(createPinia());
  mockedListFamilies.mockResolvedValue({
    families: [
      { id: 'f1', name: 'Họ Nguyễn', version: 1, created_at: '2026-01-01T00:00:00Z' },
      { id: 'f2', name: 'Họ Trần', version: 1, created_at: '2026-01-02T00:00:00Z' },
    ],
  });
  mockedGetTree.mockResolvedValue(treePayload([rootAn]));
});

describe('TreeView', () => {
  it('auto-selects the first family on mount and fetches its tree', async () => {
    const wrapper = mountTree();
    await flushPromises();

    expect(mockedListFamilies).toHaveBeenCalledTimes(1);
    expect(mockedGetTree).toHaveBeenCalledWith('f1');
    expect(wrapper.find('[data-testid="tree-family-name"]').text()).toBe('Họ Nguyễn');
  });

  it('renders generation filter chips with "Đời thứ 1" label from meta + "Tất cả"', async () => {
    const wrapper = mountTree();
    await flushPromises();

    const filter = wrapper.find('[data-testid="tree-generation-filter"]');
    expect(filter.exists()).toBe(true);
    expect(filter.text()).toContain('Tất cả');
    expect(wrapper.find('[data-testid="filter-gen-1"]').text()).toContain('Đời thứ 1');
    expect(wrapper.find('[data-testid="filter-gen-2"]').text()).toContain('Đời thứ 2');
  });

  it('clicking a generation chip sets the store filter; "Tất cả" resets', async () => {
    const wrapper = mountTree();
    await flushPromises();
    const store = useTreeStore();

    await wrapper.find('[data-testid="filter-gen-1"]').trigger('click');
    expect(store.generationFilter).toBe(1);

    await wrapper.find('[data-testid="filter-all"]').trigger('click');
    expect(store.generationFilter).toBeNull();
  });

  it('shows the Vietnamese empty state when the tree has no roots', async () => {
    mockedGetTree.mockResolvedValueOnce(treePayload([]));
    const wrapper = mountTree();
    await flushPromises();

    expect(wrapper.text()).toContain('Chưa có dữ liệu gia phả.');
  });

  it('shows the Vietnamese error state with retry when fetch fails', async () => {
    mockedGetTree.mockRejectedValueOnce(new ApiError(500, 'INTERNAL', 'Máy chủ gặp sự cố.'));
    const wrapper = mountTree();
    await flushPromises();

    expect(wrapper.text()).toContain('Không thể tải cây gia phả');
    expect(wrapper.text()).toContain('Máy chủ gặp sự cố.');
    expect(wrapper.find('[data-testid="tree-retry"]').exists()).toBe(true);
  });

  it('shows loading spinner while fetching', async () => {
    let resolveTree!: (v: TreeResponse) => void;
    mockedGetTree.mockImplementationOnce(() => new Promise((res) => (resolveTree = res)));

    const wrapper = mountTree();
    await flushPromises(); // listFamilies resolved, getTree pending

    expect(wrapper.find('[data-testid="tree-loading"]').exists()).toBe(true);

    resolveTree(treePayload([rootAn]));
    await flushPromises();
    expect(wrapper.find('[data-testid="tree-loading"]').exists()).toBe(false);
  });

  it('gates "Thêm thành viên" behind auth with Vietnamese hint when anonymous', async () => {
    const wrapper = mountTree();
    await flushPromises();

    expect(wrapper.find('[data-testid="tree-add-member"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="tree-add-auth-hint"]').text()).toContain(
      'Đăng nhập để chỉnh sửa'
    );
  });

  it('renders the Excel panel with export button and anonymous import hint', async () => {
    const wrapper = mountTree();
    await flushPromises();

    expect(wrapper.find('[data-testid="excel-export"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Xuất Excel');
    expect(wrapper.find('[data-testid="excel-import-auth-hint"]').text()).toContain(
      'Đăng nhập để nhập Excel'
    );
  });
});
