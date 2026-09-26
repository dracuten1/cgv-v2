<template>
  <div :data-testid="`verify-${state}`">
    <AuthInterstitial
      :status="interstitialStatus"
      :title="currentTitle"
      :copy="currentCopy"
      :step="currentStep"
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

const currentTitle = computed(() => {
  if (state.value === 'loading') return 'Đang xác thực liên kết...';
  if (state.value === 'success') return 'Đăng nhập thành công!';
  return errorTitle.value;
});

const currentCopy = computed(() => {
  if (state.value === 'loading') {
    return 'Vui lòng đợi trong giây lát, hệ thống đang kiểm tra token đăng nhập của bạn.';
  }
  if (state.value === 'success') {
    return 'Đang chuyển hướng bạn đến cây gia phả...';
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
    setTimeout(async () => {
      await router.push('/tree');
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
