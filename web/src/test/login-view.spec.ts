import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import LoginView from '@/views/LoginView.vue';
import { useAuthStore } from '@/stores/auth';
import { authApi } from '@/api/auth';

const mockPush = vi.fn();
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useRoute: () => ({
    query: {},
  }),
}));

describe('LoginView.vue', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockPush.mockReset();
  });

  it('renders display-font heading and tagline', () => {
    const wrapper = mount(LoginView, {
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn })],
      },
    });

    expect(wrapper.text()).toContain('Cây Gia Phả');
    expect(wrapper.text()).toContain('Gìn giữ nguồn cội, kết nối muôn đời');
    expect(wrapper.find('[data-testid="demo-login-btn"]').exists()).toBe(true);
  });

  it('demo button triggers loginDemo and navigates', async () => {
    const wrapper = mount(LoginView, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
            stubActions: false,
          }),
        ],
      },
    });

    const authStore = useAuthStore();
    const loginDemoSpy = vi.spyOn(authStore, 'loginDemo').mockResolvedValue();

    const demoBtn = wrapper.find('[data-testid="demo-login-btn"]');
    expect(demoBtn.exists()).toBe(true);

    await demoBtn.trigger('click');

    expect(loginDemoSpy).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/tree');
  });

  it('magic link triggers sendMagicLink', async () => {
    const wrapper = mount(LoginView, {
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn })],
      },
    });

    const sendMagicLinkSpy = vi.spyOn(authApi, 'sendMagicLink').mockResolvedValue({
      message: 'OK',
    });

    const input = wrapper.find('input[type="email"]');
    await input.setValue('test@example.com');

    const form = wrapper.find('form');
    await form.trigger('submit.prevent');

    expect(sendMagicLinkSpy).toHaveBeenCalledWith('test@example.com');
  });
});