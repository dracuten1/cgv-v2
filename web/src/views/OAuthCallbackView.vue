<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-50 p-4 sm:p-6 font-sans">
    <div class="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-8 text-center">
      <!-- Logo / Header -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold font-display text-slate-800 tracking-tight">
          Cây Gia Phả
        </h1>
        <p class="text-slate-500 text-xs mt-1">
          Xác thực liên kết tài khoản
        </p>
      </div>

      <!-- State: Success -->
      <div v-if="outcome.type === 'success'" class="py-6 space-y-4" data-testid="oauth-success">
        <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-emerald-100 text-emerald-600">
          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 class="text-base font-semibold text-slate-800">Liên kết tài khoản thành công!</h2>
        <p class="text-xs text-slate-600 leading-normal" data-testid="oauth-message">
          {{ outcome.message }}
        </p>
        <div class="pt-2 flex flex-col gap-2">
          <router-link
            to="/account"
            class="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-[#C85A32] hover:bg-[#B24E2A] transition-colors"
            data-testid="oauth-nav-affordance"
          >
            Quay lại trang tài khoản
          </router-link>
        </div>
      </div>

      <!-- State: Error -->
      <div v-else class="py-6 space-y-4" data-testid="oauth-error">
        <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-rose-100 text-rose-600">
          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 class="text-base font-semibold text-slate-800">Liên kết tài khoản không thành công</h2>
        <p class="text-xs text-slate-600 leading-normal" data-testid="oauth-message">
          {{ outcome.message }}
        </p>
        <div class="pt-2 flex flex-col gap-2">
          <router-link
            :to="errorNavTarget"
            class="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-[#C85A32] hover:bg-[#B24E2A] transition-colors"
            data-testid="oauth-nav-affordance"
          >
            {{ errorNavLabel }}
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

// Allowlist definitions
type KnownError = 'invalid_state' | 'already_linked' | 'provider_error' | 'demo_restricted' | 'server_error';
type KnownProvider = 'google' | 'facebook' | 'zalo';

const ERROR_MESSAGES: Record<KnownError, string> = {
  invalid_state: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.',
  already_linked: 'Tài khoản mạng xã hội này đã được liên kết với tài khoản khác.',
  provider_error: 'Không thể kết nối với nhà cung cấp đăng nhập. Vui lòng thử lại sau.',
  demo_restricted: 'Chức năng này bị hạn chế trong chế độ demo.',
  server_error: 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.',
};

const PROVIDER_NAMES: Record<KnownProvider, string> = {
  google: 'Google',
  facebook: 'Facebook',
  zalo: 'Zalo',
};

const DEFAULT_ERROR_MESSAGE = ERROR_MESSAGES.server_error;

const outcome = computed<{ type: 'success' | 'error'; message: string }>(() => {
  const query = route.query;
  const rawError = typeof query.oauth_error === 'string' ? query.oauth_error : null;
  const rawLinked = typeof query.oauth_linked === 'string' ? query.oauth_linked : null;

  // Prefer error if both are present
  if (rawError !== null) {
    if (Object.prototype.hasOwnProperty.call(ERROR_MESSAGES, rawError)) {
      return {
        type: 'error',
        message: ERROR_MESSAGES[rawError as KnownError],
      };
    }
    return {
      type: 'error',
      message: DEFAULT_ERROR_MESSAGE,
    };
  }

  if (rawLinked !== null) {
    if (Object.prototype.hasOwnProperty.call(PROVIDER_NAMES, rawLinked)) {
      const providerLabel = PROVIDER_NAMES[rawLinked as KnownProvider];
      return {
        type: 'success',
        message: `Đã liên kết thành công tài khoản ${providerLabel} với Cây Gia Phả.`,
      };
    }
    // Unknown provider fallback to server_error per contract
    return {
      type: 'error',
      message: DEFAULT_ERROR_MESSAGE,
    };
  }

  // Neither param provided -> fallback to generic error message
  return {
    type: 'error',
    message: DEFAULT_ERROR_MESSAGE,
  };
});

const errorNavTarget = computed(() => {
  return authStore.isAuthenticated ? '/account' : '/login';
});

const errorNavLabel = computed(() => {
  return authStore.isAuthenticated ? 'Quay lại trang tài khoản' : 'Về trang đăng nhập';
});

onMounted(() => {
  if (outcome.value.type === 'success' && authStore.isAuthenticated) {
    // Refresh user profile in background to load newly linked identity
    authStore.fetchMe(true);
    // Redirect to /account after brief moment so user sees visible confirmation
    setTimeout(async () => {
      await router.push('/account');
    }, 1500);
  }
});
</script>
