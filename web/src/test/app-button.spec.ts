import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import AppButton from '@/components/ui/AppButton.vue';

describe('AppButton.vue', () => {
  it('renders primary button by default with terracotta tokens', () => {
    const wrapper = mount(AppButton, {
      slots: {
        default: 'Bắt đầu',
      },
    });

    expect(wrapper.element.tagName).toBe('BUTTON');
    expect(wrapper.classes()).toContain('bg-terracotta');
    expect(wrapper.classes()).toContain('text-white');
    expect(wrapper.text()).toBe('Bắt đầu');
  });

  it('renders demo variant in amber per INV-04', () => {
    const wrapper = mount(AppButton, {
      props: {
        variant: 'demo',
      },
      slots: {
        default: 'Thử nghiệm ngay',
      },
    });

    expect(wrapper.classes()).toContain('bg-demo-button');
    expect(wrapper.classes()).toContain('hover:bg-demo-hover');
    expect(wrapper.classes()).toContain('text-white');
    expect(wrapper.classes()).toContain('border-demo-border');
  });

  it('renders router-link when "to" prop is passed', () => {
    const wrapper = mount(AppButton, {
      props: {
        to: '/login',
        variant: 'outline',
      },
      global: {
        stubs: {
          'router-link': {
            template: '<a :href="to"><slot /></a>',
            props: ['to'],
          },
        },
      },
      slots: {
        default: 'Đăng nhập',
      },
    });

    const link = wrapper.find('a');
    expect(link.exists()).toBe(true);
    expect(link.attributes('href')).toBe('/login');
    expect(link.classes()).toContain('border-hairline-strong');
    expect(link.classes()).toContain('text-ink-1');
  });

  it('disables click and interaction when disabled or loading', async () => {
    const wrapper = mount(AppButton, {
      props: {
        disabled: true,
      },
      slots: {
        default: 'Lưu',
      },
    });

    expect(wrapper.attributes('disabled')).toBeDefined();
    await wrapper.trigger('click');
    expect(wrapper.emitted('click')).toBeUndefined();
  });
});
