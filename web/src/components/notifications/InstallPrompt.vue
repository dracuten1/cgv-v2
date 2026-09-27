<template>
  <!-- Install banner — card surface + accent icon disc (design-system §4/§8.1 PWA banner) -->
  <div
    v-if="visible"
    class="mb-6 flex flex-col justify-between gap-3 rounded-app-xl border border-hairline bg-card p-4 shadow-e1 sm:flex-row sm:items-center md:p-5"
    data-testid="install-prompt"
    role="region"
    aria-label="Cài đặt ứng dụng"
  >
    <div class="flex items-center gap-3">
      <div
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-app-lg bg-accent-soft text-accent-fg"
        aria-hidden="true"
      >
        <IconArrowDownTray class="h-5 w-5" />
      </div>
      <div>
        <p class="text-sm font-semibold leading-[1.45] text-ink-1">Cài đặt Cây Gia Phả</p>
        <p class="text-xs leading-[1.6] text-ink-3">
          Thêm ứng dụng vào màn hình chính để truy cập nhanh hơn.
        </p>
      </div>
    </div>
    <div class="flex shrink-0 items-center gap-2">
      <AppButton
        type="button"
        size="sm"
        data-testid="install-button"
        @click="install"
      >
        Cài đặt
      </AppButton>
      <AppButton
        type="button"
        variant="ghost"
        size="sm"
        data-testid="install-dismiss"
        @click="dismiss"
      >
        Để sau
      </AppButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import AppButton from '@/components/ui/AppButton.vue';
import { IconArrowDownTray } from '@/components/icons';

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
