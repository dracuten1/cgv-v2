import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import AuthInterstitial from '@/components/ui/AuthInterstitial.vue';

describe('AuthInterstitial.vue', () => {
  it('renders working status disc with spinner', () => {
    const wrapper = mount(AuthInterstitial, {
      props: {
        status: 'working',
        title: 'Đang xác thực liên kết...',
        copy: 'Vui lòng chờ trong giây lát.',
      },
      global: {
        stubs: ['router-link'],
      },
    });

    expect(wrapper.find('[data-testid="status-disc-working"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Đang xác thực liên kết...');
    expect(wrapper.text()).toContain('Vui lòng chờ trong giây lát.');
  });

  it('renders success status disc with check circle', () => {
    const wrapper = mount(AuthInterstitial, {
      props: {
        status: 'success',
        title: 'Đăng nhập thành công!',
        copy: 'Đang chuyển hướng bạn đến cây gia phả...',
      },
      global: {
        stubs: ['router-link'],
      },
    });

    expect(wrapper.find('[data-testid="status-disc-success"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Đăng nhập thành công!');
  });

  it('renders error status disc and emits retry on button click', async () => {
    const wrapper = mount(AuthInterstitial, {
      props: {
        status: 'error',
        title: 'Liên kết không hợp lệ',
        copy: 'Liên kết đã hết hạn hoặc không tồn tại.',
        retryable: true,
        retryLabel: 'Thử lại ngay',
      },
      global: {
        stubs: ['router-link'],
      },
    });

    expect(wrapper.find('[data-testid="status-disc-error"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Liên kết không hợp lệ');

    const retryBtn = wrapper.findComponent({ name: 'AppButton' });
    expect(retryBtn.exists()).toBe(true);
    expect(retryBtn.text()).toContain('Thử lại ngay');

    await retryBtn.trigger('click');
    expect(wrapper.emitted('retry')).toBeDefined();
  });
});

describe('dark contrast regression semantics', () => {
  it('uses semantic readable foregrounds while preserving generation surfaces and login link', async () => {
    const auth = mount(AuthInterstitial, { global: { stubs: ['router-link'] } });
    const loginLink = auth.find('router-link-stub');
    expect(loginLink.exists()).toBe(true);
    expect(loginLink.classes()).toContain('hover:text-accent-fg');
    expect(loginLink.attributes('to')).toBe('/login');
    const { default: AppChip } = await import('@/components/ui/AppChip.vue');
    for (const [i, variant] of (['gen1', 'gen2', 'gen3', 'gen4'] as const).entries()) {
      const chip = mount(AppChip, { props: { variant }, slots: { default: 'Generation' } });
      expect(chip.classes()).toContain(`text-gen-${i + 1}-fg`);
      expect(chip.classes()).toContain(`bg-gen-${i + 1}-soft`);
      expect(chip.text()).toBe('Generation');
    }
  });
});
