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

  it('renders brand lockup glyph, display-font heading and tagline', () => {
    const wrapper = mount(LoginView, {
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn })],
      },
    });

    // Brand lockup: terracotta "Phả" glyph + wordmark + tagline
    const glyph = wrapper.find('h1').element.previousElementSibling;
    expect(glyph?.textContent?.trim()).toBe('Phả');
    expect(glyph?.className).toContain('bg-terracotta');

    expect(wrapper.text()).toContain('Cây Gia Phả');
    expect(wrapper.text()).toContain('Gìn giữ nguồn cội, kết nối muôn đời');
    expect(wrapper.find('[data-testid="demo-login-btn"]').exists()).toBe(true);
  });

  it('renders heritage ghost decorations behind the card (aria-hidden)', () => {
    const wrapper = mount(LoginView, {
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn })],
      },
    });

    const ghosts = wrapper.findAll('div[aria-hidden="true"]');
    // Oversized glyph + two gen-pastel dot clusters
    expect(ghosts.length).toBeGreaterThanOrEqual(3);
    const glyph = ghosts.find((d) => d.text() === 'Phả');
    expect(glyph).toBeDefined();
    expect(glyph!.classes()).toContain('opacity-[0.05]');
    expect(glyph!.classes()).toContain('font-display');
  });

  it('renders OAuth provider buttons for Google, Facebook and Zalo', () => {
    const wrapper = mount(LoginView, {
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn })],
      },
    });

    expect(wrapper.text()).toContain('Đăng nhập với Google');
    expect(wrapper.text()).toContain('Đăng nhập với Facebook');
    expect(wrapper.text()).toContain('Đăng nhập với Zalo');
  });

  it('demo affordance is AMBER (INV-04): demo panel + demo button, never terracotta', () => {
    const wrapper = mount(LoginView, {
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn })],
      },
    });

    // Amber panel with sparkles icon (mockup 01 / spec §4.6)
    const panel = wrapper.find('.bg-amber-50\\/60');
    expect(panel.exists()).toBe(true);
    expect(panel.classes()).toContain('border-amber-200');

    const demoBtn = wrapper.find('[data-testid="demo-login-btn"]');
    expect(demoBtn.exists()).toBe(true);
    expect(demoBtn.classes()).toContain('bg-amber-400');
    // INV-04: demo CTA never uses terracotta
    expect(demoBtn.classes()).not.toContain('bg-terracotta');

    // Caption keeps the seed wording
    expect(wrapper.text()).toContain('gia phả mẫu Nguyễn Văn An');
  });

  it('renders envelope-prefixed magic-link input with passwordless hint', () => {
    const wrapper = mount(LoginView, {
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn })],
      },
    });

    const input = wrapper.find('input[type="email"]');
    expect(input.exists()).toBe(true);
    expect(input.attributes('placeholder')).toBe('Nhập email của bạn');
    expect(wrapper.text()).toContain('không cần mật khẩu');
    // Divider sits on the card background
    expect(wrapper.text()).toContain('Hoặc email');
    expect(wrapper.text()).toContain('Thử nghiệm');
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

  it('magic link triggers sendMagicLink and shows the sent confirmation', async () => {
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
    expect(wrapper.text()).toContain('Đã gửi liên kết đăng nhập');
  });
});
