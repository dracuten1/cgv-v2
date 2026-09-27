<template>
  <!-- Unsupported browser / jsdom: render nothing at all -->
  <div v-if="!store.isSupported" data-testid="notification-toggle-unsupported"></div>

  <!-- Supported browser but server has no VAPID key configured -->
  <span
    v-else-if="!store.hasVapidKey"
    class="text-xs leading-[1.45] text-ink-3"
    data-testid="notification-unconfigured"
  >
    Chưa cấu hình thông báo.
  </span>

  <!-- Opt-in toggle — switch track on = accent-button fill, off = recessed canvas -->
  <div v-else class="flex items-center gap-2">
    <button
      type="button"
      role="switch"
      :aria-checked="store.isSubscribed"
      :disabled="store.loading"
      data-testid="notification-toggle"
      :class="[
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-[140ms] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent',
        store.isSubscribed ? 'bg-accent-button' : 'border border-hairline-strong bg-canvas-deep',
        store.loading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer active:scale-[0.98]',
      ]"
      @click="onToggle"
    >
      <span
        :class="[
          'inline-block h-4 w-4 transform rounded-full bg-white shadow-e1 transition-transform duration-[140ms]',
          store.isSubscribed ? 'translate-x-6' : 'translate-x-1',
        ]"
      ></span>
    </button>
    <span class="select-none text-xs leading-[1.45] text-ink-2">
      {{ store.isSubscribed ? 'Đang nhận thông báo' : 'Nhận thông báo' }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useNotificationsStore } from '@/stores/notifications';
import { useToast } from '@/composables/useToast';
import { urlBase64ToUint8Array } from '@/utils/urlBase64ToUint8Array';

const store = useNotificationsStore();
const toast = useToast();

// Backend has no "current subscription" endpoint — derive from the push manager.
onMounted(() => {
  store.syncSubscriptionState();
});

async function onToggle(): Promise<void> {
  if (store.isSubscribed) {
    await turnOff();
  } else {
    await turnOn();
  }
}

async function turnOn(): Promise<void> {
  // 1. Ask the browser for permission first
  let permission: NotificationPermission;
  try {
    permission = await Promise.resolve(Notification.requestPermission());
  } catch {
    toast.warning('Bạn đã chặn thông báo trong trình duyệt.');
    return;
  }
  if (permission !== 'granted') {
    toast.warning('Bạn đã chặn thông báo trong trình duyệt.');
    return;
  }

  // 2. Subscribe in the browser with the VAPID public key
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const key = urlBase64ToUint8Array(String(import.meta.env.VITE_VAPID_PUBLIC_KEY));
    const subscription = await registration?.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key as BufferSource,
    });
    if (!subscription) {
      toast.error('Không thể đăng ký nhận thông báo. Vui lòng thử lại.');
      return;
    }

    // 3. Register endpoint + keys with the backend
    const json = subscription.toJSON();
    const p256dh = json.keys?.p256dh ?? '';
    const auth = json.keys?.auth ?? '';
    await store.subscribe({ endpoint: subscription.endpoint, p256dh, auth });

    toast.success('Đã bật thông báo.');
  } catch {
    toast.error(store.error || 'Không thể đăng ký nhận thông báo. Vui lòng thử lại.');
  }
}

async function turnOff(): Promise<void> {
  try {
    // Unregister on the backend first, then in the browser (store does both)
    await store.unsubscribe();
    toast.success('Đã tắt thông báo.');
  } catch {
    toast.error(store.error || 'Không thể tắt thông báo. Vui lòng thử lại.');
  }
}
</script>
