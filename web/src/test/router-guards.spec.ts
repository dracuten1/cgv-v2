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

  it('redirects / to /feed', async () => {
    vi.spyOn(meApi, 'getMe').mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'Chưa đăng nhập'));
    await router.push('/');
    expect(router.currentRoute.value.path).toBe('/feed');
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

  it('guest guard redirects authenticated user away from /login to /feed', async () => {
    const authStore = useAuthStore();
    authStore.user = {
      id: 'user-1',
      display_name: 'Nguyễn Văn An',
      is_demo: false,
      created_at: new Date().toISOString(),
    };
    authStore.status = 'authenticated';

    await router.push('/login');
    expect(router.currentRoute.value.path).toBe('/feed');
  });
});

// Feeds-as-main routing contracts (owner-approved 2026-10-01).
describe('feeds-as-main routing', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
    await router.push('/feed');
  });

  it('preserves an explicit redirect target through the sign-in route', async () => {
    const auth = useAuthStore();
    auth.status = 'anonymous';
    vi.spyOn(meApi, 'getMe').mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', ''));
    await router.push('/login?redirect=%2Faccount%3Ftab%3Dprofile');
    expect(router.currentRoute.value.path).toBe('/login');
    expect(router.currentRoute.value.query.redirect).toBe('/account?tab=profile');
    await router.push('/account?tab=profile');
    expect(router.currentRoute.value.path).toBe('/login');
    expect(router.currentRoute.value.query.redirect).toBe('/account?tab=profile');
  });

  it('keeps /tree directly reachable for authenticated users', async () => {
    const auth = useAuthStore();
    auth.user = { id:'user-1', display_name:'An', is_demo:false, created_at:new Date().toISOString() };
    auth.status = 'authenticated';
    await router.push('/tree');
    expect(router.currentRoute.value.path).toBe('/tree');
  });

  it('redirects authenticated users visiting a guest-only route to /feed', async () => {
    const auth = useAuthStore();
    auth.user = { id:'user-1', display_name:'An', is_demo:false, created_at:new Date().toISOString() };
    auth.status = 'authenticated';
    await router.push('/login');
    expect(router.currentRoute.value.path).toBe('/feed');
  });

  it('redirects / to /feed', async () => {
    const auth = useAuthStore();
    auth.status = 'anonymous';
    vi.spyOn(meApi, 'getMe').mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', ''));
    await router.push('/');
    expect(router.currentRoute.value.path).toBe('/feed');
  });
});
