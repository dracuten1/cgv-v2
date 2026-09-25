import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import KinshipView from '@/views/KinshipView.vue';
import { useKinshipStore } from '@/stores/kinship';
import { membersApi } from '@/api/members';
import type { Member, Page } from '@/types/api';

vi.mock('@/api/members', () => ({
  membersApi: {
    listMembers: vi.fn(),
  },
}));

const mockedList = vi.mocked(membersApi.listMembers);

const seedMembers: Member[] = [
  {
    id: 'aaaaaaa1-0000-4000-8000-000000000001',
    family_id: 'f1',
    full_name: 'Nguyễn Văn An',
    gender: 'male',
    generation_index: 1,
    is_living: false,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'bbbbbbb2-0000-4000-8000-000000000002',
    family_id: 'f1',
    full_name: 'Nguyễn Văn Bình',
    gender: 'male',
    generation_index: 3,
    is_living: true,
    created_at: '2026-01-01T00:00:00Z',
  },
];

const mountView = async () => {
  const wrapper = mount(KinshipView, {
    global: {
      stubs: {
        // Teleported-less toast host stubs
        ToastHost: true,
      },
    },
  });
  await flushPromises();
  return wrapper;
};

describe('KinshipView (mockup 04 / spec §6.4 — AppCombobox pickers)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockedList.mockResolvedValue({
      items: seedMembers,
      total: seedMembers.length,
      limit: 100,
      offset: 0,
    } as Page<Member>);
  });

  it('renders header, amber quick-demo chip (INV-04) and the two AppCombobox pickers', async () => {
    const wrapper = await mountView();

    expect(wrapper.text()).toContain('Tính quan hệ họ hàng');

    const chip = wrapper.find('[data-testid="quick-demo-chip"]');
    expect(chip.exists()).toBe(true);
    expect(chip.classes()).toContain('bg-amber-50');
    expect(chip.classes()).toContain('border-amber-200');
    expect(chip.text()).toContain('Thử nhanh: Ông → Cháu nội');

    const picker1 = wrapper.find('[data-testid="picker-input-1"]');
    const picker2 = wrapper.find('[data-testid="picker-input-2"]');
    expect(picker1.exists()).toBe(true);
    expect(picker2.exists()).toBe(true);
    // AppCombobox trigger inputs live inside the picker wrappers
    expect(picker1.find('input[role="combobox"]').exists()).toBe(true);
    expect(picker2.find('input[role="combobox"]').exists()).toBe(true);
  });

  it('loads members and feeds them to both comboboxes', async () => {
    const wrapper = await mountView();

    expect(mockedList).toHaveBeenCalledWith({ limit: 100 });
    // Both pickers receive the loaded member list as options
    const comboboxes = wrapper.findAllComponents({ name: 'AppCombobox' });
    expect(comboboxes.length).toBe(2);
    expect((comboboxes[0].props('options') as Member[]).length).toBe(2);
  });

  it('calculate button is disabled until both members are chosen, then drives the store', async () => {
    const wrapper = await mountView();
    const store = useKinshipStore();

    const calc = wrapper.find('[data-testid="calculate-btn"]');
    expect(calc.attributes('disabled')).toBeDefined();

    store.fromMemberId = seedMembers[0].id;
    store.toMemberId = seedMembers[1].id;
    await flushPromises();

    expect(calc.attributes('disabled')).toBeUndefined();

    const calcSpy = vi.spyOn(store, 'calculateKinship').mockImplementation(async () => {
      store.result = {
        term: 'Cháu nội',
        line: 'Chi nội',
        generation_distance: 2,
        distance_label: 'Cách 2 đời',
        is_blood: true,
        dialect: 'bac',
        path: [seedMembers[0].id, seedMembers[1].id],
      };
      return store.result;
    });

    await calc.trigger('click');
    await flushPromises();

    expect(calcSpy).toHaveBeenCalledTimes(1);
    expect(wrapper.find('[data-testid="kinship-result-container"]').exists()).toBe(true);
  });

  it('quick-demo chip fills the two seed IDs and synthesizes them when the API is empty', async () => {
    mockedList.mockResolvedValue({ items: [], total: 0, limit: 100, offset: 0 } as Page<Member>);
    const wrapper = await mountView();
    const store = useKinshipStore();

    await wrapper.find('[data-testid="quick-demo-chip"]').trigger('click');

    expect(store.fromMemberId).toBe('aaaaaaa1-0000-4000-8000-000000000001');
    expect(store.toMemberId).toBe('bbbbbbb2-0000-4000-8000-000000000002');

    // Selected chips resolve names via the synthesized combobox options
    const chips = wrapper.findAll('[data-testid="combobox-selected-chip"]');
    expect(chips.length).toBe(2);
    expect(wrapper.text()).toContain('Nguyễn Văn An');
    expect(wrapper.text()).toContain('Nguyễn Văn Bình');
  });

  it('swap button exchanges the two selected members', async () => {
    const wrapper = await mountView();
    const store = useKinshipStore();
    store.fromMemberId = seedMembers[0].id;
    store.toMemberId = seedMembers[1].id;
    await flushPromises();

    await wrapper.find('[data-testid="swap-pickers-desktop"]').trigger('click');

    expect(store.fromMemberId).toBe(seedMembers[1].id);
    expect(store.toMemberId).toBe(seedMembers[0].id);
  });

  it('shows the initial prompt before both people are selected and hides it once both are chosen', async () => {
    const wrapper = await mountView();
    const store = useKinshipStore();

    const prompt = wrapper.find('[data-testid="kinship-initial-prompt"]');
    expect(prompt.exists()).toBe(true);
    expect(prompt.text()).toContain('Chọn hai người để tính quan hệ');
    // Warm Heritage surface (spec §4): cream-muted panel + terracotta icon disc
    expect(prompt.classes()).toContain('bg-cream-muted/60');
    expect(prompt.classes()).toContain('border-dashed');

    store.fromMemberId = seedMembers[0].id;
    store.toMemberId = seedMembers[1].id;
    await flushPromises();

    expect(wrapper.find('[data-testid="kinship-initial-prompt"]').exists()).toBe(false);
  });

  it('renders the unrelated-result state when the engine returns the fallback term', async () => {
    const wrapper = await mountView();
    const store = useKinshipStore();
    store.fromMemberId = seedMembers[0].id;
    store.toMemberId = seedMembers[1].id;
    await flushPromises();

    vi.spyOn(store, 'calculateKinship').mockImplementation(async () => {
      store.result = {
        term: 'Không xác định được quan hệ',
        line: '',
        generation_distance: 0,
        distance_label: '',
        is_blood: false,
        dialect: 'bac',
        path: [],
      };
      return store.result;
    });

    await wrapper.find('[data-testid="calculate-btn"]').trigger('click');
    await flushPromises();

    const unrelated = wrapper.find('[data-testid="kinship-unrelated"]');
    expect(unrelated.exists()).toBe(true);
    expect(unrelated.text()).toContain('Không tìm thấy quan hệ họ hàng');
    // Warm banner surface, never a cold slate/red error
    expect(unrelated.classes()).toContain('bg-terracotta-soft');
    expect(wrapper.find('[data-testid="kinship-result-container"]').exists()).toBe(false);
  });

  it('reset button clears both selections', async () => {
    const wrapper = await mountView();
    const store = useKinshipStore();
    store.fromMemberId = seedMembers[0].id;
    store.toMemberId = seedMembers[1].id;
    await flushPromises();

    await wrapper.find('[data-testid="reset-btn"]').trigger('click');

    expect(store.fromMemberId).toBeNull();
    expect(store.toMemberId).toBeNull();
  });
});
