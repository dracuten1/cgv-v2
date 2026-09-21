<template>
  <div
    class="fixed bottom-20 md:bottom-6 right-4 z-50 flex flex-col space-y-2 pointer-events-none max-w-sm w-full"
    role="region"
    aria-label="Thông báo"
  >
    <TransitionGroup
      enter-active-class="transform ease-out duration-300 transition"
      enter-from-class="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2"
      enter-to-class="translate-y-0 opacity-100 sm:translate-x-0"
      leave-active-class="transition ease-in duration-100"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :class="[
          'pointer-events-auto flex items-center justify-between p-4 rounded-xl shadow-lg border text-sm',
          getToastClasses(toast.type),
        ]"
      >
        <div class="flex items-center space-x-3 flex-1 mr-2">
          <!-- Icon -->
          <svg
            v-if="toast.type === 'success'"
            class="h-5 w-5 text-emerald-500 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <svg
            v-else-if="toast.type === 'error'"
            class="h-5 w-5 text-red-500 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <svg
            v-else-if="toast.type === 'warning'"
            class="h-5 w-5 text-amber-500 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <svg
            v-else
            class="h-5 w-5 text-sky-500 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>

          <span class="text-slate-800 break-words leading-normal">{{ toast.message }}</span>
        </div>

        <div class="flex items-center space-x-2 shrink-0">
          <button
            v-if="toast.action"
            type="button"
            class="px-2.5 py-1 text-xs font-semibold rounded bg-[#C85A32] text-white hover:bg-[#B24E2A] transition-colors"
            @click="handleAction(toast)"
          >
            {{ toast.action.label }}
          </button>
          <button
            type="button"
            class="text-slate-400 hover:text-slate-600 p-1 rounded-md"
            @click="dismiss(toast.id)"
          >
            <span class="sr-only">Đóng</span>
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { useToast, type ToastType, type ToastItem } from '@/composables/useToast';

const { toasts, dismiss } = useToast();

const getToastClasses = (type: ToastType) => {
  switch (type) {
    case 'success':
      return 'bg-white border-emerald-200';
    case 'error':
      return 'bg-white border-red-200';
    case 'warning':
      return 'bg-white border-amber-200';
    case 'info':
    default:
      return 'bg-white border-sky-200';
  }
};

const handleAction = (toast: ToastItem) => {
  if (toast.action) {
    toast.action.onClick();
    dismiss(toast.id);
  }
};
</script>
