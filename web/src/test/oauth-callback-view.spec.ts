import { describe, it, expect, vi, beforeEach } from 'vitest';
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
});
