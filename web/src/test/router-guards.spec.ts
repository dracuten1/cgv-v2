import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { router } from '@/router';
import { useAuthStore } from '@/stores/auth';
import { meApi } from '@/api/me';
import { ApiError } from '@/api/client';

describe('Router Navigation Guards', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
    await router.push('/');
  });

  it('redirects / to /tree', async () => {
    vi.spyOn(meApi, 'getMe').mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'Chưa đăng nhập'));
    await router.push('/');
    expect(router.currentRoute.value.path).toBe('/tree');
  });

  it('requiresAuth redirects anonymous users to /login?redirect=<path>', async () => {
    vi.spyOn(meApi, 'getMe').mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'Chưa đăng nhập'));

    await router.push('/account');
    expect(router.currentRoute.value.path).toBe('/login');
    expect(router.currentRoute.value.query.redirect).toBe('/account');
  });

  it('requiresAuth allows authenticated users to access /account', async () => {
    const authStore = useAuthStore();
    authStore.user = {
      id: 'user-1',
      display_name: 'Nguyễn Văn An',
      is_demo: false,
      created_at: new Date().toISOString(),
    };
    authStore.status = 'authenticated';

    await router.push('/account');
    expect(router.currentRoute.value.path).toBe('/account');
  });

  it('guest guard redirects authenticated user away from /login to /tree', async () => {
    const authStore = useAuthStore();
    authStore.user = {
      id: 'user-1',
      display_name: 'Nguyễn Văn An',
      is_demo: false,
      created_at: new Date().toISOString(),
    };
    authStore.status = 'authenticated';

    await router.push('/login');
    expect(router.currentRoute.value.path).toBe('/tree');
  });
});
