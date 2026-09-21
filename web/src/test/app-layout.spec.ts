import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import AppLayout from '@/components/layout/AppLayout.vue';
import { useAuthStore } from '@/stores/auth';
import { createRouter, createMemoryHistory } from 'vue-router';

const testRouter = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/tree', component: { template: '<div>Tree</div>' } },
    { path: '/kinship', component: { template: '<div>Kinship</div>' } },
    { path: '/feed', component: { template: '<div>Feed</div>' } },
    { path: '/account', component: { template: '<div>Account</div>' } },
    { path: '/login', component: { template: '<div>Login</div>' } },
  ],
});

describe('AppLayout smoke & mobile navigation', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
    await testRouter.push('/tree');
  });

  it('renders all 4 Vietnamese labels on mobile BottomNav', () => {
    const wrapper = mount(AppLayout, {
      global: {
        plugins: [testRouter],
      },
    });

    const bottomNav = wrapper.find('nav[aria-label="Điều hướng di động"]');
    expect(bottomNav.exists()).toBe(true);

    const text = bottomNav.text();
    expect(text).toContain('Gia phả');
    expect(text).toContain('Quan hệ');
    expect(text).toContain('Bảng tin');
    expect(text).toContain('Tài khoản');
  });

  it('hides BottomNav on /login route', async () => {
    await testRouter.push('/login');

    const wrapper = mount(AppLayout, {
      global: {
        plugins: [testRouter],
      },
    });

    const bottomNav = wrapper.find('nav[aria-label="Điều hướng di động"]');
    expect(bottomNav.exists()).toBe(false);
  });

  it('renders Demo badge in desktop header when isDemo is true', async () => {
    await testRouter.push('/tree');
    const authStore = useAuthStore();
    authStore.user = {
      id: 'demo-user',
      display_name: 'Người dùng Thử nghiệm',
      is_demo: true,
      created_at: new Date().toISOString(),
    };
    authStore.status = 'authenticated';

    const wrapper = mount(AppLayout, {
      global: {
        plugins: [testRouter],
      },
    });

    expect(wrapper.text()).toContain('Người dùng Thử nghiệm');
    expect(wrapper.text()).toContain('Demo');
  });
});
