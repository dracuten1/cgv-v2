import { describe, it, expect, vi, beforeEach } from 'vitest';
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

    expect(wrapper.find('[data-testid="verify-error"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Liên kết không hợp lệ');
    expect(wrapper.text()).toContain('Không tìm thấy mã xác thực');
    expect(wrapper.text()).toContain('Về trang đăng nhập');
  });

  it('calls verifyMagicLink with token and redirects to /tree on success', async () => {
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
    expect(wrapper.find('[data-testid="verify-success"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Đăng nhập thành công!');
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
    expect(wrapper.text()).toContain('Xác thực thất bại');
    expect(wrapper.text()).toContain('Mã xác thực đã hết hạn hoặc không hợp lệ.');
  });
});
