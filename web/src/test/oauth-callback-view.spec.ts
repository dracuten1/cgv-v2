import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import OAuthCallbackView from '@/views/OAuthCallbackView.vue';
import { useAuthStore } from '@/stores/auth';

const mockPush = vi.fn();
let mockQuery: Record<string, any> = {};

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useRoute: () => ({
    get query() {
      return mockQuery;
    },
  }),
}));

describe('OAuthCallbackView.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
    mockPush.mockReset();
    mockQuery = {};
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('mounts with ?oauth_error=already_linked and asserts the exact Vietnamese message renders', async () => {
    mockQuery = { oauth_error: 'already_linked' };

    const wrapper = mount(OAuthCallbackView, {
      global: {
        stubs: {
          'router-link': {
            props: ['to'],
            template: '<a :href="to" data-testid="stub-router-link"><slot /></a>',
          },
        },
      },
    });

    await flushPromises();

    expect(wrapper.find('[data-testid="oauth-error"]').exists()).toBe(true);
    // Thin wrapper renders the shared AuthInterstitial error state (no retry on oauth contract)
    expect(wrapper.find('[data-testid="status-disc-error"]').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('Thử lại');
    expect(wrapper.find('[data-testid="oauth-message"]').text()).toBe(
      'Tài khoản mạng xã hội này đã được liên kết với tài khoản khác.'
    );
  });

  it('mounts with ?oauth_error=<unknown-garbage> and asserts generic server_error message renders', async () => {
    mockQuery = { oauth_error: '<script>alert("xss")</script>' };

    const wrapper = mount(OAuthCallbackView, {
      global: {
        stubs: {
          'router-link': {
            props: ['to'],
            template: '<a :href="to" data-testid="stub-router-link"><slot /></a>',
          },
        },
      },
    });

    await flushPromises();

    expect(wrapper.find('[data-testid="oauth-error"]').exists()).toBe(true);
    // Must render generic server_error message, never the raw garbage
    expect(wrapper.find('[data-testid="oauth-message"]').text()).toBe(
      'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.'
    );
    expect(wrapper.html()).not.toContain('alert');
  });

  it('mounts with ?oauth_linked=google and asserts Vietnamese success message naming Google renders', async () => {
    mockQuery = { oauth_linked: 'google' };

    const wrapper = mount(OAuthCallbackView, {
      global: {
        stubs: {
          'router-link': {
            props: ['to'],
            template: '<a :href="to" data-testid="stub-router-link"><slot /></a>',
          },
        },
      },
    });

    await flushPromises();

    expect(wrapper.find('[data-testid="oauth-success"]').exists()).toBe(true);
    // Thin wrapper renders the shared AuthInterstitial success state
    expect(wrapper.find('[data-testid="status-disc-success"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="oauth-message"]').text()).toContain('Google');
    expect(wrapper.find('[data-testid="oauth-message"]').text()).toBe(
      'Đã liên kết thành công tài khoản Google với Cây Gia Phả.'
    );
  });

  it('asserts navigation affordance links to /account on success', async () => {
    mockQuery = { oauth_linked: 'facebook' };

    const wrapper = mount(OAuthCallbackView, {
      global: {
        stubs: {
          'router-link': {
            props: ['to'],
            template: '<a :href="to" data-testid="stub-router-link"><slot /></a>',
          },
        },
      },
    });

    await flushPromises();

    const navLink = wrapper.find('[data-testid="oauth-nav-affordance"]');
    expect(navLink.exists()).toBe(true);
    expect(navLink.attributes('href')).toBe('/account');
    expect(navLink.text()).toContain('Quay lại trang tài khoản');
  });

  it('navigates to /login on error when user is unauthenticated', async () => {
    mockQuery = { oauth_error: 'invalid_state' };

    const wrapper = mount(OAuthCallbackView, {
      global: {
        stubs: {
          'router-link': {
            props: ['to'],
            template: '<a :href="to" data-testid="stub-router-link"><slot /></a>',
          },
        },
      },
    });

    await flushPromises();

    const navLink = wrapper.find('[data-testid="oauth-nav-affordance"]');
    expect(navLink.exists()).toBe(true);
    expect(navLink.attributes('href')).toBe('/login');
    expect(navLink.text()).toContain('Về trang đăng nhập');
  });

  it('navigates to /account on error when user is authenticated', async () => {
    mockQuery = { oauth_error: 'provider_error' };
    const authStore = useAuthStore();
    authStore.user = {
      id: 'usr-123',
      display_name: 'Test User',
      is_demo: false,
      created_at: new Date().toISOString(),
    };
    authStore.status = 'authenticated';

    const wrapper = mount(OAuthCallbackView, {
      global: {
        stubs: {
          'router-link': {
            props: ['to'],
            template: '<a :href="to" data-testid="stub-router-link"><slot /></a>',
          },
        },
      },
    });

    await flushPromises();

    const navLink = wrapper.find('[data-testid="oauth-nav-affordance"]');
    expect(navLink.exists()).toBe(true);
    expect(navLink.attributes('href')).toBe('/account');
    expect(navLink.text()).toContain('Quay lại trang tài khoản');
  });

  it('prefers error message if both oauth_error and oauth_linked are present in query', async () => {
    mockQuery = { oauth_error: 'demo_restricted', oauth_linked: 'google' };

    const wrapper = mount(OAuthCallbackView, {
      global: {
        stubs: {
          'router-link': {
            props: ['to'],
            template: '<a :href="to" data-testid="stub-router-link"><slot /></a>',
          },
        },
      },
    });

    await flushPromises();

    expect(wrapper.find('[data-testid="oauth-error"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="oauth-message"]').text()).toBe(
      'Chức năng này bị hạn chế trong chế độ demo.'
    );
  });

  it('redirects to /feed after 1500ms when authenticated and oauth_linked=google (owner decision 2026-10-01: feeds are the main page)', async () => {
    vi.useFakeTimers();
    mockQuery = { oauth_linked: 'google' };
    const authStore = useAuthStore();
    authStore.user = {
      id: 'usr-123',
      display_name: 'Test User',
      is_demo: false,
      created_at: new Date().toISOString(),
    };
    authStore.status = 'authenticated';
    vi.spyOn(authStore, 'fetchMe').mockImplementation(async () => null);

    const wrapper = mount(OAuthCallbackView, {
      global: {
        stubs: {
          'router-link': {
            props: ['to'],
            template: '<a :href="to" data-testid="stub-router-link"><slot /></a>',
          },
        },
      },
    });

    await flushPromises();

    expect(wrapper.find('[data-testid="oauth-success"]').exists()).toBe(true);
    expect(mockPush).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1500);
    await flushPromises();

    expect(mockPush).toHaveBeenCalledWith('/feed');
  });

  it('post-auth redirect honors an explicit ?redirect= over the /feed default', async () => {
    vi.useFakeTimers();
    mockQuery = { oauth_linked: 'google', redirect: '/account' };
    const authStore = useAuthStore();
    authStore.user = {
      id: 'usr-123',
      display_name: 'Test User',
      is_demo: false,
      created_at: new Date().toISOString(),
    };
    authStore.status = 'authenticated';
    vi.spyOn(authStore, 'fetchMe').mockImplementation(async () => null);

    mount(OAuthCallbackView, {
      global: {
        stubs: {
          'router-link': {
            props: ['to'],
            template: '<a :href="to" data-testid="stub-router-link"><slot /></a>',
          },
        },
      },
    });

    await flushPromises();

    vi.advanceTimersByTime(1500);
    await flushPromises();

    expect(mockPush).toHaveBeenCalledWith('/account');
  });

  it('renders the role-specific subtitle "Liên kết phương thức đăng nhập" on both success and error outcomes', async () => {
    mockQuery = { oauth_linked: 'google' };
    const successWrapper = mount(OAuthCallbackView, {
      global: {
        stubs: {
          'router-link': {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await flushPromises();
    expect(successWrapper.text()).toContain('Liên kết phương thức đăng nhập');

    mockQuery = { oauth_error: 'invalid_state' };
    const errorWrapper = mount(OAuthCallbackView, {
      global: {
        stubs: {
          'router-link': {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await flushPromises();
    expect(errorWrapper.text()).toContain('Liên kết phương thức đăng nhập');
  });

  it('success action button uses semantic accent tokens (bg-accent-button, focus-visible:ring-accent), not raw terracotta', async () => {
    mockQuery = { oauth_linked: 'google' };
    const wrapper = mount(OAuthCallbackView, {
      global: {
        stubs: {
          'router-link': {
            props: ['to'],
            template: '<a :href="to" data-testid="stub-router-link"><slot /></a>',
          },
        },
      },
    });
    await flushPromises();

    const navLink = wrapper.find('[data-testid="oauth-nav-affordance"]');
    expect(navLink.exists()).toBe(true);
    // Semantic token migration: bg-terracotta (legacy alias) → bg-accent-button
    expect(navLink.classes()).toContain('bg-accent-button');
    expect(navLink.classes()).toContain('hover:bg-accent-hover');
    expect(navLink.classes()).toContain('focus-visible:ring-accent');
    // No raw palette classes remain on the action button
    expect(navLink.classes()).not.toContain('bg-terracotta');
    expect(navLink.classes()).not.toContain('hover:bg-terracotta-hover');
    expect(navLink.classes()).not.toContain('focus-visible:ring-terracotta');
    // Apple-style 14px radius (rounded-app-lg), not stock 8px
    expect(navLink.classes()).toContain('rounded-app-lg');
  });

  it('error action button uses semantic accent tokens on both auth states', async () => {
    // Unauthenticated error path
    mockQuery = { oauth_error: 'already_linked' };
    const guestWrapper = mount(OAuthCallbackView, {
      global: {
        stubs: {
          'router-link': {
            props: ['to'],
            template: '<a :href="to" data-testid="stub-router-link"><slot /></a>',
          },
        },
      },
    });
    await flushPromises();
    const guestNav = guestWrapper.find('[data-testid="oauth-nav-affordance"]');
    expect(guestNav.classes()).toContain('bg-accent-button');
    expect(guestNav.classes()).toContain('focus-visible:ring-accent');
    expect(guestNav.classes()).not.toContain('bg-terracotta');

    // Authenticated error path
    mockQuery = { oauth_error: 'demo_restricted' };
    const authStore = useAuthStore();
    authStore.user = {
      id: 'usr-123',
      display_name: 'Demo User',
      is_demo: true,
      created_at: new Date().toISOString(),
    };
    authStore.status = 'authenticated';
    const authWrapper = mount(OAuthCallbackView, {
      global: {
        stubs: {
          'router-link': {
            props: ['to'],
            template: '<a :href="to" data-testid="stub-router-link"><slot /></a>',
          },
        },
      },
    });
    await flushPromises();
    const authNav = authWrapper.find('[data-testid="oauth-nav-affordance"]');
    expect(authNav.classes()).toContain('bg-accent-button');
    expect(authNav.classes()).not.toContain('bg-terracotta');
  });

  it('preserves all 5 oauth_error codes with their exact Vietnamese messages and demo_restricted stays explicit', async () => {
    const codes: Array<[string, string]> = [
      ['invalid_state', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.'],
      ['already_linked', 'Tài khoản mạng xã hội này đã được liên kết với tài khoản khác.'],
      ['provider_error', 'Không thể kết nối với nhà cung cấp đăng nhập. Vui lòng thử lại sau.'],
      ['demo_restricted', 'Chức năng này bị hạn chế trong chế độ demo.'],
      ['server_error', 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.'],
    ];
    for (const [code, expected] of codes) {
      mockQuery = { oauth_error: code };
      const w = mount(OAuthCallbackView, {
        global: {
          stubs: {
            'router-link': {
              template: '<a><slot /></a>',
            },
          },
        },
      });
      await flushPromises();
      expect(w.find('[data-testid="oauth-error"]').exists()).toBe(true);
      expect(w.find('[data-testid="oauth-message"]').text()).toBe(expected);
    }
    // demo_restricted explicit-text contract: copy names "chế độ demo" explicitly.
    expect(codes.find((c) => c[0] === 'demo_restricted')![1]).toContain('chế độ demo');
  });
});
