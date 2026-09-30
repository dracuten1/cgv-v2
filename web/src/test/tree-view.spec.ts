import { describe, it, expect, vi, beforeEach } from 'vitest';

// Route/router mock MUST be reactive: TreeView watches () => route.query.family,
// and a plain object (pre-b71b66d-review harness) never triggers that watcher,
// so every route-mutation path was untested. Built inside async vi.hoisted so
// `reactive` (from vue) is available before the vue-router mock factory runs.
const { buildRouteState } = await vi.hoisted(async () => {
  const { reactive } = await import('vue');
  const buildRouteState = () => {
    const routeState = reactive({ query: {} as Record<string, any>, hash: '' });
    const routerMock = {
      replace: vi.fn(async (to: any) => {
        routeState.query = to.query;
        routeState.hash = to.hash || '';
      }),
    };
    return { routeState, routerMock };
  };
  return { buildRouteState };
});

// Fresh state per test: leaked (never-unmounted) instances from earlier tests
// keep watching the OLD reactive object, which is never mutated again — so a
// query mutation can only ever reach the CURRENT test's view.
let routeState: ReturnType<typeof buildRouteState>['routeState'];
let routerMock: ReturnType<typeof buildRouteState>['routerMock'];

vi.mock('vue-router', () => ({
  useRoute: () => routeState,
  useRouter: () => routerMock,
}));
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

vi.mock('@/api/kinship', () => ({
  kinshipApi: {
    getFamilyKinshipLabels: vi.fn().mockResolvedValue({
      family_id: 'f1',
      from: 'm-self',
      dialect: 'bac',
      labels: { 'aaaaaaa1-0000-4000-8000-000000000001': 'Thủy tổ' },
    }),
  },
}));

import { familiesApi } from '@/api/families';
import { kinshipApi } from '@/api/kinship';
import { ApiError } from '@/api/client';
import { useTreeStore } from '@/stores/tree';
import { useAuthStore } from '@/stores/auth';
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
  ({ routeState, routerMock } = buildRouteState());
  localStorage.clear();
  setActivePinia(createPinia());
  mockedListFamilies.mockResolvedValue({
    families: [
      { id: 'f1', name: 'Họ Nguyễn', version: 1, created_at: '2026-01-01T00:00:00Z' },
      { id: 'f2', name: 'Họ Trần', version: 1, created_at: '2026-01-02T00:00:00Z' },
      { id: 'f3', name: 'Họ Lê', version: 1, created_at: '2026-01-03T00:00:00Z' },
    ],
  });
  mockedGetTree.mockResolvedValue(treePayload([rootAn]));
});

