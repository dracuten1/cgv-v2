import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import TreeNodeCard from '@/components/tree/TreeNodeCard.vue';
import { CARD_WIDTH, CARD_HEIGHT, type PositionedNode } from '@/composables/useTreeLayout';
import { useAuthStore } from '@/stores/auth';
import { useTreeStore } from '@/stores/tree';

const routerPush = vi.fn();
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPush }),
}));

function makeNode(overrides: Partial<PositionedNode> = {}): PositionedNode {
  return {
    id: 'member-1',
    full_name: 'Nguyễn Văn An',
    gender: 'male',
    generation_index: 1,
    birth_date: '1930-04-12',
    death_date: '2001-08-30',
    is_living: false,
    spouse_ids: [],
    x: 100,
    y: 200,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    ...overrides,
  };
}

describe('TreeNodeCard', () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    routerPush.mockClear();
  });

  const mountCard = (node: PositionedNode, props = {}) =>
    mount(TreeNodeCard, {
      props: { node, ...props },
      global: {
        plugins: [pinia],
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    });

  it('renders Vietnamese gender chip "Nam" for male', () => {
    const wrapper = mountCard(makeNode({ gender: 'male' }));
    const chip = wrapper.find('[data-testid="gender-chip"]');
    expect(chip.exists()).toBe(true);
    expect(chip.text()).toBe('Nam');
  });

  it('renders Vietnamese gender chip "Nữ" for female (INV-03)', () => {
    const wrapper = mountCard(makeNode({ gender: 'female', full_name: 'Nguyễn Thị Dung' }));
    const chip = wrapper.find('[data-testid="gender-chip"]');
    expect(chip.text()).toBe('Nữ');
  });

  it('renders years text "1930 – 2001" for birth+death', () => {
    const wrapper = mountCard(makeNode());
    expect(wrapper.find('[data-testid="years-text"]').text()).toBe('1930 – 2001');
  });

  it('renders "s. 1930" for living member with birth year', () => {
    const wrapper = mountCard(makeNode({ death_date: null, is_living: true }));
    expect(wrapper.find('[data-testid="years-text"]').text()).toBe('s. 1930');
  });

  it('renders "1930 – ?" for deceased member with birth year but unknown death year', () => {
    const wrapper = mountCard(makeNode({ death_date: null, is_living: false }));
    expect(wrapper.find('[data-testid="years-text"]').text()).toBe('1930 – ?');
  });

  it('renders initials circle and full name', () => {
    const wrapper = mountCard(makeNode());
    expect(wrapper.text()).toContain('Nguyễn Văn An');
    // initials: prev[0]+last[0] of "Nguyễn Văn An" → "VA"
    expect(wrapper.text()).toContain('VA');
  });

  it('is a focusable button with aria-label "Tên, Đời thứ N"', () => {
    const wrapper = mountCard(makeNode({ generation_index: 2 }));
    const btn = wrapper.find('button');
    expect(btn.attributes('type')).toBe('button');
    expect(btn.attributes('aria-label')).toBe('Nguyễn Văn An, Đời thứ 2');
  });

  it('applies generation accent CSS var cycling gen1..gen4', () => {
    const gen4 = mountCard(makeNode({ generation_index: 4 }));
    expect(gen4.find('button').attributes('style')).toContain('--gen-4');

    const gen5 = mountCard(makeNode({ generation_index: 5 }));
    // modulo cycle: gen 5 → --gen-1
    expect(gen5.find('button').attributes('style')).toContain('--gen-1');
  });

  it('emits select + navigates on click', async () => {
    const wrapper = mountCard(makeNode());
    await wrapper.find('button').trigger('click');
    expect(wrapper.emitted('select')).toBeTruthy();
    expect(wrapper.emitted('select')![0]).toEqual(['member-1']);
    expect(routerPush).toHaveBeenCalledWith('/members/member-1');
  });

  it('renders collapsed dot marker when collapsed=true', () => {
    const wrapper = mountCard(makeNode(), { collapsed: true });
    const btn = wrapper.find('button');
    // Dot marker: small square positioned at node center
    expect(btn.attributes('style')).toContain('width: 14px');
    expect(btn.attributes('aria-label')).toBe('Nguyễn Văn An, Đời thứ 1');
    // No full-card content
    expect(wrapper.find('[data-testid="gender-chip"]').exists()).toBe(false);
  });

  it('shows selected ring state', () => {
    const wrapper = mountCard(makeNode(), { selected: true });
    expect(wrapper.find('button').classes()).toContain('ring-2');
  });

  it('falls back to initials when avatar image fails to load (@error)', async () => {
    const wrapper = mountCard(makeNode({ avatar_url: 'https://example.com/broken.jpg' }));
    expect(wrapper.find('img').exists()).toBe(true);

    // Trigger @error on img
    await wrapper.find('img').trigger('error');

    // Img is removed, fallback initials "VA" displayed
    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.text()).toContain('VA');
  });

  it('resets avatar error latch when avatar_url changes (M12)', async () => {
    const node = makeNode({ avatar_url: 'https://example.com/broken.jpg' });
    const wrapper = mountCard(node);
    expect(wrapper.find('img').exists()).toBe(true);

    await wrapper.find('img').trigger('error');
    expect(wrapper.find('img').exists()).toBe(false);

    // Prop update with new avatar_url
    await wrapper.setProps({
      node: makeNode({ avatar_url: 'https://example.com/fixed.jpg' }),
    });

    // Latch reset: img should be rendered again
    expect(wrapper.find('img').exists()).toBe(true);
    expect(wrapper.find('img').attributes('src')).toBe('https://example.com/fixed.jpg');
  });

  it('renders "Tôi" badge and blue self ring when user matches member_id', () => {
    const authStore = useAuthStore();
    authStore.user = {
      id: 'user-1',
      display_name: 'Người dùng',
      is_demo: false,
      member_id: 'member-1',
      created_at: '',
    };
    authStore.status = 'authenticated';

    const wrapper = mountCard(makeNode({ id: 'member-1' }));
    const selfBadge = wrapper.find('[data-testid="self-badge"]');
    expect(selfBadge.exists()).toBe(true);
    expect(selfBadge.text()).toBe('Tôi');
    expect(wrapper.find('button').classes()).toContain('ring-tree-self-ring');
  });

  it('renders relative kinship badge from treeStore.kinshipLabels with full title tooltip', () => {
    const authStore = useAuthStore();
    authStore.user = {
      id: 'user-1',
      display_name: 'Người dùng',
      is_demo: false,
      member_id: 'member-self',
      created_at: '',
    };
    authStore.status = 'authenticated';

    const treeStore = useTreeStore();
    treeStore.kinshipLabels = {
      'member-1': 'Ông nội',
    };

    const wrapper = mountCard(makeNode({ id: 'member-1' }));
    const kinshipBadge = wrapper.find('[data-testid="kinship-badge"]');
    expect(kinshipBadge.exists()).toBe(true);
    expect(kinshipBadge.text()).toBe('Nội');
    expect(kinshipBadge.attributes('title')).toBe('Ông nội');
  });

  it('renders "Đây là tôi" button for authenticated unlinked non-demo user and intercepts card click (M12)', async () => {
    const authStore = useAuthStore();
    authStore.user = {
      id: 'user-1',
      display_name: 'Người dùng',
      is_demo: false,
      member_id: null,
      created_at: '',
    };
    authStore.status = 'authenticated';
    const linkSelfSpy = vi.spyOn(authStore, 'linkSelfToMember').mockResolvedValue();

    const wrapper = mountCard(makeNode({ id: 'member-1' }));
    const linkBtn = wrapper.find('[data-testid="link-self"]');
    expect(linkBtn.exists()).toBe(true);
    expect(linkBtn.text()).toBe('Đây là tôi');

    // Click link self button
    await linkBtn.trigger('click');

    expect(linkSelfSpy).toHaveBeenCalledWith('member-1');
    // Crucial: router.push and card selection must NOT be triggered
    expect(routerPush).not.toHaveBeenCalled();
    expect(wrapper.emitted('select')).toBeFalsy();
  });

  it('never displays "Đây là tôi" button for demo users', () => {
    const authStore = useAuthStore();
    authStore.user = {
      id: 'demo-user',
      display_name: 'Tài khoản demo',
      is_demo: true,
      member_id: null,
      created_at: '',
    };
    authStore.status = 'authenticated';

    const wrapper = mountCard(makeNode({ id: 'member-1' }));
    expect(wrapper.find('[data-testid="link-self"]').exists()).toBe(false);
  });
});
