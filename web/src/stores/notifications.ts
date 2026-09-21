import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { pushApi } from '@/api/push';
import { formatApiError } from '@/api/client';
import type { PushSubscribeInput } from '@/types/api';

/** Narrow browser-side push support check — false in jsdom / old browsers. */
function detectPushSupport(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as Window & { Notification?: unknown };
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    typeof w.Notification !== 'undefined' &&
    'permissions' in navigator
  );
}

/**
 * Web Push notifications store (Cycle 2C).
 *
 * Backend contract (verified in api/internal/handler/push_handler.go):
 * - POST /api/v1/push/subscribe   body {endpoint, p256dh, auth} (auth required)
 * - DELETE /api/v1/push/subscribe?endpoint=
 * - There is NO "get current subscription" endpoint → subscription state is
 *   derived client-side from pushManager.getSubscription().
 * - The VAPID public key is NOT exposed by any API route; the SPA reads it
 *   from import.meta.env.VITE_VAPID_PUBLIC_KEY (empty = notifications not
 *   configured → UI shows "Chưa cấu hình thông báo.").
 */
export const useNotificationsStore = defineStore('notifications', () => {
  const isSupported = ref<boolean>(detectPushSupport());
  const isSubscribed = ref<boolean>(false);
  const currentEndpoint = ref<string | null>(null);
  const loading = ref<boolean>(false);
  const error = ref<string | null>(null);

  const hasVapidKey = computed(
    () => !!import.meta.env.VITE_VAPID_PUBLIC_KEY
  );

  /**
   * Derives the subscription state from the push manager (no backend status
   * endpoint exists). Safe to call in unsupported environments.
   */
  async function syncSubscriptionState(): Promise<void> {
    if (!isSupported.value) {
      isSubscribed.value = false;
      currentEndpoint.value = null;
      return;
    }

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      isSubscribed.value = !!subscription;
      currentEndpoint.value = subscription?.endpoint ?? null;
    } catch {
      isSubscribed.value = false;
      currentEndpoint.value = null;
    }
  }

  /**
   * Full subscribe flow: browser permission → pushManager.subscribe with the
   * VAPID key → register endpoint+keys with the backend.
   * `applicationServerKey` must be provided by the caller (component) since
   * env access is centralized there; the store only talks to the backend.
   */
  async function subscribe(input: PushSubscribeInput): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      await pushApi.subscribe(input);
      isSubscribed.value = true;
      currentEndpoint.value = input.endpoint;
    } catch (err) {
      error.value = formatApiError(err);
      throw new Error(error.value);
    } finally {
      loading.value = false;
    }
  }

  /** Unregisters from the backend, then locally in the browser. */
  async function unsubscribe(): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      if (currentEndpoint.value) {
        await pushApi.unsubscribe(currentEndpoint.value);
      }

      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      await subscription?.unsubscribe();

      isSubscribed.value = false;
      currentEndpoint.value = null;
    } catch (err) {
      error.value = formatApiError(err);
      throw new Error(error.value);
    } finally {
      loading.value = false;
    }
  }

  return {
    isSupported,
    isSubscribed,
    currentEndpoint,
    loading,
    error,
    hasVapidKey,
    syncSubscriptionState,
    subscribe,
    unsubscribe,
  };
});
