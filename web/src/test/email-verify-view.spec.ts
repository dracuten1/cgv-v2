import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import EmailVerifyView from '@/views/EmailVerifyView.vue';
import { authApi } from '@/api/auth';
import { meApi } from '@/api/me';
import { ApiError } from '@/api/client';

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

describe('EmailVerifyView.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
    mockPush.mockReset();
    mockQuery = {};
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders invalid token message when query.token is missing', async () => {
    mockQuery = {};

    const wrapper = mount(EmailVerifyView, {
      global: {
        stubs: {
          'router-link': {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await flushPromises();

    // Thin wrapper renders the shared AuthInterstitial error state
    expect(wrapper.find('[data-testid="verify-error"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="status-disc-error"]').exists()).toBe(true);
    // No retry affordance without a token (matches v-if="hasToken" contract)
    expect(wrapper.text()).not.toContain('Thử lại');
    expect(wrapper.text()).toContain('Liên kết không hợp lệ');
    expect(wrapper.text()).toContain('Không tìm thấy mã xác thực');
    expect(wrapper.text()).toContain('Về trang đăng nhập');
    // Role-specific subtitle from AuthInterstitial prop
    expect(wrapper.text()).toContain('Xác thực liên kết email');
  });

  it('renders loading state with working disc and role-specific loading subtitle/copy', async () => {
    // Pin a token but intercept the API to keep state in loading.
    mockQuery = { token: 'pending-jwt-token' };

    let resolveVerify: (() => void) | null = null;
    vi.spyOn(authApi, 'verifyMagicLink').mockImplementation(
      () => new Promise((resolve) => {
        resolveVerify = () => resolve({
          user: {
            id: 'usr-1',
            display_name: 'Pending',
            is_demo: false,
            created_at: new Date().toISOString(),
          },
          is_new: false,
          conflict_detected: false,
        });
      })
    );

    const wrapper = mount(EmailVerifyView, {
      global: {
        stubs: {
          'router-link': {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    // First promise micro-task: state moves to 'loading' before verify resolves.
    await Promise.resolve();
    await Promise.resolve();

    expect(wrapper.find('[data-testid="verify-loading"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="status-disc-working"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Đang xác thực');
    expect(wrapper.text()).toContain('Vui lòng đợi trong giây lát');
    // Step mapping contrast: loading = step 2 -> dots 1-2 active, dot 3 NOT yet
    const dots = wrapper.findAll('[data-testid="verify-loading"] span.rounded-full');
    expect(dots.length).toBe(3);
    expect(dots[1].classes()).toContain('bg-accent');
    expect(dots[2].classes()).not.toContain('bg-accent');

    // Cleanup: resolve so no hanging promise
    if (resolveVerify) (resolveVerify as () => void)();
  });

  it('calls verifyMagicLink with token and renders the success interstitial', async () => {
    mockQuery = { token: 'valid-jwt-token' };

    const mockUser = {
      id: 'usr-1',
      display_name: 'Nguyen Van A',
      is_demo: false,
      created_at: new Date().toISOString(),
    };

    const verifySpy = vi.spyOn(authApi, 'verifyMagicLink').mockResolvedValue({
      user: mockUser,
      is_new: false,
      conflict_detected: false,
    });

    vi.spyOn(meApi, 'getMe').mockResolvedValue({
      User: mockUser,
      Identities: [],
      Contacts: [],
    });

    const wrapper = mount(EmailVerifyView, {
      global: {
        stubs: {
          'router-link': {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await flushPromises();

    expect(verifySpy).toHaveBeenCalledWith('valid-jwt-token');
    // Thin wrapper renders the shared AuthInterstitial success state
    expect(wrapper.find('[data-testid="verify-success"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="status-disc-success"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Đăng nhập thành công!');
    // Mockup-aligned success copy
    expect(wrapper.text()).toContain('Liên kết đã được xác nhận');
    // Success stepper shows step 3 (completion): third dot active (all 3 lit)
    const dots = wrapper.findAll('[data-testid="verify-success"] span.rounded-full');
    expect(dots.length).toBe(3);
    expect(dots[2].classes()).toContain('bg-accent');
    expect(dots.filter((d) => d.classes().includes('bg-accent')).length).toBe(3);
  });

  // --- MAJ-1 (owner decision 2026-10-01: feeds are the main page) ---
  // The emailed magic link is the normal email sign-in completion path.

  async function mountSignedIn(): Promise<ReturnType<typeof mount>> {
    const mockUser = {
      id: 'usr-1',
      display_name: 'Nguyen Van A',
      is_demo: false,
      created_at: new Date().toISOString(),
    };
    vi.spyOn(authApi, 'verifyMagicLink').mockResolvedValue({
      user: mockUser,
      is_new: false,
      conflict_detected: false,
    });
    vi.spyOn(meApi, 'getMe').mockResolvedValue({
      User: mockUser,
      Identities: [],
      Contacts: [],
    });
    const wrapper = mount(EmailVerifyView, {
      global: {
        stubs: {
          'router-link': {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await flushPromises();
    return wrapper;
  }

  it('normal email sign-in (magic link) success defaults to /feed', async () => {
    vi.useFakeTimers();
    mockQuery = { token: 'valid-jwt-token' };

    const wrapper = await mountSignedIn();

    expect(wrapper.find('[data-testid="verify-success"]').exists()).toBe(true);
    // Copy names the feed destination, not the tree
    expect(wrapper.text()).toContain('bảng tin dòng họ');
    expect(mockPush).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    await flushPromises();

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/feed');
  });

  it('normal email sign-in success honors an explicit ?redirect= over the /feed default', async () => {
    vi.useFakeTimers();
    mockQuery = { token: 'valid-jwt-token', redirect: '/tree' };

    const wrapper = await mountSignedIn();

    expect(wrapper.find('[data-testid="verify-success"]').exists()).toBe(true);

    vi.advanceTimersByTime(500);
    await flushPromises();

    expect(mockPush).toHaveBeenCalledWith('/tree');
  });

  it('displays error message when verifyMagicLink fails', async () => {
    mockQuery = { token: 'invalid-or-expired-token' };

    vi.spyOn(authApi, 'verifyMagicLink').mockRejectedValue(
      new ApiError(400, 'INVALID_TOKEN', 'Mã xác thực đã hết hạn hoặc không hợp lệ.')
    );

    const wrapper = mount(EmailVerifyView, {
      global: {
        stubs: {
          'router-link': {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await flushPromises();

    expect(wrapper.find('[data-testid="verify-error"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="status-disc-error"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Xác thực thất bại');
    expect(wrapper.text()).toContain('Mã xác thực đã hết hạn hoặc không hợp lệ.');
    // Retry affordance renders when a token is present (retryable=hasToken)
    expect(wrapper.text()).toContain('Thử lại');
  });
});
