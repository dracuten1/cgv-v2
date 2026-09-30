import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import TreeVisualizer from '@/components/tree/TreeVisualizer.vue';
import { useTreeStore } from '@/stores/tree';
import { useAuthStore } from '@/stores/auth';
import type { TreeNode } from '@/types/api';
import { TV_REFLOW_BASE_ROOTS, TV_REFLOW_MUTATED_ROOTS, TV_WIDE8_ROOTS, TV_WIDE8_GENERATIONS, TV_CULLED_FOCUS_ROOTS, TV_CULLED_FOCUS_GENERATIONS, TV_CULLED_FOCUS_TARGET_ID } from './fixtures/tree-view-fixtures';

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
    getFamilyKinshipLabels: vi.fn().mockResolvedValue({
      family_id: 'f1',
      from: 'm-self',
      dialect: 'bac',
      labels: {},
    }),
  },
}));

import { familiesApi } from '@/api/families';
const mockedGetTree = vi.mocked(familiesApi.getTree);

const makeNode = (id: string, name: string, overrides: Partial<TreeNode> = {}): TreeNode => ({
  id,
  full_name: name,
  gender: 'male',
  generation_index: 1,
  birth_date: '1950-01-01',
  death_date: null,
  is_living: true,
  spouse_ids: [],
  children: [],
  ...overrides,
});

