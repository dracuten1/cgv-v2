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
    // Glyph is pure decoration rendered as ::before pseudo-content (no measurable
    // DOM text node at 5% opacity — WCAG 1.4.3 decorative exemption).
    const glyph = ghosts.find((d) => d.classes().some((c) => c.includes('before:content')));
    expect(glyph).toBeDefined();
    expect(glyph!.classes()).toContain('opacity-[0.05]');
    expect(glyph!.classes()).toContain('font-display');
  });

  it('renders the two-column intro panel per approved login.html mockup (shown >=960px only)', () => {
    const wrapper = mount(LoginView, {
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn })],
      },
    });

    // Intro panel exists, hidden below 960px, flex column at >=960px (responsive classes)
    const intro = wrapper.find('[data-testid="login-intro"]');
    expect(intro.exists()).toBe(true);
    expect(intro.classes()).toContain('hidden');
    expect(intro.classes()).toContain('min-[960px]:flex');
    expect(intro.classes()).toContain('bg-quiet');
    expect(intro.classes()).toContain('border-r');
    expect(intro.classes()).toContain('border-hairline');

    // Intro copy per mockup (title, sub, lineage legend, footer)
    expect(intro.text()).toContain('Gìn giữ nguồn cội, kết nối muôn đời.');
    expect(intro.text()).toContain('Cây Gia Phả giúp dòng họ của bạn ghi lại, tra cứu và chia sẻ gia phả');
    expect(intro.text()).toContain('Đời thứ nhất');
    expect(intro.text()).toContain('Đời thứ tư');
    expect(intro.text()).toContain('Bản quyền dòng họ · Dữ liệu lưu trữ riêng tư');

    // Intro brand mark: NEW markup -> semantic accent token (not the legacy alias)
    const mark = intro.find('.bg-accent-button');
    expect(mark.exists()).toBe(true);
    expect(mark.text().trim()).toBe('Ph');

    // Ghost decorations yield to the intro panel at >=960px
    const glyph = wrapper
      .findAll('div[aria-hidden="true"]')
      .find((d) => d.classes().some((c) => c.includes('before:content')));
    expect(glyph).toBeDefined();
    expect(glyph!.classes()).toContain('min-[960px]:hidden');

    // All card affordances still present after the restructure
    expect(wrapper.find('[data-testid="demo-login-btn"]').exists()).toBe(true);
    expect(wrapper.find('input[type="email"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Đăng nhập với Google');

    // Card width per mockup .auth-card: max-w-md (448px) below 960px (mobile byte-identical),
    // mockup-pinned 400px at >=960px (desktop conformance)
    const card = wrapper.find('.bg-card');
    expect(card.exists()).toBe(true);
    expect(card.classes()).toContain('max-w-md');
    expect(card.classes()).toContain('min-[960px]:max-w-[400px]');
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

    // Amber panel with sparkles icon (mockup 01 / spec §4.6) — semantic demo
    // tokens (INV-04: amber family only, AA in both color schemes via tokens)
    const panel = wrapper.find('.bg-demo-soft');
    expect(panel.exists()).toBe(true);
    expect(panel.classes()).toContain('border-demo-border');
    expect(panel.classes()).not.toContain('bg-amber-50\\/60');

    const demoBtn = wrapper.find('[data-testid="demo-login-btn"]');
    expect(demoBtn.exists()).toBe(true);
    expect(demoBtn.classes()).toContain('bg-demo-button');
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

  // --- F1 scheduled defect fix (additive): Zalo glyph dark-mode contrast ---

  it('F1: Zalo glyph keeps brand blue in light and pins the dark-mode AA variant class', () => {
    const wrapper = mount(LoginView, {
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn })],
      },
    });

    const zaloGlyph = wrapper.findAll('span').find((s) => s.classes().includes('tracking-tighter'));
    expect(zaloGlyph).toBeDefined();
    // Light mode unchanged: exact Zalo brand blue (already passing 4.75:1 on white card)
    expect(zaloGlyph!.classes()).toContain('text-[#0068FF]');
    // Dark mode: lightened Zalo blue, 6.45:1 on the dark card surface (#292624)
    expect(zaloGlyph!.classes()).toContain('dark:text-[#74ABFF]');
    // Glyph remains the bold "Z" brand mark — not swapped for an icon or plain text
    expect(zaloGlyph!.classes()).toContain('font-bold');
    expect(zaloGlyph!.text()).toBe('Z');
  });
});
