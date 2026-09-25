import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import AppTextarea from '@/components/ui/AppTextarea.vue';

describe('AppTextarea.vue', () => {
  it('renders borderless variant by default', () => {
    const wrapper = mount(AppTextarea, {
      props: {
        modelValue: 'Xin chào',
        placeholder: 'Chia sẻ câu chuyện...',
      },
    });

    const textarea = wrapper.find('textarea');
    expect(textarea.exists()).toBe(true);
    expect(textarea.classes()).toContain('border-0');
    expect(textarea.classes()).toContain('bg-transparent');
    expect(textarea.classes()).toContain('resize-none');
    expect(textarea.element.value).toBe('Xin chào');
  });

  it('renders bordered variant when requested', () => {
    const wrapper = mount(AppTextarea, {
      props: {
        variant: 'bordered',
        label: 'Ghi chú',
      },
    });

    const textarea = wrapper.find('textarea');
    expect(textarea.classes()).toContain('border');
    expect(textarea.classes()).toContain('border-slate-300');
    expect(wrapper.find('label').text()).toContain('Ghi chú');
  });

  it('emits update:modelValue on input', async () => {
    const wrapper = mount(AppTextarea, {
      props: {
        modelValue: '',
      },
    });

    const textarea = wrapper.find('textarea');
    await textarea.setValue('Ghi chú mới');

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['Ghi chú mới']);
  });

  it('renders error message when error prop is passed', () => {
    const wrapper = mount(AppTextarea, {
      props: {
        error: 'Nội dung bắt buộc',
      },
    });

    expect(wrapper.text()).toContain('Nội dung bắt buộc');
  });
});
