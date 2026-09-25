<template>
  <div class="min-h-screen flex items-center justify-center bg-cream p-4 sm:p-6">
    <div class="w-full max-w-md bg-white rounded-xl shadow-xs border border-slate-200 p-6 sm:p-8 text-center">
      <!-- Brand Lockup -->
      <div class="mb-6 flex flex-col items-center">
        <div class="flex items-center space-x-2 text-slate-900 font-display font-bold text-xl mb-1">
          <span class="w-8 h-8 rounded-lg bg-terracotta text-white flex items-center justify-center font-display text-lg">
            Phả
          </span>
          <span>Cây Gia Phả</span>
        </div>
        <p class="text-slate-500 text-xs">
          Hệ thống quản lý phả hệ & kết nối dòng tộc
        </p>

        <!-- 3-dot stepper reflecting route step -->
        <div class="flex items-center space-x-1.5 mt-4" aria-hidden="true">
          <span
            :class="[
              'w-2 h-2 rounded-full transition-colors',
              currentStep >= 1 ? 'bg-terracotta' : 'bg-slate-200',
            ]"
          />
          <span
            :class="[
              'w-2 h-2 rounded-full transition-colors',
              currentStep >= 2 ? 'bg-terracotta' : 'bg-slate-200',
            ]"
          />
          <span
            :class="[
              'w-2 h-2 rounded-full transition-colors',
              currentStep >= 3 ? 'bg-terracotta' : 'bg-slate-200',
            ]"
          />
        </div>
      </div>

      <!-- Content Area by Status -->
      <div class="py-6 space-y-4">
        <!-- Status Disc -->
        <div class="mx-auto flex items-center justify-center">
          <div
            v-if="status === 'working'"
            class="h-12 w-12 rounded-full bg-terracotta-soft text-terracotta flex items-center justify-center"
            data-testid="status-disc-working"
          >
            <svg class="animate-spin h-6 w-6 text-terracotta" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </div>

          <div
            v-else-if="status === 'success'"
            class="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center"
            data-testid="status-disc-success"
          >
            <IconCheckCircle class="h-7 w-7" stroke-width="1.5" />
          </div>

          <div
            v-else
            class="h-12 w-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center"
            data-testid="status-disc-error"
          >
            <IconExclamationCircle class="h-7 w-7" stroke-width="1.5" />
          </div>
        </div>

        <!-- Title -->
        <h2 class="text-lg font-bold font-display text-slate-800">
          <slot name="title">{{ title }}</slot>
        </h2>

        <!-- Copy -->
        <p class="text-sm text-slate-600 max-w-sm mx-auto leading-normal">
          <slot name="copy">{{ copy }}</slot>
        </p>

        <!-- Actions -->
        <div class="pt-4 flex flex-col gap-2">
          <slot name="actions">
            <AppButton
              v-if="status === 'error' && retryable"
              variant="outline"
              full-width
              size="md"
              @click="$emit('retry')"
            >
              {{ retryLabel }}
            </AppButton>
            <router-link
              :to="loginTarget"
              class="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-terracotta hover:text-terracotta-hover hover:underline transition-colors"
            >
              {{ loginLabel }}
            </router-link>
          </slot>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { RouteLocationRaw } from 'vue-router';
import AppButton from './AppButton.vue';
import { IconCheckCircle, IconExclamationCircle } from '@/components/icons';

export type AuthStatus = 'working' | 'success' | 'error';

interface Props {
  status?: AuthStatus;
  title?: string;
  copy?: string;
  step?: number;
  retryable?: boolean;
  retryLabel?: string;
  loginTarget?: RouteLocationRaw;
  loginLabel?: string;
}

const props = withDefaults(defineProps<Props>(), {
  status: 'working',
  title: '',
  copy: '',
  step: 2,
  retryable: true,
  retryLabel: 'Thử lại',
  loginTarget: '/login',
  loginLabel: 'Về trang đăng nhập',
});

defineEmits<{
  (e: 'retry'): void;
}>();

const currentStep = computed(() => {
  if (props.status === 'success') return 3;
  if (props.step) return props.step;
  return 2;
});
</script>
