import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/tree',
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: {
      guest: true,
      title: 'Đăng nhập — Cây Gia Phả',
    },
  },
  {
    path: '/auth/email/verify',
    name: 'email-verify',
    component: () => import('@/views/EmailVerifyView.vue'),
    meta: {
      guest: true,
      title: 'Xác thực email — Cây Gia Phả',
    },
  },
  {
    path: '/tree',
    name: 'tree',
    component: () => import('@/views/TreeView.vue'),
    meta: {
      title: 'Cây Gia Phả',
    },
  },
  {
    path: '/members/:id',
    name: 'member-detail',
    component: () => import('@/views/MemberDetailView.vue'),
    meta: {
      title: 'Chi tiết thành viên — Cây Gia Phả',
    },
  },
  {
    path: '/kinship',
    name: 'kinship',
    component: () => import('@/views/KinshipView.vue'),
    meta: {
      title: 'Tính quan hệ dòng họ — Cây Gia Phả',
    },
  },
  {
    path: '/feed',
    name: 'feed',
    component: () => import('@/views/FeedView.vue'),
    meta: {
      title: 'Bảng tin dòng họ — Cây Gia Phả',
    },
  },
  {
    path: '/account',
    name: 'account',
    component: () => import('@/views/AccountView.vue'),
    meta: {
      requiresAuth: true,
      title: 'Tài khoản — Cây Gia Phả',
    },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: {
      title: 'Không tìm thấy trang — Cây Gia Phả',
    },
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});

// Navigation Guards
router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore();

  // If status is idle, attempt silent fetchMe once
  if (authStore.status === 'idle') {
    await authStore.fetchMe();
  }

  // 1. Check requiresAuth guard
  if (to.meta.requiresAuth) {
    if (!authStore.isAuthenticated) {
      // Re-check once with fetchMe if loading or not sure
      if (authStore.status === 'loading') {
        await authStore.fetchMe();
      }

      if (!authStore.isAuthenticated) {
        return next({
          path: '/login',
          query: { redirect: to.fullPath },
        });
      }
    }
  }

  // 2. Check guest guard (already authenticated hitting /login -> redirect /tree)
  if (to.meta.guest && authStore.isAuthenticated) {
    return next({ path: '/tree' });
  }

  // Set document title if specified
  if (to.meta.title) {
    document.title = String(to.meta.title);
  }

  next();
});

export default router;
