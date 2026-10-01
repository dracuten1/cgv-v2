<template>
  <div :data-testid="`verify-${state}`">
    <AuthInterstitial
      :status="interstitialStatus"
      :title="currentTitle"
      :copy="currentCopy"
      :step="currentStep"
      :subtitle="currentSubtitle"
      :retryable="hasToken"
      retry-label="Thử lại"
      login-target="/login"
      login-label="Về trang đăng nhập"
      @retry="verifyToken"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { formatApiError } from '@/api/client';
import AuthInterstitial, { type AuthStatus } from '@/components/ui/AuthInterstitial.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

type VerifyState = 'loading' | 'success' | 'error';
const state = ref<VerifyState>('loading');
const errorTitle = ref('Liên kết không hợp lệ');
const errorMessage = ref('Liên kết xác thực đã hết hạn hoặc không đúng định dạng.');

const hasToken = computed(() => {
  const token = route.query.token;
  return typeof token === 'string' && token.trim().length > 0;
});

const interstitialStatus = computed<AuthStatus>(() => {
  if (state.value === 'loading') return 'working';
  if (state.value === 'success') return 'success';
  return 'error';
});

const currentStep = computed(() => {
  if (state.value === 'success') return 3;
  return 2;
});

const currentSubtitle = computed(() => {
  if (state.value === 'loading') return 'Đang xác thực';
  if (state.value === 'success') return 'Xác thực hoàn tất';
  return 'Xác thực liên kết email';
});

const currentTitle = computed(() => {
  if (state.value === 'loading') return 'Đang xác thực liên kết...';
  if (state.value === 'success') return 'Đăng nhập thành công!';
  return errorTitle.value;
});

const currentCopy = computed(() => {
  if (state.value === 'loading') {
    return 'Vui lòng đợi trong giây lát. Chúng tôi đang kiểm tra liên kết đăng nhập của bạn.';
  }
  if (state.value === 'success') {
    return 'Liên kết đã được xác nhận. Bạn sẽ được chuyển đến bảng tin dòng họ.';
  }
  return errorMessage.value;
});

async function verifyToken() {
  const rawToken = route.query.token;
  const token = typeof rawToken === 'string' ? rawToken.trim() : '';

  if (!token) {
    state.value = 'error';
    errorTitle.value = 'Liên kết không hợp lệ';
    errorMessage.value = 'Không tìm thấy mã xác thực trong liên kết. Vui lòng yêu cầu liên kết mới.';
    return;
  }

  state.value = 'loading';
  try {
    await authStore.loginMagicLink(token);
    state.value = 'success';
    // Post-auth routing (owner decision 2026-10-01): feeds are the main page —
    // default to /feed; an explicit ?redirect= always wins.
    const redirect = typeof route.query.redirect === 'string' && route.query.redirect ? route.query.redirect : '/feed';
    setTimeout(async () => {
      await router.push(redirect);
    }, 500);
  } catch (err: unknown) {
    state.value = 'error';
    errorTitle.value = 'Xác thực thất bại';
    errorMessage.value = formatApiError(err) || 'Không thể xác thực liên kết đăng nhập.';
  }
}

onMounted(() => {
  verifyToken();
});
</script>
