import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import AppCombobox, { type ComboboxMember } from '@/components/ui/AppCombobox.vue';

const sampleMembers: ComboboxMember[] = [
  { id: 'm1', full_name: 'Nguyễn Văn An', generation_index: 1, gender: 'male' },
  { id: 'm2', full_name: 'Trần Thị Bình', generation_index: 2, gender: 'female' },
  { id: 'm3', full_name: 'Nguyễn Văn Cường', generation_index: 2, gender: 'male' },
];

describe('AppCombobox.vue', () => {
  it('renders input trigger when no selection is present', () => {
    const wrapper = mount(AppCombobox, {
      props: {
        options: sampleMembers,
        placeholder: 'Chọn người...',
      },
    });

    const input = wrapper.find('input[role="combobox"]');
    expect(input.exists()).toBe(true);
    expect(input.attributes('placeholder')).toBe('Chọn người...');
    expect(wrapper.find('[data-testid="combobox-selected-chip"]').exists()).toBe(false);
  });

  it('renders selected state chip when modelValue matches an option', () => {
    const wrapper = mount(AppCombobox, {
      props: {
        modelValue: 'm1',
        options: sampleMembers,
      },
    });

    const chip = wrapper.find('[data-testid="combobox-selected-chip"]');
    expect(chip.exists()).toBe(true);
    expect(chip.text()).toContain('Nguyễn Văn An');
    expect(chip.text()).toContain('Đời 1');
    expect(chip.text()).toContain('Nam');
    expect(wrapper.find('input[role="combobox"]').exists()).toBe(false);
  });

  it('filters options based on search query', async () => {
    const wrapper = mount(AppCombobox, {
      props: {
        options: sampleMembers,
      },
    });

    const input = wrapper.find('input[role="combobox"]');
    await input.trigger('focus');

    // All 3 items visible initially
    expect(wrapper.findAll('li[role="option"]').length).toBe(3);

    // Type "Cường"
    await input.setValue('Cường');
    const filtered = wrapper.findAll('li[role="option"]');
    expect(filtered.length).toBe(1);
    expect(filtered[0].text()).toContain('Nguyễn Văn Cường');
  });

  it('emits update:modelValue and select when an option is clicked', async () => {
    const wrapper = mount(AppCombobox, {
      props: {
        options: sampleMembers,
      },
    });

    const input = wrapper.find('input[role="combobox"]');
    await input.trigger('focus');

    const options = wrapper.findAll('li[role="option"]');
    await options[1].trigger('click');

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['m2']);
    expect(wrapper.emitted('select')?.[0]).toEqual([sampleMembers[1]]);
  });

  it('shows a warm search-empty state when filtering yields no matches', async () => {
    const wrapper = mount(AppCombobox, {
      props: {
        options: sampleMembers,
        emptyText: 'Không tìm thấy thành viên phù hợp',
      },
    });

    const input = wrapper.find('input[role="combobox"]');
    await input.trigger('focus');
    await input.setValue('Zzz Không Tồn Tại');

    expect(wrapper.findAll('li[role="option"]').length).toBe(0);
    const empty = wrapper.find('[data-testid="combobox-empty"]');
    expect(empty.exists()).toBe(true);
    expect(empty.text()).toContain('Không tìm thấy thành viên phù hợp');
    // Warm Heritage touch: cream-muted icon disc above the message
    expect(empty.find('.bg-cream-muted').exists()).toBe(true);
  });

  it('dropdown option buttons carry focus-visible rings (INV-06)', async () => {
    const wrapper = mount(AppCombobox, {
      props: { options: sampleMembers },
    });

    await wrapper.find('input[role="combobox"]').trigger('focus');

    const optionButtons = wrapper.findAll('li[role="option"] button');
    expect(optionButtons.length).toBe(3);
    for (const btn of optionButtons) {
      expect(btn.classes()).toContain('focus-visible:ring-2');
      expect(btn.classes()).toContain('focus-visible:ring-terracotta');
      expect(btn.classes()).toContain('focus-visible:ring-offset-1');
    }
  });

  it('clears selection when clear button is clicked', async () => {
    const wrapper = mount(AppCombobox, {
      props: {
        modelValue: 'm2',
        options: sampleMembers,
      },
    });

    const clearBtn = wrapper.find('[data-testid="combobox-clear-btn"]');
    expect(clearBtn.exists()).toBe(true);

    await clearBtn.trigger('click');

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([null]);
    expect(wrapper.emitted('select')?.[0]).toEqual([null]);
  });

  it('supports keyboard navigation (ArrowDown, ArrowUp, Enter, Escape)', async () => {
    const wrapper = mount(AppCombobox, {
      props: {
        options: sampleMembers,
      },
    });

    const input = wrapper.find('input[role="combobox"]');
    await input.trigger('focus');

    // ArrowDown moves activeIndex to 0
    await input.trigger('keydown', { key: 'ArrowDown' });
    let options = wrapper.findAll('li[role="option"]');
    expect(options[0].attributes('aria-selected')).toBe('true');

    // ArrowDown again moves to 1
    await input.trigger('keydown', { key: 'ArrowDown' });
    options = wrapper.findAll('li[role="option"]');
    expect(options[1].attributes('aria-selected')).toBe('true');

    // Enter selects active option
    await input.trigger('keydown', { key: 'Enter' });
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['m2']);

    // Escape closes dropdown
    await input.trigger('focus');
    expect(wrapper.find('ul[role="listbox"]').exists()).toBe(true);
    await input.trigger('keydown', { key: 'Escape' });
    expect(wrapper.find('ul[role="listbox"]').exists()).toBe(false);
  });
});
