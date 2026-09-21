import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, enableAutoUnmount } from '@vue/test-utils';
import { nextTick } from 'vue';
import InstallPrompt from '@/components/notifications/InstallPrompt.vue';

/** Simulates the browser firing `beforeinstallprompt`. */
function fireBeforeInstallPrompt(): { prompt: ReturnType<typeof vi.fn>; event: Event } {
  const event = new Event('beforeinstallprompt') as Event & {
    prompt: ReturnType<typeof vi.fn>;
  };
  event.preventDefault = vi.fn();
  event.prompt = vi.fn().mockResolvedValue(undefined);
  window.dispatchEvent(event);
  return { prompt: event.prompt, event };
}

describe('InstallPrompt', () => {
  // Listeners live on window — unmount between tests so events hit one
  // component instance only
  enableAutoUnmount(afterEach);

  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    window.sessionStorage.clear();
  });

  it('is hidden when no beforeinstallprompt event fires (unsupported / already installed)', async () => {
    const wrapper = mount(InstallPrompt);
    await nextTick();

    expect(wrapper.find('[data-testid="install-prompt"]').exists()).toBe(false);
  });

  it('appears after the beforeinstallprompt event and installs on click', async () => {
    const wrapper = mount(InstallPrompt);
    await nextTick();

    const { prompt } = fireBeforeInstallPrompt();
    await nextTick();

    const banner = wrapper.find('[data-testid="install-prompt"]');
    expect(banner.exists()).toBe(true);
    expect(banner.text()).toContain('Cài đặt Cây Gia Phả');

    await wrapper.find('[data-testid="install-button"]').trigger('click');
    expect(prompt).toHaveBeenCalledTimes(1);

    // Banner hides after prompting
    expect(wrapper.find('[data-testid="install-prompt"]').exists()).toBe(false);
  });

  it('"Để sau" hides the banner for the rest of the session (sessionStorage flag)', async () => {
    const wrapper = mount(InstallPrompt);
    await nextTick();

    fireBeforeInstallPrompt();
    await nextTick();

    expect(wrapper.find('[data-testid="install-prompt"]').exists()).toBe(true);

    await wrapper.find('[data-testid="install-dismiss"]').trigger('click');
    await nextTick();
    expect(wrapper.find('[data-testid="install-prompt"]').exists()).toBe(false);
    expect(window.sessionStorage.getItem('cgp.installPrompt.dismissed')).toBe('1');

    // A later event in the same session must NOT re-show it
    fireBeforeInstallPrompt();
    await nextTick();
    expect(wrapper.find('[data-testid="install-prompt"]').exists()).toBe(false);
  });

  it('calls preventDefault so the browser does not show its own banner', async () => {
    mount(InstallPrompt);
    const { event } = fireBeforeInstallPrompt();

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });
});
