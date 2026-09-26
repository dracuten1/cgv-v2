<template>
  <div :data-testid="`oauth-${outcome.type}`">
    <AuthInterstitial
      :status="outcome.type === 'success' ? 'success' : 'error'"
      :step="3"
      :retryable="false"
      :title="outcome.type === 'success' ? 'Liên kết tài khoản thành công!' : 'Liên kết tài khoản không thành công'"
      :copy="outcome.message"
    >
      <template #copy>
        <span data-testid="oauth-message">{{ outcome.message }}</span>
      </template>
      <template #actions>
        <router-link
          v-if="outcome.type === 'success'"
          to="/account"
          class="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg bg-terracotta text-white hover:bg-terracotta-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-terracotta transition-colors"
          data-testid="oauth-nav-affordance"
        >
          Quay lại trang tài khoản
        </router-link>
        <router-link
          v-else
          :to="errorNavTarget"
          class="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg bg-terracotta text-white hover:bg-terracotta-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-terracotta transition-colors"
          data-testid="oauth-nav-affordance"
        >
          {{ errorNavLabel }}
        </router-link>
      </template>
    </AuthInterstitial>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import AuthInterstitial from '@/components/ui/AuthInterstitial.vue';

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
