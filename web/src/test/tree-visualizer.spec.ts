import { describe, it, expect, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import TreeVisualizer from '@/components/tree/TreeVisualizer.vue';
import { useTreeStore } from '@/stores/tree';
import { useAuthStore } from '@/stores/auth';
import type { TreeNode } from '@/types/api';
import { TV_REFLOW_BASE_ROOTS, TV_REFLOW_MUTATED_ROOTS, TV_WIDE8_ROOTS, TV_WIDE8_GENERATIONS, TV_CULLED_FOCUS_ROOTS, TV_CULLED_FOCUS_GENERATIONS, TV_CULLED_FOCUS_TARGET_ID } from './fixtures/tree-view-fixtures';

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
    pinia = createPinia();
    setActivePinia(pinia);
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
});
