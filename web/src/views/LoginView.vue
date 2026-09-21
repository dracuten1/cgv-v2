<template>
  <div class="min-h-[calc(100vh-8rem)] flex items-center justify-center p-4 sm:p-6">
    <div class="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-8">
      <!-- Header -->
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold font-display text-slate-800 tracking-tight">
          Cây Gia Phả
        </h1>
        <p class="text-slate-500 text-sm mt-1">
          Gìn giữ nguồn cội, kết nối muôn đời
        </p>
      </div>

      <!-- Verified callback notice -->
      <div
        v-if="isVerifiedQuery"
        class="mb-6 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2"
      >
        <svg class="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        <span>Email của bạn đã được xác thực thành công. Bạn có thể tiếp tục sử dụng hệ thống!</span>
      </div>

      <!-- Multi-provider OAuth Buttons -->
      <div class="space-y-3 mb-6">
        <AppButton
          v-for="provider in oauthProviders"
          :key="provider.id"
          variant="outline"
          full-width
          size="md"
          class="relative font-medium hover:bg-slate-50 border-slate-300 text-slate-700"
          @click="loginWithProvider(provider.id)"
        >
          <span class="flex items-center justify-center gap-3">
            <!-- Provider Icon -->
            <span class="w-5 h-5 flex items-center justify-center font-bold text-xs">
              <template v-if="provider.id === 'google'">
                <svg class="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.94H1.27v3.15C3.25 21.32 7.31 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.26c-.24-.72-.38-1.49-.38-2.26s.14-1.54.38-2.26V6.59H1.27C.46 8.21 0 10.05 0 12s.46 3.79 1.27 5.41l4.01-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.68 1.27 6.59l4.01 3.15c.95-2.84 3.6-4.99 6.72-4.99z"/>
                </svg>
              </template>
              <template v-else-if="provider.id === 'facebook'">
                <svg class="w-4 h-4 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </template>
              <template v-else-if="provider.id === 'zalo'">
                <span class="text-[#0068FF] font-bold text-sm tracking-tighter">Z</span>
              </template>
              <template v-else>
                <span>🔑</span>
              </template>
            </span>
            <span>Đăng nhập với {{ provider.name }}</span>
          </span>
        </AppButton>
      </div>

      <!-- Divider -->
      <div class="relative my-6">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-slate-200"></div>
        </div>
        <div class="relative flex justify-center text-xs uppercase">
          <span class="bg-white px-3 text-slate-400 font-medium">Hoặc email</span>
        </div>
      </div>

      <!-- Magic Link Form -->
      <form class="space-y-4 mb-6" @submit.prevent="submitMagicLink">
        <!-- Magic link sent confirmation notice -->
        <div
          v-if="magicLinkSent"
          class="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800 space-y-1"
        >
          <div class="flex items-center gap-2 font-medium">
            <svg class="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>Đã gửi liên kết đăng nhập</span>
          </div>
          <p class="text-xs text-emerald-700 leading-normal">
            Mở email và nhấn liên kết để đăng nhập. Liên kết sẽ mở ứng dụng và tự động đăng nhập tài khoản của bạn.
          </p>
        </div>

        <AppInput
          v-model="email"
          type="email"
          label="Địa chỉ email"
          placeholder="Nhập email của bạn"
          :disabled="magicLinkLoading"
          required
        />
        <AppButton
          type="submit"
          variant="outline"
          full-width
          :loading="magicLinkLoading"
          class="border-slate-300 text-slate-700 hover:bg-slate-50"
        >
          Gửi liên kết đăng nhập
        </AppButton>
      </form>

      <!-- Divider -->
      <div class="relative my-6">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-slate-200"></div>
        </div>
        <div class="relative flex justify-center text-xs uppercase">
          <span class="bg-white px-3 text-slate-400 font-medium">Thử nghiệm</span>
        </div>
      </div>

      <!-- Demo Session Button -->
      <div>
        <AppButton
          variant="primary"
          full-width
          size="lg"
          :loading="demoLoading"
          data-testid="demo-login-btn"
          @click="handleDemoLogin"
        >
          Dùng thử ngay
        </AppButton>
        <p class="text-center text-xs text-slate-400 mt-2">
          Truy cập tức thì với gia phả mẫu Nguyễn Văn An, không cần tạo tài khoản
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { authApi } from '@/api/auth';
import { formatApiError } from '@/api/client';
import { useToast } from '@/composables/useToast';
import AppInput from '@/components/ui/AppInput.vue';
import AppButton from '@/components/ui/AppButton.vue';
import type { ProviderInfo } from '@/types/api';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const toast = useToast();

const email = ref('');
const magicLinkLoading = ref(false);
const magicLinkSent = ref(false);
const demoLoading = ref(false);
const rawProviders = ref<ProviderInfo[]>([]);

// Fallback providers if GET /auth/providers fails
const defaultProviders: ProviderInfo[] = [
  { id: 'google', name: 'Google' },
  { id: 'facebook', name: 'Facebook' },
  { id: 'zalo', name: 'Zalo' },
];

const oauthProviders = computed(() => {
  const list = rawProviders.value.length > 0 ? rawProviders.value : defaultProviders;
  // Filter only external OAuth providers for top buttons (exclude email and demo)
  return list.filter((p) => p.id === 'google' || p.id === 'facebook' || p.id === 'zalo' || p.id === 'mock');
});

const isVerifiedQuery = computed(() => {
  return route.query.verified === '1' || route.query.verified === 'true';
});

async function loadProviders() {
  try {
    const res = await authApi.getProviders();
    if (res && Array.isArray(res.providers)) {
      rawProviders.value = res.providers;
    }
  } catch {
    // Graceful fallback list
    rawProviders.value = defaultProviders;
  }
}

function loginWithProvider(providerId: string) {
  window.location.href = authApi.getLoginUrl(providerId);
}

async function submitMagicLink() {
  if (!email.value.trim()) {
    toast.error('Vui lòng nhập địa chỉ email.');
    return;
  }

  magicLinkLoading.value = true;
  try {
    await authApi.sendMagicLink(email.value.trim());
    magicLinkSent.value = true;
    toast.success('Đã gửi liên kết đăng nhập đến email của bạn.');
    email.value = '';
  } catch (err) {
    toast.error(formatApiError(err));
  } finally {
    magicLinkLoading.value = false;
  }
}

async function handleDemoLogin() {
  demoLoading.value = true;
  try {
    await authStore.loginDemo();
    const redirect = (route.query.redirect as string) || '/tree';
    await router.push(redirect);
  } catch (err: any) {
    toast.error(err?.message || 'Đăng nhập dùng thử thất bại');
  } finally {
    demoLoading.value = false;
  }
}

onMounted(() => {
  loadProviders();

  // If redirected with ?verified=1 or token callback query, show confirmation toast
  if (isVerifiedQuery.value) {
    toast.success('Email đã được xác thực thành công!');
  }
});
</script>