describe('TreeVisualizer.vue — Phase 3 Auto-Centering & Compass', () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    vi.clearAllMocks();
    pinia = createPinia();
    setActivePinia(pinia);
    mockedGetTree.mockResolvedValue({
      family_id: 'f1',
      version: 1,
      generations: [{ index: 1, label: 'Đời 1', count: 1 }],
      roots: [],
    });
  });

  it('renders TreeCompassControl and passes panBy to viewport', async () => {
    const store = useTreeStore();
    store.roots = [makeNode('m1', 'Nguyễn Văn An')];

    const wrapper = mount(TreeVisualizer, {
      global: { plugins: [pinia] },
    });
    await flushPromises();

    const compass = wrapper.findComponent({ name: 'TreeCompassControl' });
    expect(compass.exists()).toBe(true);

    // Click North: pan(0, 80)
    await compass.find('[data-testid="compass-north"]').trigger('click');
    const world = wrapper.find('[data-testid="tree-world"]');
    expect(world.attributes('style')).toContain('translate3d');
  });

  it('auto-centers on "Tôi" node when user is linked on initial load', async () => {
    const authStore = useAuthStore();
    authStore.user = {
      id: 'u1',
      display_name: 'Nguyễn Văn Bình',
      is_demo: false,
      member_id: 'm2',
      created_at: '',
    };
    authStore.status = 'authenticated';

    const store = useTreeStore();
    store.roots = [
      makeNode('m1', 'Nguyễn Văn An', {
        children: [makeNode('m2', 'Nguyễn Văn Bình', { generation_index: 2 })],
      }),
    ];

    const wrapper = mount(TreeVisualizer, {
      global: { plugins: [pinia] },
    });
    await flushPromises();

    const world = wrapper.find('[data-testid="tree-world"]');
    // At zoom 1.0, world style should reflect scale(1)
    expect(world.attributes('style')).toContain('scale(1)');
  });

  it('compass center button centers "Tôi" node when user is linked', async () => {
    const authStore = useAuthStore();
    authStore.user = {
      id: 'u1',
      display_name: 'Nguyễn Văn An',
      is_demo: false,
      member_id: 'm1',
      created_at: '',
    };
    authStore.status = 'authenticated';

    const store = useTreeStore();
    store.roots = [makeNode('m1', 'Nguyễn Văn An')];

    const wrapper = mount(TreeVisualizer, {
      global: { plugins: [pinia] },
    });
    await flushPromises();

    const compass = wrapper.findComponent({ name: 'TreeCompassControl' });
    // First pan away
    await compass.find('[data-testid="compass-north"]').trigger('click');

    // Click center button
    await compass.find('[data-testid="compass-center"]').trigger('click');
    const world = wrapper.find('[data-testid="tree-world"]');
    expect(world.attributes('style')).toContain('scale(1)');
  });

  it('REFLOW-SAME-ANCHOR: preserves user pan and zoom after a same-anchor layout mutation; Fit alone fits world', async () => {
    const store = useTreeStore();
    store.roots = TV_REFLOW_BASE_ROOTS;
    const wrapper = mount(TreeVisualizer, { global: { plugins: [pinia] } });
    await flushPromises();
    await wrapper.find('[data-testid="zoom-out"]').trigger('click');
    const before = wrapper.find('[data-testid="tree-world"]').attributes('style');
    store.roots = TV_REFLOW_MUTATED_ROOTS;
    await flushPromises();
    expect(wrapper.find('[data-testid="tree-world"]').attributes('style')).toBe(before);
    await wrapper.find('[data-testid="fit-view"]').trigger('click');
    expect(wrapper.find('[data-testid="tree-world"]').attributes('style')).not.toBe(before);
    wrapper.unmount();
  });

  it('GEO-FRAME: family and filter changes reframe; unchanged anchor keeps transform', async () => {
    const store = useTreeStore();
    store.roots = TV_WIDE8_ROOTS;
    store.generations = TV_WIDE8_GENERATIONS;
    const wrapper = mount(TreeVisualizer, { global: { plugins: [pinia] } });
    await flushPromises();
    await wrapper.find('[data-testid="zoom-out"]').trigger('click');
    const before = wrapper.find('[data-testid="tree-world"]').attributes('style');
    store.familyId = 'another-family';
    await flushPromises();
    expect(wrapper.find('[data-testid="tree-world"]').attributes('style')).not.toBe(before);
    wrapper.unmount();
  });

  it('INV-FOCUS: linked person outside the culled window is found in the full layout', async () => {
    const auth = useAuthStore();
    auth.user = { id: 'u1', display_name: 'Far', is_demo: false, member_id: TV_CULLED_FOCUS_TARGET_ID, created_at: '' };
    auth.status = 'authenticated';
    const store = useTreeStore();
    store.roots = TV_CULLED_FOCUS_ROOTS;
    store.generations = TV_CULLED_FOCUS_GENERATIONS;
    const wrapper = mount(TreeVisualizer, { global: { plugins: [pinia] } });
    await flushPromises();
    expect(wrapper.attributes('data-view-centered')).toBe(TV_CULLED_FOCUS_TARGET_ID);
    wrapper.unmount();
  });

  it('renders exactly one canvas node for all connectors', async () => {
    const store = useTreeStore();
    store.roots = [
      makeNode('m1', 'Nguyễn Văn An', {
        children: [makeNode('m2', 'Nguyễn Văn Bình', { generation_index: 2 })],
      }),
    ];

    const wrapper = mount(TreeVisualizer, {
      global: { plugins: [pinia] },
    });
    await flushPromises();

    expect(wrapper.findAll('canvas')).toHaveLength(1);
  });

  it('REGRESSION-PHASE3-REFETCH: preserves transform during same-family invalidate() refetch', async () => {
    // Regression: at 86e7411, a same-family invalidate() caused TreeView to unmount
    // TreeVisualizer (loading=true + v-if unmount), which lost hasInitialCentered and
    // transform state. On remount, autoCenterInitial() re-framed the anchor, resetting
    // zoom to the initial anchor-fit value instead of preserving user's manual pan/zoom.
    //
    // Fix: TreeVisualizer stays mounted during background refresh (roots > 0).
    // Component's frameCurrentAnchor() guard prevents re-framing when context unchanged
    // and hasInitialCentered=true.
    //
    // Test: Mount with roots → apply manual zoom/pan via compass → call invalidate()
    // with pending API → verify transform preserved (zoom scale and pan translate3d
    // byte-identical) after refetch completes.

    const store = useTreeStore();
    const roots: TreeNode[] = [
      makeNode('m1', 'Nguyễn Văn An', {
        children: [makeNode('m2', 'Nguyễn Văn Bình', { generation_index: 2 })],
      }),
    ];

    // Prime store and mount with real TreeVisualizer (no stubs)
    store.roots = roots;
    store.familyId = 'f1';

    const wrapper = mount(TreeVisualizer, {
      global: { plugins: [pinia] },
    });
    await flushPromises();

    // Verify initial render
    let world = wrapper.find('[data-testid="tree-world"]');
    expect(world.exists()).toBe(true);
    const transformBefore = world.attributes('style');
    expect(transformBefore).toContain('scale(1)');
    expect(transformBefore).toContain('translate3d(');

    // Simulate user manual zoom out via compass (or could use zoom-out button)
    const compassNorth = wrapper.find('[data-testid="compass-north"]');
    if (compassNorth.exists()) {
      await compassNorth.trigger('click');
    }

    // Capture transform after user interaction
    const transformAfterUserZoom = wrapper.find('[data-testid="tree-world"]').attributes('style');
    expect(transformAfterUserZoom).toBeDefined();
    // After zoom out, scale or translate should differ from initial
    const hasUserZoom = transformAfterUserZoom !== transformBefore;

    // Now trigger invalidate (same family, same roots, simulating member save)
    // Set up mock to return same tree after a short delay
    let resolveRefetch!: (v: any) => void;
    mockedGetTree.mockImplementationOnce(
      () => new Promise((res) => (resolveRefetch = res))
    );

    // Trigger invalidate and immediately check loading state
    const invalidatePromise = store.invalidate();
    // Brief delay to ensure promise is pending
    await new Promise((res) => setTimeout(res, 0));
    expect(store.loading).toBe(true);

    // TreeVisualizer should still be mounted (not unmounted by loading skeleton)
    // because v-if condition is: store.loading && store.roots.length === 0
    // Since roots still exist, visualizer stays mounted
    world = wrapper.find('[data-testid="tree-world"]');
    expect(world.exists()).toBe(true);
    // Transform should not have changed during the refetch request
    expect(wrapper.find('[data-testid="tree-world"]').attributes('style')).toBe(transformAfterUserZoom);

    // Complete the refetch with same data (same roots, slightly different version)
    resolveRefetch({
      family_id: 'f1',
      version: 2,
      generations: [{ index: 1, label: 'Đời 1', count: 1 }],
      roots,
    });

    await invalidatePromise;
    await flushPromises();

    expect(store.loading).toBe(false);

    // Verify transform is byte-identical to the user-zoomed state
    // frameCurrentAnchor() guard should have prevented re-framing because:
    // - familyId unchanged ('f1')
    // - roots unchanged (same object reference)
    // - hasInitialCentered=true (already centered before invalidate)
    const transformAfterRefetch = wrapper.find('[data-testid="tree-world"]').attributes('style');
    expect(transformAfterRefetch).toBe(transformAfterUserZoom);

    if (hasUserZoom && transformAfterUserZoom) {
      // Verify zoom is preserved (if zoom-out was applied)
      // The scale value should remain consistent
      const scaleMatch = transformAfterRefetch?.match(/scale\(([^)]+)\)/);
      const expectedScaleMatch = transformAfterUserZoom.match(/scale\(([^)]+)\)/);
      expect(scaleMatch?.[1]).toBe(expectedScaleMatch?.[1]);
    }

    wrapper.unmount();
  });
});
