<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-50 p-4 sm:p-6 font-sans">
    <div class="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-8 text-center">
      <!-- Logo / Header -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold font-display text-slate-800 tracking-tight">
          Cây Gia Phả
        </h1>
        <p class="text-slate-500 text-xs mt-1">
          Xác thực liên kết đăng nhập email
        </p>
      </div>

      <!-- State 1: Loading / Verifying -->
      <div v-if="state === 'loading'" class="py-8 space-y-4" data-testid="verify-loading">
        <div class="inline-block animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-[#C85A32]"></div>
        <h2 class="text-base font-semibold text-slate-700">Đang xác thực liên kết...</h2>
        <p class="text-xs text-slate-500 leading-normal">
          Vui lòng đợi trong giây lát, hệ thống đang kiểm tra token đăng nhập của bạn.
        </p>
      </div>

      <!-- State 2: Success -->
      <div v-else-if="state === 'success'" class="py-8 space-y-4" data-testid="verify-success">
        <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-emerald-100 text-emerald-600">
          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 class="text-base font-semibold text-slate-800">Đăng nhập thành công!</h2>
        <p class="text-xs text-slate-500 leading-normal">
          Đang chuyển hướng bạn đến cây gia phả...
        </p>
      </div>

      <!-- State 3: Error / Missing token -->
      <div v-else-if="state === 'error'" class="py-6 space-y-4" data-testid="verify-error">
        <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-rose-100 text-rose-600">
          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 class="text-base font-semibold text-slate-800">{{ errorTitle }}</h2>
        <p class="text-xs text-slate-600 leading-normal">
          {{ errorMessage }}
        </p>
        <div class="pt-2 flex flex-col gap-2">
          <AppButton
            v-if="hasToken"
            variant="outline"
            full-width
            size="md"
            class="border-slate-300 text-slate-700 hover:bg-slate-50"
            @click="verifyToken"
          >
            Thử lại
          </AppButton>
          <router-link
            to="/login"
            class="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-[#C85A32] hover:text-[#B24E2A] hover:underline"
          >
            Về trang đăng nhập
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { formatApiError } from '@/api/client';
import AppButton from '@/components/ui/AppButton.vue';

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
    // W4 & C5: POST token to verify endpoint via authStore/authApi
    await authStore.loginMagicLink(token);
    state.value = 'success';
    // Navigate to /tree or landing route
    setTimeout(async () => {
      await router.push('/tree');
    }, 500);
  } catch (err: any) {
    state.value = 'error';
    errorTitle.value = 'Xác thực thất bại';
    errorMessage.value = err?.message || formatApiError(err) || 'Không thể xác thực liên kết đăng nhập.';
  }
}

onMounted(() => {
  verifyToken();
});
</script>