describe('TreeView', () => {
  it('persists orientation through the real toggle event and keeps choices isolated per family', async () => {
    localStorage.clear();
    const wrapper = mountTree();
    await flushPromises();

    const horizontal = () => wrapper.find('[data-testid="orientation-horizontal"]');
    const vertical = () => wrapper.find('[data-testid="orientation-vertical"]');
    expect(vertical().attributes('aria-pressed')).toBe('true');

    await horizontal().trigger('click');
    expect(horizontal().attributes('aria-pressed')).toBe('true');
    expect(localStorage.getItem('cgp_tree_orientation_f1')).toBe('horizontal');

    routeState.hash = '#preserve';
    await wrapper.find('.tree-family-select select').setValue('f2');
    await flushPromises();
    expect(vertical().attributes('aria-pressed')).toBe('true');
    expect(routeState.query.family).toBe('f2');
    expect(routeState.hash).toBe('#preserve');
    expect(localStorage.getItem('cgp_tree_orientation_f2')).toBeNull();

    await horizontal().trigger('click');
    await wrapper.find('.tree-family-select select').setValue('f3');
    await flushPromises();
    expect(vertical().attributes('aria-pressed')).toBe('true');
    await wrapper.find('.tree-family-select select').setValue('f1');
    await flushPromises();
    expect(horizontal().attributes('aria-pressed')).toBe('true');
    expect(localStorage.getItem('cgp_tree_orientation_f1')).toBe('horizontal');

    // Remounting the real view simulates a page reload and rehydrates the selected family's choice.
    wrapper.unmount();
    routeState.query = { family: 'f1' };
    const reloaded = mountTree();
    await flushPromises();
    expect(reloaded.find('[data-testid="orientation-horizontal"]').attributes('aria-pressed')).toBe('true');
  });

  it('restores a selected family from query on reload and canonicalizes invalid IDs', async () => {
    localStorage.setItem('cgp_tree_orientation_f2', 'horizontal');
    routeState.query = { family: 'missing', page: '2' };
    const wrapper = mountTree();
    await flushPromises();
    expect(mockedGetTree).toHaveBeenCalledWith('f1');
    expect(routeState.query).toEqual({ family: 'f1', page: '2' });
    wrapper.unmount();
    routeState.query = { family: 'f2' };
    const selected = mountTree();
    await flushPromises();
    expect(mockedGetTree).toHaveBeenLastCalledWith('f2');
    expect(selected.find('[data-testid="orientation-horizontal"]').attributes('aria-pressed')).toBe('true');
  });

  it('reacts to back/forward navigation: the route watcher selects the family and rehydrates its persisted orientation', async () => {
    localStorage.clear();
    localStorage.setItem('cgp_tree_orientation_f2', 'horizontal');
    const wrapper = mountTree();
    await flushPromises();
    expect(mockedGetTree).toHaveBeenCalledTimes(1);
    expect(mockedGetTree).toHaveBeenCalledWith('f1');
    expect(wrapper.find('[data-testid="orientation-vertical"]').attributes('aria-pressed')).toBe('true');

    // Simulated "back": router swaps route.query in place; the view must react.
    routeState.query = { family: 'f2' };
    await flushPromises();
    expect(mockedGetTree).toHaveBeenCalledTimes(2); // exactly one fetch per navigation — no duplicates
    expect(mockedGetTree).toHaveBeenLastCalledWith('f2');
    expect(wrapper.find('[data-testid="orientation-horizontal"]').attributes('aria-pressed')).toBe('true');

    // Simulated "forward": back to f1, which kept its own horizontal choice.
    routeState.query = { family: 'f1' };
    await flushPromises();
    expect(mockedGetTree).toHaveBeenCalledTimes(3);
    expect(mockedGetTree).toHaveBeenLastCalledWith('f1');
    expect(wrapper.find('[data-testid="orientation-vertical"]').attributes('aria-pressed')).toBe('true');
  });

  it('canonicalizes an invalid post-mount family mutation preserving unrelated query and hash, without looping or refetching', async () => {
    mountTree();
    await flushPromises();
    expect(mockedGetTree).toHaveBeenCalledTimes(1); // initial mount fetch only
    const replacesAfterMount = routerMock.replace.mock.calls.length;

    routeState.query = { family: 'ghost', page: '2', keep: 'x' };
    routeState.hash = '#tab-2';
    await flushPromises();
    await flushPromises(); // second flush proves the watcher converged — no canonicalization loop

    expect(routeState.query).toEqual({ family: 'f1', page: '2', keep: 'x' });
    expect(routeState.hash).toBe('#tab-2');
    expect(routerMock.replace).toHaveBeenCalledTimes(replacesAfterMount + 1);
    const lastReplace = routerMock.replace.mock.calls.at(-1)![0] as { query: Record<string, any>; hash: string };
    expect(lastReplace.query).toEqual({ family: 'f1', page: '2', keep: 'x' });
    expect(lastReplace.hash).toBe('#tab-2');
    // Selected family already resolved (f1): canonicalization must NOT refetch.
    expect(mockedGetTree).toHaveBeenCalledTimes(1);
  });

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

  it('shows unlinked user banner when logged-in without member_id and not demo', async () => {
    const authStore = useAuthStore();
    authStore.user = {
      id: 'u1',
      display_name: 'Người dùng',
      is_demo: false,
      member_id: null,
      created_at: '',
    };
    authStore.status = 'authenticated';

    const wrapper = mountTree();
    await flushPromises();

    const banner = wrapper.find('[data-testid="unlinked-banner"]');
    expect(banner.exists()).toBe(true);
    expect(banner.text()).toContain('Liên kết tài khoản của bạn với một thành viên trong cây để xem xưng hô gia đình.');
  });

  it('hides unlinked user banner for demo users', async () => {
    const authStore = useAuthStore();
    authStore.user = {
      id: 'demo-u',
      display_name: 'Demo User',
      is_demo: true,
      member_id: null,
      created_at: '',
    };
    authStore.status = 'authenticated';

    const wrapper = mountTree();
    await flushPromises();

    expect(wrapper.find('[data-testid="unlinked-banner"]').exists()).toBe(false);
  });

  it('integrates with kinship labels store when authenticated user has linked member_id', async () => {
    const authStore = useAuthStore();
    authStore.user = {
      id: 'u-linked',
      display_name: 'Người dùng Đã Liên kết',
      is_demo: false,
      member_id: 'm-self',
      created_at: '',
    };
    authStore.status = 'authenticated';

    const treeStore = useTreeStore();
    expect(treeStore.kinshipLabels).toEqual({});

    mountTree();
    await flushPromises();

    // fetchTree auto-triggers fetchKinshipLabels when authStore.user?.member_id is present
    expect(kinshipApi.getFamilyKinshipLabels).toHaveBeenCalledWith('f1', 'm-self', undefined);
    expect(treeStore.kinshipLabels['aaaaaaa1-0000-4000-8000-000000000001']).toBe('Thủy tổ');
  });

  it('REGRESSION-PHASE3-REFETCH: preserves TreeVisualizer transform state during same-family invalidate() refetch', async () => {
    // Regression: at 86e7411, a same-family invalidate() caused TreeView to unmount
    // TreeVisualizer (loading=true + v-if unmount), which lost hasInitialCentered and
    // other state; on remount, autoCenterInitial() re-framed the anchor, resetting zoom
    // to the initial anchor-fit value instead of preserving the user's manual pan/zoom.
    //
    // Fix: TreeVisualizer stays mounted during background refresh (roots > 0),
    // and TreeVisualizer's frameCurrentAnchor() guard prevents re-framing when
    // family/filter/anchor/orientation unchanged.

    const treeStore = useTreeStore();
    let resolveInitial!: (v: any) => void;
    let resolveRefetch!: (v: any) => void;

    // Mock two sequential fetches: initial and refetch
    familiesApi.getTree
      .mockImplementationOnce(
        () => new Promise((res) => (resolveInitial = res))
      )
      .mockImplementationOnce(
        () => new Promise((res) => (resolveRefetch = res))
      );

    const wrapper = mountTree();
    expect(treeStore.loading).toBe(true);
    expect(wrapper.find('[data-testid="tree-loading"]').exists()).toBe(true);

    // Complete initial load
    resolveInitial({
      version: 1,
      roots: [{ id: 'r1', full_name: 'Root', gender: 'male', generation_index: 1, children: [], spouse_ids: [], is_living: true }],
      generations: [{ index: 1, label: 'Đời 1', count: 1 }],
    });
    await flushPromises();
    expect(treeStore.loading).toBe(false);
    expect(treeStore.roots.length).toBe(1);

    const visualizer = wrapper.findComponent({ name: 'TreeVisualizer' });
    expect(visualizer.exists()).toBe(true);
    const worldBeforePan = visualizer.find('[data-testid="tree-world"]').attributes('style');

    // Simulate user manual pan/zoom (set transform via component)
    // In real scenario, user would click buttons; here we access the component's vm
    const vizVm = visualizer.vm as any;
    vizVm.setTransform(1.5, 100, 200);
    const worldAfterPan = visualizer.find('[data-testid="tree-world"]').attributes('style');
    expect(worldAfterPan).not.toBe(worldBeforePan);
    expect(worldAfterPan).toContain('scale(1.5)');

    // Trigger invalidate (same family, same roots, simulating a member save)
    familiesApi.getTree.mockClear();
    familiesApi.getTree.mockImplementationOnce(() => new Promise((res) => (resolveRefetch = res)));
    const invalidatePromise = treeStore.invalidate();

    // During refetch, loading is true but roots still exist
    expect(treeStore.loading).toBe(true);
    // TreeVisualizer should still be mounted (not unmounted by loading skeleton)
    expect(wrapper.findComponent({ name: 'TreeVisualizer' }).exists()).toBe(true);

    // Complete the refetch with same data
    resolveRefetch({
      version: 2, // slightly different version
      roots: [{ id: 'r1', full_name: 'Root', gender: 'male', generation_index: 1, children: [], spouse_ids: [], is_living: true }],
      generations: [{ index: 1, label: 'Đời 1', count: 1 }],
    });
    await invalidatePromise;
    await flushPromises();

    expect(treeStore.loading).toBe(false);
    // Transform should be preserved (frameCurrentAnchor guard prevented re-frame)
    const worldAfterRefetch = wrapper.findComponent({ name: 'TreeVisualizer' }).find('[data-testid="tree-world"]').attributes('style');
    expect(worldAfterRefetch).toBe(worldAfterPan);
    expect(worldAfterRefetch).toContain('scale(1.5)'); // zoom unchanged
    expect(worldAfterRefetch).toContain('translate3d(100px, 200px'); // pan unchanged
  });
});
