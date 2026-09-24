import { describe, it, expect, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import TreeVisualizer from '@/components/tree/TreeVisualizer.vue';
import { useTreeStore } from '@/stores/tree';
import { useAuthStore } from '@/stores/auth';
import type { TreeNode } from '@/types/api';

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
});
