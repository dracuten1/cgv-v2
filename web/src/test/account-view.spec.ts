import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import AccountView from '@/views/AccountView.vue';

const mockPush = vi.fn();
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useRoute: () => ({
    query: {},
  }),
}));

describe('AccountView.vue', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('disables unlink button when user has only 1 identity', () => {
    const wrapper = mount(AccountView, {
      global: {
        plugins: [
          createTestingPinia({
            initialState: {
              auth: {
                user: { id: 'u1', display_name: 'Nguyễn Văn An', is_demo: false },
                identities: [
                  {
                    id: 'id-1',
                    user_id: 'u1',
                    provider: 'google',
                    provider_subject: '12345',
                    linked_at: new Date().toISOString(),
                    last_login_at: new Date().toISOString(),
                  },
                ],
                contacts: [],
              },
            },
          }),
        ],
      },
    });

    const unlinkBtn = wrapper.find('[data-testid="unlink-btn-id-1"]');
    expect(unlinkBtn.exists()).toBe(true);
    // Button should have disabled attribute or class
    expect(unlinkBtn.attributes('disabled')).toBeDefined();
    expect(wrapper.text()).toContain('Phương thức đăng nhập duy nhất');
  });

  it('enables unlink button when user has > 1 identity', () => {
    const wrapper = mount(AccountView, {
      global: {
        plugins: [
          createTestingPinia({
            initialState: {
              auth: {
                user: { id: 'u1', display_name: 'Nguyễn Văn An', is_demo: false },
                identities: [
                  {
                    id: 'id-1',
                    user_id: 'u1',
                    provider: 'google',
                    provider_subject: '12345',
                    linked_at: new Date().toISOString(),
                    last_login_at: new Date().toISOString(),
                  },
                  {
                    id: 'id-2',
                    user_id: 'u1',
                    provider: 'facebook',
                    provider_subject: '67890',
                    linked_at: new Date().toISOString(),
                    last_login_at: new Date().toISOString(),
                  },
                ],
                contacts: [],
              },
            },
          }),
        ],
      },
    });

    const unlinkBtn1 = wrapper.find('[data-testid="unlink-btn-id-1"]');
    expect(unlinkBtn1.attributes('disabled')).toBeUndefined();
  });

  it('renders "Đã xác thực" badge for verified contact points', () => {
    const wrapper = mount(AccountView, {
      global: {
        plugins: [
          createTestingPinia({
            initialState: {
              auth: {
                user: { id: 'u1', display_name: 'Nguyễn Văn An', is_demo: false },
                identities: [],
                contacts: [
                  {
                    id: 'c1',
                    user_id: 'u1',
                    kind: 'email',
                    value: 'an@example.com',
                    verified: true,
                    created_at: new Date().toISOString(),
                  },
                ],
              },
            },
          }),
        ],
      },
    });

    const badge = wrapper.find('[data-testid="contact-verified-badge"]');
    expect(badge.exists()).toBe(true);
    expect(badge.text()).toBe('Đã xác thực');
  });

  it('renders demo badge for demo user and hides provider linking', () => {
    const wrapper = mount(AccountView, {
      global: {
        plugins: [
          createTestingPinia({
            initialState: {
              auth: {
                user: { id: 'u-demo', display_name: 'Khách', is_demo: true },
                identities: [],
                contacts: [],
              },
            },
          }),
        ],
      },
    });

    const demoBadge = wrapper.find('[data-testid="demo-badge"]');
    expect(demoBadge.exists()).toBe(true);
    expect(demoBadge.text()).toBe('Phiên demo');
    expect(wrapper.text()).not.toContain('Thêm phương thức đăng nhập');
  });

  it('replaces emoji glyphs with the shared icon set (spec §5)', () => {
    const wrapper = mount(AccountView, {
      global: {
        plugins: [
          createTestingPinia({
            initialState: {
              auth: {
                user: { id: 'u1', display_name: 'Nguyễn Văn An', is_demo: false },
                identities: [
                  {
                    id: 'id-email',
                    user_id: 'u1',
                    provider: 'email',
                    provider_subject: 'an@example.com',
                    linked_at: new Date().toISOString(),
                    last_login_at: new Date().toISOString(),
                  },
                  {
                    id: 'id-demo',
                    user_id: 'u1',
                    provider: 'demo',
                    provider_subject: 'demo',
                    linked_at: new Date().toISOString(),
                    last_login_at: new Date().toISOString(),
                  },
                ],
                contacts: [
                  {
                    id: 'c-mail',
                    user_id: 'u1',
                    kind: 'email',
                    value: 'an@example.com',
                    verified: true,
                    created_at: new Date().toISOString(),
                  },
                  {
                    id: 'c-phone',
                    user_id: 'u1',
                    kind: 'phone',
                    value: '0912345678',
                    verified: false,
                    created_at: new Date().toISOString(),
                  },
                ],
              },
            },
          }),
        ],
      },
    });

    // No emoji glyphs anywhere in the rendered page
    const html = wrapper.html();
    expect(html).not.toContain('✉️');
    expect(html).not.toContain('📞');
    expect(html).not.toContain('⚡');
    expect(html).not.toContain('🔑');

    // Email/demo identity cards render IconEnvelope / IconSparkles components
    const emailIdentity = wrapper.find('[data-testid="identity-card-id-email"]');
    expect(emailIdentity.findComponent({ name: 'IconEnvelope' }).exists()).toBe(true);
    const demoIdentity = wrapper.find('[data-testid="identity-card-id-demo"]');
    expect(demoIdentity.findComponent({ name: 'IconSparkles' }).exists()).toBe(true);

    // Contact rows render IconEnvelope (email) / IconPhone (phone)
    const mailRow = wrapper.find('[data-testid="contact-row-c-mail"]');
    expect(mailRow.findComponent({ name: 'IconEnvelope' }).exists()).toBe(true);
    const phoneRow = wrapper.find('[data-testid="contact-row-c-phone"]');
    expect(phoneRow.findComponent({ name: 'IconPhone' }).exists()).toBe(true);
  });

  it('user profile card renders the shared AppAvatar', () => {
    const wrapper = mount(AccountView, {
      global: {
        plugins: [
          createTestingPinia({
            initialState: {
              auth: {
                user: { id: 'u1', display_name: 'Nguyễn Văn An', is_demo: false },
                identities: [],
                contacts: [],
              },
            },
          }),
        ],
      },
    });

    const avatar = wrapper.find('[data-testid="user-avatar"]');
    expect(avatar.exists()).toBe(true);
    const avatarComponent = wrapper.findComponent({ name: 'AppAvatar' });
    expect(avatarComponent.exists()).toBe(true);
    expect(avatarComponent.props('size')).toBe('w-14');
    expect(avatarComponent.props('name')).toBe('Nguyễn Văn An');
  });
});