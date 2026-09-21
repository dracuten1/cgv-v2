<template>
  <div class="min-h-screen flex flex-col bg-cream text-slate-800">
    <!-- Desktop Header (md+) -->
    <header class="hidden md:block bg-white border-b border-slate-200 sticky top-0 z-40">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <!-- Logo & Brand -->
        <div class="flex items-center space-x-3">
          <router-link to="/tree" class="flex items-center space-x-2 text-slate-900 font-display font-bold text-xl">
            <span class="w-8 h-8 rounded-lg bg-[#C85A32] text-white flex items-center justify-center font-serif text-lg">
              Phả
            </span>
            <span>Cây Gia Phả</span>
          </router-link>
        </div>

        <!-- Navigation Links -->
        <nav class="flex items-center space-x-1" aria-label="Điều hướng chính">
          <router-link
            to="/tree"
            class="px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            :class="isActive('/tree') ? 'bg-[#F9EAE1] text-[#983F1E] font-semibold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'"
          >
            Gia phả
          </router-link>
          <router-link
            to="/kinship"
            class="px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            :class="isActive('/kinship') ? 'bg-[#F9EAE1] text-[#983F1E] font-semibold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'"
          >
            Quan hệ
          </router-link>
          <router-link
            to="/feed"
            class="px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            :class="isActive('/feed') ? 'bg-[#F9EAE1] text-[#983F1E] font-semibold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'"
          >
            Bảng tin
          </router-link>
          <router-link
            to="/account"
            class="px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            :class="isActive('/account') ? 'bg-[#F9EAE1] text-[#983F1E] font-semibold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'"
          >
            Tài khoản
          </router-link>
        </nav>

        <!-- User Controls / Auth -->
        <div class="flex items-center space-x-3">
          <template v-if="auth.isAuthenticated">
            <div class="flex items-center space-x-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-full text-xs">
              <span class="font-medium text-slate-800">{{ auth.displayName }}</span>
              <span
                v-if="auth.isDemo"
                class="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
              >
                Demo
              </span>
            </div>
            <button
              type="button"
              class="text-xs text-slate-500 hover:text-red-600 font-medium transition-colors cursor-pointer"
              @click="handleLogout"
            >
              Đăng xuất
            </button>
          </template>
          <template v-else>
            <router-link
              to="/login"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#C85A32] text-white hover:bg-[#B24E2A] transition-colors"
            >
              Đăng nhập
            </router-link>
          </template>
        </div>
      </div>
    </header>

    <!-- Main Content Area with padding for mobile BottomNav -->
    <main class="flex-1 pb-20 md:pb-6">
      <slot />
    </main>

    <!-- Mobile Fixed BottomNav (< md) -->
    <!-- Hidden on /login route per spec -->
    <nav
      v-if="showBottomNav"
      class="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xs border-t border-slate-200"
      style="padding-bottom: env(safe-area-inset-bottom, 0px);"
      aria-label="Điều hướng di động"
    >
      <div class="grid grid-cols-4 h-16">
        <!-- 1. Gia phả -->
        <router-link
          to="/tree"
          class="flex flex-col items-center justify-center text-xs font-medium transition-colors"
          :class="isActive('/tree') ? 'text-[#C85A32]' : 'text-slate-500 hover:text-slate-900'"
        >
          <!-- Tree SVG Icon -->
          <svg class="w-5 h-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m0-16a4 4 0 00-4 4v2m4-6a4 4 0 014 4v2m-8 6h8m-8 0a3 3 0 100 6h8a3 3 0 100-6" />
          </svg>
          <span>Gia phả</span>
        </router-link>

        <!-- 2. Quan hệ -->
        <router-link
          to="/kinship"
          class="flex flex-col items-center justify-center text-xs font-medium transition-colors"
          :class="isActive('/kinship') ? 'text-[#C85A32]' : 'text-slate-500 hover:text-slate-900'"
        >
          <!-- Kinship SVG Icon -->
          <svg class="w-5 h-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span>Quan hệ</span>
        </router-link>

        <!-- 3. Bảng tin -->
        <router-link
          to="/feed"
          class="flex flex-col items-center justify-center text-xs font-medium transition-colors"
          :class="isActive('/feed') ? 'text-[#C85A32]' : 'text-slate-500 hover:text-slate-900'"
        >
          <!-- Feed SVG Icon -->
          <svg class="w-5 h-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
          <span>Bảng tin</span>
        </router-link>

        <!-- 4. Tài khoản -->
        <router-link
          to="/account"
          class="flex flex-col items-center justify-center text-xs font-medium transition-colors"
          :class="isActive('/account') ? 'text-[#C85A32]' : 'text-slate-500 hover:text-slate-900'"
        >
          <!-- Account SVG Icon -->
          <svg class="w-5 h-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span>Tài khoản</span>
        </router-link>
      </div>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const showBottomNav = computed(() => {
  return route.path !== '/login';
});

const isActive = (path: string) => {
  if (path === '/tree' && (route.path === '/tree' || route.path.startsWith('/members/'))) {
    return true;
  }
  return route.path.startsWith(path);
};

const handleLogout = async () => {
  await auth.logout();
  router.push('/login');
};
</script>
