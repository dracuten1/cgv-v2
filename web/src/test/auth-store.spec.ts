import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from '@/stores/auth';
import { meApi } from '@/api/me';
import { authApi } from '@/api/auth';
import { ApiError } from '@/api/client';

describe('Auth Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
  });

  it('fetchMe handles silent 401 gracefully without throwing', async () => {
    vi.spyOn(meApi, 'getMe').mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'Chưa đăng nhập'));

    const authStore = useAuthStore();
    expect(authStore.status).toBe('idle');

    const result = await authStore.fetchMe();
    expect(result).toBeNull();
    expect(authStore.user).toBeNull();
    expect(authStore.status).toBe('anonymous');
    expect(authStore.isAuthenticated).toBe(false);
  });

  it('loginDemo happy path sets user, authenticated status, and isDemo true', async () => {
    const mockUser = {
      id: 'demo-user-123',
      display_name: 'Khách dùng thử',
      is_demo: true,
      created_at: new Date().toISOString(),
    };

    vi.spyOn(authApi, 'startDemo').mockResolvedValue({
      user: mockUser,
      is_new: true,
      conflict_detected: false,
    });

    vi.spyOn(meApi, 'getMe').mockResolvedValue({
      User: mockUser,
      Identities: [
        {
          id: 'ident-1',
          user_id: mockUser.id,
          provider: 'demo',
          provider_subject: mockUser.id,
          linked_at: new Date().toISOString(),
          last_login_at: new Date().toISOString(),
        },
      ],
      Contacts: [],
    });

    const authStore = useAuthStore();
    await authStore.loginDemo();

    expect(authStore.user).toEqual(mockUser);
    expect(authStore.isAuthenticated).toBe(true);
    expect(authStore.isDemo).toBe(true);
    expect(authStore.displayName).toBe('Khách dùng thử');
    expect(authStore.identities.length).toBe(1);
  });

  it('logout resets auth state to anonymous', async () => {
    vi.spyOn(authApi, 'logout').mockResolvedValue({ message: 'Đăng xuất thành công' });

    const authStore = useAuthStore();
    authStore.user = {
      id: 'u-1',
      display_name: 'Test',
      is_demo: false,
      created_at: new Date().toISOString(),
    };
    authStore.status = 'authenticated';

    await authStore.logout();

    expect(authStore.user).toBeNull();
    expect(authStore.status).toBe('anonymous');
    expect(authStore.isAuthenticated).toBe(false);
  });

  it('unlinkIdentity surfaces Vietnamese error message on 409', async () => {
    vi.spyOn(meApi, 'unlinkIdentity').mockRejectedValue(
      new ApiError(409, 'LAST_IDENTITY_CANNOT_BE_REMOVED', 'Không thể xóa')
    );

    const authStore = useAuthStore();
    await expect(authStore.unlinkIdentity('id-1')).rejects.toThrow(
      'Không thể hủy liên kết phương thức đăng nhập duy nhất của tài khoản.'
    );
  });
});
