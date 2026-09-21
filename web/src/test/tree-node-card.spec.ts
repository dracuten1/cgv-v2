import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import TreeNodeCard from '@/components/tree/TreeNodeCard.vue';
import { CARD_WIDTH, CARD_HEIGHT, type PositionedNode } from '@/composables/useTreeLayout';

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
  const mountCard = (node: PositionedNode, props = {}) =>
    mount(TreeNodeCard, {
      props: { node, ...props },
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    });

  it('renders Vietnamese gender chip "Nam" for male', () => {
    setActivePinia(createPinia());
    const wrapper = mountCard(makeNode({ gender: 'male' }));
    const chip = wrapper.find('[data-testid="gender-chip"]');
    expect(chip.exists()).toBe(true);
    expect(chip.text()).toBe('Nam');
  });

  it('renders Vietnamese gender chip "Nữ" for female (INV-03)', () => {
    setActivePinia(createPinia());
    const wrapper = mountCard(makeNode({ gender: 'female', full_name: 'Nguyễn Thị Dung' }));
    const chip = wrapper.find('[data-testid="gender-chip"]');
    expect(chip.text()).toBe('Nữ');
  });

  it('renders years text "1930 – 2001" for birth+death', () => {
    setActivePinia(createPinia());
    const wrapper = mountCard(makeNode());
    expect(wrapper.find('[data-testid="years-text"]').text()).toBe('1930 – 2001');
  });

  it('renders only birth year when no death date', () => {
    setActivePinia(createPinia());
    const wrapper = mountCard(makeNode({ death_date: null, is_living: true }));
    expect(wrapper.find('[data-testid="years-text"]').text()).toBe('1930');
  });

  it('renders initials circle and full name', () => {
    setActivePinia(createPinia());
    const wrapper = mountCard(makeNode());
    expect(wrapper.text()).toContain('Nguyễn Văn An');
    // initials: prev[0]+last[0] of "Nguyễn Văn An" → "VA"
    expect(wrapper.text()).toContain('VA');
  });

  it('is a focusable button with aria-label "Tên, Đời thứ N"', () => {
    setActivePinia(createPinia());
    const wrapper = mountCard(makeNode({ generation_index: 2 }));
    const btn = wrapper.find('button');
    expect(btn.attributes('type')).toBe('button');
    expect(btn.attributes('aria-label')).toBe('Nguyễn Văn An, Đời thứ 2');
  });

  it('applies generation accent CSS var cycling gen1..gen4', () => {
    setActivePinia(createPinia());
    const gen4 = mountCard(makeNode({ generation_index: 4 }));
    expect(gen4.find('button').attributes('style')).toContain('--gen-4');

    const gen5 = mountCard(makeNode({ generation_index: 5 }));
    // modulo cycle: gen 5 → --gen-1
    expect(gen5.find('button').attributes('style')).toContain('--gen-1');
  });

  it('emits select + navigates on click', async () => {
    setActivePinia(createPinia());
    routerPush.mockClear();
    const wrapper = mountCard(makeNode());
    await wrapper.find('button').trigger('click');
    expect(wrapper.emitted('select')).toBeTruthy();
    expect(wrapper.emitted('select')![0]).toEqual(['member-1']);
    expect(routerPush).toHaveBeenCalledWith('/members/member-1');
  });

  it('renders collapsed dot marker when collapsed=true', () => {
    setActivePinia(createPinia());
    const wrapper = mountCard(makeNode(), { collapsed: true });
    const btn = wrapper.find('button');
    // Dot marker: small square positioned at node center
    expect(btn.attributes('style')).toContain('width: 14px');
    expect(btn.attributes('aria-label')).toBe('Nguyễn Văn An, Đời thứ 1');
    // No full-card content
    expect(wrapper.find('[data-testid="gender-chip"]').exists()).toBe(false);
  });

  it('shows selected ring state', () => {
    setActivePinia(createPinia());
    const wrapper = mountCard(makeNode(), { selected: true });
    expect(wrapper.find('button').classes()).toContain('ring-2');
  });
});
