import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { useNotificationsStore } from '@/stores/notifications';
import { pushApi } from '@/api/push';
import { urlBase64ToUint8Array } from '@/utils/urlBase64ToUint8Array';
import NotificationToggle from '@/components/notifications/NotificationToggle.vue';

vi.mock('@/api/push', () => ({
  pushApi: {
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  },
}));

const mockedPushApi = vi.mocked(pushApi);

/** Fake browser PushSubscription (jsdom has no pushManager). */
function makeFakeSubscription() {
  const payload = {
    endpoint: 'https://push.example/endpoint-1',
    keys: { p256dh: 'P256DH_KEY', auth: 'AUTH_KEY' },
  };
  return {
    endpoint: payload.endpoint,
    toJSON: vi.fn(() => payload),
    unsubscribe: vi.fn().mockResolvedValue(true),
  };
}

describe('notifications store', () => {
  let fakeSubscription: ReturnType<typeof makeFakeSubscription>;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();

    fakeSubscription = makeFakeSubscription();

    // Simulate a push-capable browser (jsdom lacks all of these):
    // 'serviceWorker' in navigator, 'PushManager' in window,
    // Notification defined, navigator.permissions present
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistration: vi.fn().mockResolvedValue({
          pushManager: {
            getSubscription: vi.fn().mockResolvedValue(fakeSubscription),
            subscribe: vi.fn().mockResolvedValue(fakeSubscription),
          },
        }),
      },
    });
    (window as unknown as Record<string, unknown>).PushManager = class FakePushManager {};
    (window as unknown as Record<string, unknown>).Notification = class FakeNotification {
      static requestPermission = vi.fn().mockResolvedValue('granted');
    };
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: { query: vi.fn() },
    });
  });

  afterEach(() => {
    // Remove the fakes so other suites see plain jsdom again
    delete (navigator as unknown as Record<string, unknown>).serviceWorker;
    delete (window as unknown as Record<string, unknown>).PushManager;
    delete (window as unknown as Record<string, unknown>).Notification;
    delete (navigator as unknown as Record<string, unknown>).permissions;
  });

  it('subscribes via the backend with endpoint + keys', async () => {
    mockedPushApi.subscribe.mockResolvedValue({ message: 'Đăng ký nhận thông báo thành công' });

    const store = useNotificationsStore();
    await store.subscribe({
      endpoint: fakeSubscription.endpoint,
      p256dh: 'P256DH_KEY',
      auth: 'AUTH_KEY',
    });

    expect(mockedPushApi.subscribe).toHaveBeenCalledWith({
      endpoint: fakeSubscription.endpoint,
      p256dh: 'P256DH_KEY',
      auth: 'AUTH_KEY',
    });
    expect(store.isSubscribed).toBe(true);
    expect(store.currentEndpoint).toBe(fakeSubscription.endpoint);
    expect(store.error).toBeNull();
  });

  it('unsubscribes from the backend AND the browser', async () => {
    mockedPushApi.subscribe.mockResolvedValue({ message: 'ok' });
    mockedPushApi.unsubscribe.mockResolvedValue({ message: 'Hủy đăng ký nhận thông báo thành công' });

    const store = useNotificationsStore();
    await store.subscribe({ endpoint: fakeSubscription.endpoint, p256dh: 'P256DH_KEY', auth: 'AUTH_KEY' });
    await store.unsubscribe();

    expect(mockedPushApi.unsubscribe).toHaveBeenCalledWith(fakeSubscription.endpoint);
    expect(fakeSubscription.unsubscribe).toHaveBeenCalledTimes(1);
    expect(store.isSubscribed).toBe(false);
    expect(store.currentEndpoint).toBeNull();
  });

  it('surfaces a formatted error and rethrows when the backend rejects', async () => {
    mockedPushApi.subscribe.mockRejectedValue(
      Object.assign(new Error('Bạn cần đăng nhập để thực hiện thao tác này.'), {
        status: 401,
        code: 'UNAUTHORIZED',
      })
    );

    const store = useNotificationsStore();
    await expect(
      store.subscribe({ endpoint: 'https://push.example/e', p256dh: 'k', auth: 'a' })
    ).rejects.toThrow('Bạn cần đăng nhập để thực hiện thao tác này.');

    expect(store.isSubscribed).toBe(false);
    expect(store.error).toBe('Bạn cần đăng nhập để thực hiện thao tác này.');
  });

  it('derives subscription state from pushManager.getSubscription() (no backend status endpoint)', async () => {
    const store = useNotificationsStore();
    await store.syncSubscriptionState();

    expect(store.isSubscribed).toBe(true);
    expect(store.currentEndpoint).toBe(fakeSubscription.endpoint);
  });

  it('resets derived state when the environment has no service worker', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { getRegistration: vi.fn().mockResolvedValue(undefined) },
    });

    const store = useNotificationsStore();
    await store.syncSubscriptionState();

    expect(store.isSubscribed).toBe(false);
    expect(store.currentEndpoint).toBeNull();
  });
});

describe('urlBase64ToUint8Array', () => {
  it('converts a VAPID base64url key to raw bytes', () => {
    // 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'
    // is 65 bytes raw. Check round-trip properties instead of hardcoding:
    const key = urlBase64ToUint8Array(
      'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'
    );
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.length).toBe(65); // P-256 public keys are always 65 bytes (0x04 || X || Y)
    expect(key[0]).toBe(0x04); // uncompressed EC point prefix
  });

  it('handles padded input without breaking', () => {
    const a = urlBase64ToUint8Array('aGVsbG8'); // 'hello' base64url without padding
    expect(new TextDecoder().decode(a)).toBe('hello');
  });
});

describe('NotificationToggle (jsdom guard)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders nothing interactive when push is unsupported (jsdom)', () => {
    // Plain jsdom: no serviceWorker / PushManager / Notification
    const wrapper = mount(NotificationToggle);
    expect(wrapper.find('[data-testid="notification-toggle"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="notification-unconfigured"]').exists()).toBe(false);
    expect(wrapper.find('button').exists()).toBe(false);
  });
});
