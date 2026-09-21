<template>
  <div
    v-if="visible"
    class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-xl shadow-xs border border-[#F4D0C2] p-4 mb-4"
    data-testid="install-prompt"
    role="region"
    aria-label="Cài đặt ứng dụng"
  >
    <div class="flex items-center space-x-3">
      <div
        class="w-10 h-10 rounded-lg bg-[#F9EAE1] text-[#B24E2A] flex items-center justify-center shrink-0"
        aria-hidden="true"
      >
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"
          />
        </svg>
      </div>
      <div>
        <p class="text-sm font-semibold text-slate-800">Cài đặt Cây Gia Phả</p>
        <p class="text-xs text-slate-500">Thêm ứng dụng vào màn hình chính để truy cập nhanh hơn.</p>
      </div>
    </div>
    <div class="flex items-center space-x-2 shrink-0">
      <button
        type="button"
        data-testid="install-button"
        class="px-4 py-1.5 text-sm font-medium rounded-lg bg-[#C85A32] text-white hover:bg-[#B24E2A] transition-colors"
        @click="install"
      >
        Cài đặt
      </button>
      <button
        type="button"
        data-testid="install-dismiss"
        class="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        @click="dismiss"
      >
        Để sau
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

/** Minimal shape of the non-standard beforeinstallprompt event. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

const DISMISS_KEY = 'cgp.installPrompt.dismissed';

const visible = ref(false);
let deferredPrompt: BeforeInstallPromptEvent | null = null;

function onBeforeInstallPrompt(event: Event): void {
  event.preventDefault();
  deferredPrompt = event as BeforeInstallPromptEvent;
  visible.value = !isDismissedThisSession();
}

function isDismissedThisSession(): boolean {
  try {
    return window.sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function install(): void {
  deferredPrompt?.prompt();
  visible.value = false;
  deferredPrompt = null;
}

function dismiss(): void {
  visible.value = false;
  try {
    window.sessionStorage.setItem(DISMISS_KEY, '1');
  } catch {
    // sessionStorage unavailable — hiding for this render is enough
  }
}

onMounted(() => {
  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
});

onUnmounted(() => {
  window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
});
</script>
