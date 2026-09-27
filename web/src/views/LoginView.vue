<template>
  <div
    class="relative min-h-[calc(100vh-8rem)] flex items-center justify-center p-4 sm:p-6 overflow-hidden min-[960px]:grid min-[960px]:grid-cols-[1.1fr_1fr] min-[960px]:items-stretch min-[960px]:p-0"
  >
    <!-- Heritage ghost decorations (mockup 01): oversized Fraunces glyph + gen-pastel dot clusters.
         Glyph is pure decoration (WCAG 1.4.3-exempt): rendered via ::before pseudo-content so no
         measurable DOM text node exists at 5% opacity. Hidden at >=960px where the approved
         login.html intro panel takes over the brand surface. -->
    <div
      aria-hidden="true"
      class="absolute -right-16 -top-10 font-display font-bold text-[22rem] leading-[1] text-terracotta opacity-[0.05] select-none pointer-events-none before:content-['Phả'] min-[960px]:hidden"
    ></div>
    <div
      aria-hidden="true"
      class="absolute left-10 top-14 hidden sm:flex items-center gap-1.5 opacity-60 min-[960px]:hidden"
    >
      <span class="w-2.5 h-2.5 rounded-full bg-gen-1"></span>
      <span class="w-2 h-2 rounded-full bg-gen-2"></span>
      <span class="w-24 h-px bg-gen-2/40"></span>
      <span class="w-3 h-3 rounded-full bg-gen-3"></span>
      <span class="w-2 h-2 rounded-full bg-gen-4"></span>
    </div>
    <div
      aria-hidden="true"
      class="absolute left-24 bottom-16 hidden sm:flex items-center gap-1.5 opacity-50 min-[960px]:hidden"
    >
      <span class="w-2 h-2 rounded-full bg-gen-4"></span>
      <span class="w-16 h-px bg-gen-4/40"></span>
      <span class="w-2.5 h-2.5 rounded-full bg-gen-1"></span>
    </div>

    <!-- Quiet brand/context intro panel — approved login.html mockup, >=960px only.
         Semantic tokens throughout (bg-quiet, ink-*, gen-*, accent-button). -->
    <aside
      data-testid="login-intro"
      class="hidden min-[960px]:flex min-[960px]:flex-col min-[960px]:justify-between overflow-hidden border-r border-hairline bg-quiet p-16"
    >
      <div>
        <div
          class="flex h-11 w-11 items-center justify-center rounded-[13px] bg-accent-button text-lg font-bold tracking-[-0.03em] text-white shadow-e1"
          aria-hidden="true"
        >
          Ph
        </div>
        <p class="mt-10 max-w-[21ch] font-display text-[2.125rem] font-bold leading-[1.25] tracking-[-0.022em] text-ink-1">
          Gìn giữ nguồn cội, kết nối muôn đời.
        </p>
        <p class="mt-3.5 max-w-[42ch] text-sm leading-[1.6] text-ink-2">
          Cây Gia Phả giúp dòng họ của bạn ghi lại, tra cứu và chia sẻ gia phả — rõ ràng, tôn nghiêm và bền bỉ qua thế hệ.
        </p>

        <!-- Hairline lineage motif — structural decoration (gen tokens re-theme in dark) -->
        <div class="mt-14">
          <svg
            width="360"
            height="132"
            viewBox="0 0 360 132"
            fill="none"
            class="max-w-full"
            aria-hidden="true"
            focusable="false"
          >
            <!-- gen 1 -->
            <circle cx="70" cy="18" r="9" fill="var(--gen-1)" />
            <!-- gen 2 -->
            <path d="M70 27 V 52 H 22 M70 27 V 52 H 118" stroke="var(--hairline-strong)" stroke-width="1.5" />
            <circle cx="22" cy="61" r="9" fill="var(--gen-2)" />
            <circle cx="118" cy="61" r="9" fill="var(--gen-2)" />
            <!-- gen 3 -->
            <path d="M22 70 V 95 H 4 M22 70 V 95 H 40" stroke="var(--hairline-strong)" stroke-width="1.5" />
            <path d="M118 70 V 95 H 96 M118 70 V 95 H 140" stroke="var(--hairline-strong)" stroke-width="1.5" />
            <circle cx="4" cy="104" r="9" fill="var(--gen-3)" />
            <circle cx="40" cy="104" r="9" fill="var(--gen-3)" />
            <circle cx="96" cy="104" r="9" fill="var(--gen-4)" />
            <circle cx="140" cy="104" r="9" fill="var(--gen-4)" />
            <!-- lineage highlight to self -->
            <path d="M70 27 V 52 H 118 M118 70 V 95 H 140" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" />
            <circle cx="140" cy="104" r="13" fill="none" stroke="var(--accent)" stroke-width="1.5" />
            <circle cx="212" cy="104" r="3.5" fill="var(--ink-3)" />
            <circle cx="234" cy="104" r="3.5" fill="var(--ink-3)" />
            <circle cx="256" cy="104" r="3.5" fill="var(--ink-3)" />
          </svg>
          <div class="mt-4 flex flex-wrap gap-x-[18px] gap-y-1.5 text-xs leading-[1.45] text-ink-3">
            <span class="inline-flex items-center gap-[7px]"><span class="h-2 w-2 rounded-full bg-gen-1"></span>Đời thứ nhất</span>
            <span class="inline-flex items-center gap-[7px]"><span class="h-2 w-2 rounded-full bg-gen-2"></span>Đời thứ hai</span>
            <span class="inline-flex items-center gap-[7px]"><span class="h-2 w-2 rounded-full bg-gen-3"></span>Đời thứ ba</span>
            <span class="inline-flex items-center gap-[7px]"><span class="h-2 w-2 rounded-full bg-gen-4"></span>Đời thứ tư</span>
          </div>
        </div>
      </div>
      <p class="mt-10 text-xs leading-[1.45] text-ink-4">Bản quyền dòng họ · Dữ liệu lưu trữ riêng tư</p>
    </aside>

    <!-- Auth panel: centers the card below 960px (current layout), fills the right
         grid column with canvas background at >=960px per mockup. -->
    <section class="relative flex min-h-0 w-full items-center justify-center min-[960px]:bg-canvas min-[960px]:px-6 min-[960px]:pb-14 min-[960px]:pt-10">
    <!-- Login card -->
    <div class="relative w-full max-w-md bg-card rounded-app-xl shadow-e2 border border-hairline p-6 sm:p-8 min-[960px]:max-w-[400px]">
      <!-- Brand lockup -->
      <div class="text-center mb-8">
        <div
          class="mx-auto w-14 h-14 rounded-lg bg-terracotta text-white flex items-center justify-center font-display font-bold text-2xl shadow-md shadow-terracotta/20 mb-4"
          aria-hidden="true"
        >
          Phả
        </div>
        <h1 class="text-3xl font-bold font-display text-ink-1 tracking-tight">
          Cây Gia Phả
        </h1>
        <p class="text-ink-2 text-sm mt-1">
          Gìn giữ nguồn cội, kết nối muôn đời
        </p>
      </div>

      <!-- Verified callback notice -->
      <div
        v-if="isVerifiedQuery"
        class="mb-6 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-start gap-2"
      >
        <IconCheckCircle class="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
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
          class="font-medium"
          @click="loginWithProvider(provider.id)"
        >
          <span class="flex items-center justify-center gap-3">
            <!-- Provider Icon -->
            <span class="w-5 h-5 flex items-center justify-center font-bold text-xs">
              <template v-if="provider.id === 'google'">
                <svg class="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.94H1.27v3.15C3.25 21.32 7.31 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.26c-.24-.72-.38-1.49-.38-2.26s.14-1.54.38-2.26V6.59H1.27C.46 8.21 0 10.05 0 12s.46 3.79 1.27 5.41l4.01-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.68 1.27 6.59l4.01 3.15c.95-2.84 3.6-4.99 6.72-4.99z"/>
                </svg>
              </template>
              <template v-else-if="provider.id === 'facebook'">
                <svg class="w-4 h-4 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </template>
              <template v-else-if="provider.id === 'zalo'">
                <span class="text-[#0068FF] font-bold text-sm tracking-tighter">Z</span>
              </template>
              <template v-else>
                <IconEnvelope class="w-4 h-4" />
              </template>
            </span>
            <span>Đăng nhập với {{ provider.name }}</span>
          </span>
        </AppButton>
      </div>

      <!-- Divider -->
      <div class="relative my-6">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-hairline"></div>
        </div>
        <div class="relative flex justify-center">
          <span class="bg-card px-3 text-xs uppercase font-medium text-ink-3 tracking-wider">Hoặc email</span>
        </div>
      </div>

      <!-- Magic Link Form -->
      <form class="space-y-4 mb-6" @submit.prevent="submitMagicLink">
        <!-- Magic link sent confirmation notice -->
        <div
          v-if="magicLinkSent"
          class="p-4 bg-terracotta-soft border border-terracotta-border rounded-lg text-sm text-terracotta-dark space-y-1"
        >
          <div class="flex items-center gap-2 font-medium">
            <IconEnvelopeOpen class="w-4 h-4 shrink-0" />
            <span>Đã gửi liên kết đăng nhập</span>
          </div>
          <p class="text-xs text-terracotta-dark/80 leading-relaxed">
            Mở email và nhấn liên kết để đăng nhập. Liên kết sẽ mở ứng dụng và tự động đăng nhập tài khoản của bạn.
          </p>
        </div>

        <AppInput
          id="magic-link-email"
          v-model="email"
          label="Địa chỉ email"
          type="email"
          placeholder="Nhập email của bạn"
          required
          hint="Chúng tôi gửi liên kết đăng nhập — không cần mật khẩu."
          :disabled="magicLinkLoading"
        >
          <template #leading>
            <IconEnvelope class="w-4 h-4" />
          </template>
        </AppInput>
        <AppButton
          type="submit"
          variant="outline"
          full-width
          :loading="magicLinkLoading"
        >
          <span class="flex items-center justify-center gap-2">
            <IconPaperAirplane class="w-4 h-4" />
            <span>Gửi liên kết đăng nhập</span>
          </span>
        </AppButton>
      </form>

      <!-- Divider -->
      <div class="relative my-6">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-hairline"></div>
        </div>
        <div class="relative flex justify-center">
          <span class="bg-card px-3 text-xs uppercase font-medium text-ink-3 tracking-wider">Thử nghiệm</span>
        </div>
      </div>

      <!-- Demo panel — amber per INV-04 (never terracotta); semantic demo tokens re-theme for AA in both schemes -->
      <div class="rounded-xl border border-demo-border bg-demo-soft p-4">
        <div class="flex items-start gap-3">
          <span class="w-9 h-9 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
            <IconSparkles class="w-5 h-5" />
          </span>
          <div class="min-w-0">
            <p class="text-sm font-semibold text-demo-deep">Dùng thử ngay</p>
            <p class="text-xs text-demo-deep mt-0.5">
              Truy cập tức thì với gia phả mẫu Nguyễn Văn An, không cần tạo tài khoản.
            </p>
          </div>
        </div>
        <AppButton
          variant="demo"
          full-width
          size="lg"
          class="mt-3"
          :loading="demoLoading"
          data-testid="demo-login-btn"
          @click="handleDemoLogin"
        >
          <span class="flex items-center justify-center gap-2">
            <span>Vào bản dùng thử</span>
            <IconArrowRight class="w-4 h-4" />
          </span>
        </AppButton>
      </div>

      <p class="mt-6 text-center text-xs text-ink-3">
        Việc đăng nhập nghĩa là bạn đồng ý với Điều khoản sử dụng &amp; Chính sách bảo mật.
      </p>
    </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { authApi } from '@/api/auth';
import { formatApiError } from '@/api/client';
import { useToast } from '@/composables/useToast';
import AppButton from '@/components/ui/AppButton.vue';
import AppInput from '@/components/ui/AppInput.vue';
import {
  IconArrowRight,
  IconCheckCircle,
  IconEnvelope,
  IconEnvelopeOpen,
  IconPaperAirplane,
  IconSparkles,
} from '@/components/icons';
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
  } catch (err: unknown) {
    // Graceful fallback list — the default provider buttons stay rendered
    console.warn('[LoginView] Không tải được danh sách nhà cung cấp, dùng danh sách mặc định:', err);
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
  } catch (err: unknown) {
    toast.error(formatApiError(err) || 'Đăng nhập dùng thử thất bại');
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
